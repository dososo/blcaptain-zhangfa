#!/usr/bin/env node
import { access, lstat, mkdir, mkdtemp, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { isIP } from 'node:net';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultWidths = [320, 360, 390, 768, 1024, 1280, 1440];
const limitations = [
  '这是当前页面和指定宽度的浏览器快照，不是审美评分，也不代表完整无障碍合规。',
  '名称检查覆盖常见原生控件与按钮角色；复杂 ARIA、键盘操作、对比度和读屏体验仍需人工验收。',
  '裁切检查依据可见文字行盒与 overflow 容器；画布、伪元素、封闭影子树和尚未展开的交互内容未覆盖。',
  '截图等待字体与当前图片就绪；滚动触发的懒加载、登录态、动画各时刻和真机体验仍需另验。',
  '分寸通过只代表所运行的中文规则通过；最终中文语义断行、内容质量与视觉验收仍需人工确认。'
];

function permitted(value, allowRemote) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('只支持 HTTP 或 HTTPS 页面。');
  const loopback = ['localhost', '[::1]'].includes(url.hostname) || isIP(url.hostname) === 4 && url.hostname.startsWith('127.');
  if (!allowRemote && !loopback) {
    throw new Error('默认仅允许回环地址；外网页面需显式使用 --allow-remote。');
  }
  return url.href;
}

async function directory(folder) {
  try {
    if (!(await stat(folder)).isDirectory()) throw new Error(`输出必须是目录：${folder}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(folder, { recursive: true });
  }
}

async function playwright(cwd) {
  // 从目标项目和脚本安装位置查找已有依赖，绝不自动安装。
  for (const base of [cwd, here]) {
    const require = createRequire(path.join(base, '章法依赖定位.cjs'));
    for (const name of ['playwright-core', 'playwright']) {
      try { return require(name); } catch (error) {
        if (error.code !== 'MODULE_NOT_FOUND') throw error;
      }
    }
  }
  throw new Error('未找到 Playwright；请在目标项目安装 playwright-core 后重试。');
}

async function launch(cwd, chromePath) {
  const { chromium } = await playwright(cwd);
  if (chromePath) return chromium.launch({ executablePath: chromePath, headless: true });
  return chromium.launch({ channel: 'chrome', headless: true });
}

function command(file, args, cwd) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [file, ...args], { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', issue;
    const timer = setTimeout(() => { issue = '分寸执行超时。'; child.kill(); }, 120000);
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    child.on('error', error => { issue = error.message; });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, signal, ...(issue ? { reason: issue } : {}) });
    });
  });
}

async function measure(options, browserStatus) {
  if (options.noMeasure) return { status: 'not_run', reason: '调用者显式跳过分寸，不能据此宣称中文验收通过。' };
  if (browserStatus !== 'pass') return { status: 'not_run', reason: '浏览器未运行，未执行依赖浏览器的中文检查。' };
  const cli = path.resolve(options.cwd, options.measureCli || 'node_modules/.bin/measure-cjk');
  try { await access(cli); } catch {
    return { status: 'not_run', cli, reason: '未找到分寸 CLI；不会通过 npx 自动联网安装。' };
  }
  const versionRun = await command(cli, ['--version'], options.cwd);
  const version = versionRun.stdout.match(/\b\d+\.\d+\.\d+(?:-[\w.-]+)?\b/)?.[0];
  if (versionRun.exitCode !== 0 || version !== '0.1.0') {
    return { status: 'unknown', cli, version: version || null, versionRun, reason: '仅支持 measure-cjk 0.1.0；版本未确认或不受支持。' };
  }
  // 每次运行使用独立目录，避免子进程失败后误读旧的通过结果。
  const runDirectory = await mkdtemp(path.join(options.out, 'measure-'));
  const rawPath = path.join(runDirectory, 'raw.json');
  let configuration = { source: '分寸 0.1.0 默认配置', path: null }, measureRoot = runDirectory;
  const configPath = path.join(options.cwd, 'measure.config.json');
  try {
    await lstat(configPath);
    configuration = { source: '项目配置', path: configPath };
    const relative = path.relative(await realpath(options.cwd), await realpath(options.out));
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      return { status: 'unknown', cli, version, versionRun, configuration, reason: '分寸 0.1.0 要求配置和证据位于同一根目录；请显式将 --out 设置在项目内，再按项目规则检查。未改用默认阈值。' };
    }
    measureRoot = options.cwd;
  } catch (error) {
    if (error.code !== 'ENOENT') return { status: 'unknown', cli, version, configuration, reason: `无法确认项目配置：${error.message}` };
  }
  const args = ['lint', options.url, '--render', '--root', measureRoot, '--widths', options.widths.join(','), '--format', 'json', '--out', rawPath, '--evidence', path.join(runDirectory, 'evidence')];
  if (configuration.path) args.push('--config', configuration.path);
  if (options.allowRemote) args.push('--allow-remote');
  const execution = await command(cli, args, options.cwd);
  let raw;
  try { raw = JSON.parse(await readFile(rawPath, 'utf8')); } catch {
    return { status: 'unknown', cli, version, args, rawPath, configuration, ...execution, reason: '分寸没有生成可读取的 JSON，无法判为通过。' };
  }
  let status = 'unknown';
  if (raw.tool?.version === '0.1.0' && raw.tool?.name === 'measure-cjk' && !execution.reason) {
    if (execution.exitCode === 1 && raw.summary?.status === 'fail') status = 'fail';
    if (execution.exitCode === 0 && raw.summary?.status === 'pass' && raw.summary.errors === 0 && raw.summary.files > 0 && raw.summary.cjk_files > 0 && raw.run?.render && !raw.run.render.problems?.length) status = 'pass';
    if (execution.exitCode === 0 && raw.summary?.status === 'skipped' && raw.summary.files > 0 && raw.summary.cjk_files === 0 && !raw.run?.render?.problems?.length) status = 'not_applicable';
  }
  return { status, cli, version, args, rawPath, raw, configuration, ...execution, ...(status === 'unknown' ? { reason: '分寸结果不完整、协议不符或退出码与结果不一致。' } : {}) };
}

function inspectDOM() {
  const findings = [];
  const describe = element => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`;
  const rendered = element => {
    const style = getComputedStyle(element);
    return style.visibility !== 'hidden' && style.visibility !== 'collapse' && style.opacity !== '0' && element.getClientRects().length > 0;
  };
  const add = (code, element, message) => findings.push({ code, element: describe(element), message });
  const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
  if (documentWidth > innerWidth + 1) findings.push({ code: 'horizontal_overflow', message: `页面内容宽 ${documentWidth}px，窗口宽 ${innerWidth}px。`, documentWidth });
  for (const element of document.querySelectorAll('img')) {
    if (rendered(element) && (!element.complete || !element.naturalWidth)) add('broken_image', element, '可见图片未成功加载。');
  }
  const visibleText = element => {
    if (element.getAttribute('aria-hidden') === 'true') return '';
    if (element.nodeType === Node.TEXT_NODE) return element.textContent;
    if (element.tagName === 'IMG') return element.getAttribute('alt') || '';
    return [...element.childNodes].map(node => node.nodeType === Node.TEXT_NODE ? node.textContent : node.nodeType === Node.ELEMENT_NODE ? visibleText(node) : '').join(' ');
  };
  const name = element => {
    const ids = element.getAttribute('aria-labelledby');
    if (ids) {
      const label = ids.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
      if (label) return label;
    }
    if (element.getAttribute('aria-label')?.trim()) return element.getAttribute('aria-label');
    if (element.labels?.length && [...element.labels].some(label => label.textContent.trim())) return '关联标签';
    if (element.type === 'image') return element.alt || element.title;
    if (element.tagName === 'INPUT' && ['submit', 'reset'].includes(element.type)) return element.value || '原生默认名称';
    if (element.tagName === 'INPUT' && element.type === 'button') return element.value || element.title;
    if (element.matches('button,[role="button"]')) return visibleText(element).trim() || element.querySelector('svg title')?.textContent || element.title;
    return element.title;
  };
  for (const element of document.querySelectorAll('button,input,textarea,select,[role="button"]')) {
    if (rendered(element) && element.type !== 'hidden' && !name(element)?.trim()) add('unnamed_control', element, '按钮或表单控件缺少可访问名称。');
  }
  for (const element of document.querySelectorAll('a[href]')) {
    if (rendered(element) && !element.getAttribute('href').trim()) add('empty_href', element, '可见链接的 href 为空。');
  }
  // 只检查实际文字行盒；横向可滚动区域允许超出容器，不按裁切处理。
  const readerOnly = element => {
    const style = getComputedStyle(element), box = element.getBoundingClientRect();
    if (!['absolute', 'fixed'].includes(style.position) || box.width <= 0 || box.width > 1 || box.height <= 0 || box.height > 1) return false;
    const rectangle = style.clip.match(/^rect\((.*)\)$/)?.[1].split(/[,\s]+/).filter(Boolean);
    const zeroArea = rectangle?.length === 4 && rectangle.every(value => value === rectangle[0]);
    return zeroArea || /^inset\(50%(?:\s+50%){0,3}\)$/.test(style.clipPath);
  };
  const clipped = new Set();
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!node.textContent.trim() || !rendered(parent) || parent.closest('script,style,noscript,[aria-hidden="true"]')) continue;
    const ancestors = [];
    for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) ancestors.push(ancestor);
    // 仅忽略明确的读屏专用隐藏模式，名称计算仍保留这些文本。
    if (ancestors.some(readerOnly)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()];
    for (const ancestor of ancestors) {
      const style = getComputedStyle(ancestor);
      const clipX = ['hidden', 'clip'].includes(style.overflowX);
      const clipY = ['hidden', 'clip'].includes(style.overflowY);
      if (!clipX && !clipY) continue;
      const box = ancestor.getBoundingClientRect();
      const left = box.left + ancestor.clientLeft, top = box.top + ancestor.clientTop;
      if (rects.some(rect => (clipX && (rect.left < left - 1 || rect.right > left + ancestor.clientWidth + 1)) || (clipY && (rect.top < top - 1 || rect.bottom > top + ancestor.clientHeight + 1)))) clipped.add(ancestor);
    }
  }
  for (const element of clipped) add('clipped_content', element, '可见文字行盒超出裁切容器，需检查内容是否丢失。');
  return findings;
}

function headingLines() {
  const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
  return [...document.querySelectorAll('h1,h2')].filter(element => {
    const css = getComputedStyle(element);
    return element.getClientRects().length && css.visibility !== 'hidden' && css.opacity !== '0' && css.writingMode === 'horizontal-tb';
  }).slice(0, 12).map(element => {
    const css = getComputedStyle(element);
    const result = { text: element.textContent.trim(), element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`, fontFamily: css.fontFamily, fontSize: css.fontSize, lines: [], status: 'pass' };
    const rows = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('[aria-hidden="true"],[hidden]')) continue;
      for (const segment of segmenter.segment(node.textContent)) {
        const range = document.createRange();
        range.setStart(node, segment.index);
        range.setEnd(node, segment.index + segment.segment.length);
        const rect = range.getClientRects()[0];
        if (!rect || !rect.height || !rect.width) continue;
        let row = rows.find(row => rect.bottom > row.top + 1 && rect.top < row.bottom - 1);
        if (!row) { row = { top: rect.top, bottom: rect.bottom, text: '' }; rows.push(row); }
        row.text += segment.segment;
      }
    }
    result.lines = rows.sort((a, b) => a.top - b.top).map(row => row.text.trim().replace(/\s+/g, ' ')).filter(Boolean);
    return result;
  });
}

async function inspectWidth(browser, options, width) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, locale: 'zh-CN', reducedMotion: 'reduce', serviceWorkers: 'block' });
  const errors = [], blocked = [];
  page.on('pageerror', error => errors.push({ code: 'pageerror', message: error.message }));
  const requiredResource = request => ['script', 'stylesheet', 'font'].includes(request.resourceType());
  page.on('response', response => {
    if (requiredResource(response.request()) && response.status() >= 400) errors.push({ code: 'resource_http_error', url: response.url(), message: `页面依赖资源HTTP ${response.status()}，不能视为完整加载。` });
  });
  page.on('requestfailed', request => {
    if (requiredResource(request)) errors.push({ code: 'resource_request_failed', url: request.url(), message: `页面依赖资源请求失败：${request.failure()?.errorText || '原因未知'}。` });
  });
  if (!options.allowRemote) await page.route('**/*', route => {
    const target = route.request().url();
    if (!/^https?:/.test(target)) return route.continue();
    try { permitted(target, false); return route.continue(); } catch { blocked.push(target); return route.abort('blockedbyclient'); }
  });
  const result = { width, status: 'unknown', findings: [], screenshot: path.join(options.out, `page-${width}.png`) };
  try {
    const response = await page.goto(options.url, { waitUntil: 'load', timeout: 20000 });
    if (response && response.status() >= 400) errors.push({ code: 'http_error', message: `页面 HTTP 状态为 ${response.status()}。` });
    const ready = await page.evaluate(async () => {
      let timer;
      const settled = Promise.all([document.fonts.ready, ...[...document.images].map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); }))]);
      const ready = await Promise.race([settled.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 10000); })]);
      clearTimeout(timer);
      return ready;
    });
    result.findings = [...await page.evaluate(inspectDOM), ...errors];
    result.headings = await page.evaluate(headingLines);
    result.headingScope = '前12个可见横排h1/h2；计算字体栈不是逐字实际字体命中证明；语义需审阅。';
    await page.screenshot({ path: result.screenshot, fullPage: true, animations: 'disabled', timeout: 20000 });
    result.status = result.findings.length ? 'fail' : ready && !blocked.length ? 'pass' : 'unknown';
    result.resourcesReady = ready;
    if (blocked.length) result.blockedRequests = [...new Set(blocked)];
    if (!ready) result.reason = '字体或图片未在等待期内就绪，截图不能视为完整渲染。';
  } catch (error) {
    result.status = 'fail';
    result.findings.push(...errors, { code: 'page_load_error', message: error.message });
    try { await page.screenshot({ path: result.screenshot, fullPage: true, timeout: 5000 }); } catch { result.screenshot = null; }
  } finally {
    if (blocked.length) result.blockedRequests = [...new Set(blocked)];
    await page.close();
  }
  return result;
}

export async function inspectPage(input = {}) {
  const options = { ...input, cwd: path.resolve(input.cwd || process.cwd()), out: path.resolve(input.out || '章法检查证据'), widths: input.widths || defaultWidths };
  options.url = permitted(input.url, input.allowRemote);
  if (!Array.isArray(options.widths) || !options.widths.length || options.widths.some(width => !Number.isInteger(width) || width < 240 || width > 7680)) throw new Error('宽度必须是 240 到 7680 之间的整数列表。');
  options.widths = [...new Set(options.widths)];
  await directory(options.out);
  const outputRoot = options.out;
  options.out = await mkdtemp(path.join(outputRoot, 'run-'));
  const report = { schemaVersion: '1.0.0', url: options.url, startedAt: new Date().toISOString(), evidenceDirectory: options.out, widths: options.widths, status: 'unknown', browser: { status: 'not_run' }, pages: [], measure: { status: 'not_run' }, chineseAcceptance: 'not_run', manualAcceptance: 'not_run', limitations };
  let browser;
  try {
    browser = await launch(options.cwd, input.chromePath || process.env.CHROME_PATH);
    report.browser = { status: 'pass', version: browser.version() };
  } catch (error) { report.browser.reason = `浏览器检查未运行：${error.message}`; }
  if (browser) {
    try { for (const width of options.widths) report.pages.push(await inspectWidth(browser, options, width)); }
    finally { await browser.close(); }
  }
  report.measure = await measure(options, report.browser.status);
  report.chineseAcceptance = report.measure.status;
  const states = [report.browser.status, ...report.pages.map(page => page.status), report.measure.status];
  report.status = states.includes('fail') ? 'fail' : report.browser.status === 'not_run' ? 'not_run' : states.includes('unknown') ? 'unknown' : states.includes('not_run') ? 'not_run' : report.measure.status === 'not_applicable' ? 'not_applicable' : 'pass';
  report.finishedAt = new Date().toISOString();
  const json = JSON.stringify(report, null, 2) + '\n';
  await writeFile(path.join(options.out, 'report.json'), json);
  await writeFile(path.join(outputRoot, 'report.json'), json);
  return report;
}

const help = `用法：node check-page.mjs --url <页面地址> [--out <证据目录>]
  --widths <逗号分隔宽度>  默认：${defaultWidths.join(',')}
  --allow-remote           允许访问外网页面及资源
  --measure-cli <JS路径>   指定本地分寸 0.1.0 CLI，使用 Node 启动
  --no-measure             跳过分寸；中文验收状态保持未运行
  --help                  显示帮助
默认仅访问回环地址。只使用已有 Playwright 和系统 Chrome，不自动安装依赖。
CHROME_PATH 可指定系统 Chrome 路径。退出码：0 自动检查通过；1 页面或规则失败；2 环境、参数、未知或未运行。
`;

async function main() {
  const args = process.argv.slice(2), options = {};
  if (args.includes('--help')) { process.stdout.write(help); return; }
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--allow-remote') options.allowRemote = true;
    else if (flag === '--no-measure') options.noMeasure = true;
    else if (['--url', '--out', '--widths', '--measure-cli'].includes(flag)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${flag} 缺少参数。`);
      const key = { '--url': 'url', '--out': 'out', '--widths': 'widths', '--measure-cli': 'measureCli' }[flag];
      options[key] = key === 'widths' ? value.split(',').map(Number) : value;
    } else throw new Error(`未知参数：${flag}`);
  }
  if (!options.url) throw new Error('请通过 --url 指定页面地址。');
  const report = await inspectPage(options);
  const labels = { pass: '通过', fail: '失败', unknown: '未知', not_run: '未运行', not_applicable: '不适用' };
  process.stdout.write(`自动检查：${labels[report.status]}。证据：${path.resolve(options.out || '章法检查证据', 'report.json')}\n人工视觉与语义验收：未运行。\n`);
  process.exitCode = report.status === 'pass' ? 0 : report.status === 'fail' ? 1 : 2;
}

const entryPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => path.resolve(process.argv[1])) : null;
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) main().catch(error => { process.stderr.write(`检查失败：${error.message}\n`); process.exitCode = 2; });
