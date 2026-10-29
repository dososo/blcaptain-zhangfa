import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = path.join(root, 'skills/blcaptain-zhangfa/scripts/check-page.mjs');
const { inspectPage } = await import(script);
const temporary = () => mkdtemp(path.join(tmpdir(), '章法检查-'));

async function serve(t) {
  const server = createServer(async (request, response) => {
    const pathname = decodeURI(request.url);
    if (pathname === '/断连.js') { request.socket.destroy(); return; }
    if (pathname.startsWith('/资源缺失')) { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(`<html lang="zh-CN"><meta charset="utf-8"><p>中文资源检查页面</p><script src="${pathname.includes('断连') ? '/断连.js' : '/app.js'}"></script><link rel="stylesheet" href="/style.css"></html>`); return; }
    if (pathname === '/外部资源') { response.end('<!doctype html><html><body><p>本地内容</p><script src="https://example.com/禁止.js"></script></body></html>'); return; }
    if (pathname === '/外部跳转') { response.writeHead(302, { Location: 'https://example.com' }); response.end(); return; }
    const file = pathname === '/异常' ? '异常.html' : pathname === '/' ? '正常.html' : null;
    if (!file) { response.writeHead(404); response.end('没有这个文件'); return; }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(await readFile(path.join(root, 'test/fixtures/checker', file)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('默认拒绝外网和非 HTTP 页面，且不创建输出', async () => {
  for (const url of ['https://example.com', 'file:///tmp/页面.html']) {
    await assert.rejects(inspectPage({ url, out: await temporary(), noMeasure: true }), /仅允许|HTTP/);
  }
});

test('以127开头的域名不是回环IP，校验阶段即拒绝且不联网', async () => {
  await assert.rejects(inspectPage({ url: 'http://127.example.com/', out: await temporary(), chromePath: '/不存在的浏览器', noMeasure: true }), /仅允许/);
});

test('输出路径已有文件时明确拒绝', async () => {
  const out = path.join(await temporary(), '证据');
  await writeFile(out, '这是文件');
  await assert.rejects(inspectPage({ url: 'http://127.0.0.1:1', out, noMeasure: true }), /目录/);
});

test('系统浏览器缺失保留未运行状态，CLI 退出 2', async () => {
  const out = await temporary();
  const report = await inspectPage({ url: 'http://127.0.0.1:1', out, chromePath: '/不存在的浏览器', noMeasure: true });
  assert.equal(report.browser.status, 'not_run');
  assert.equal(report.status, 'not_run');
  assert.equal(report.measure.status, 'not_run');
  const cli = spawnSync(process.execPath, [script, '--url', 'http://127.0.0.1:1', '--out', out, '--no-measure'], { env: { ...process.env, CHROME_PATH: '/不存在的浏览器' }, encoding: 'utf8' });
  assert.equal(cli.status, 2, cli.stderr);
  assert.equal(JSON.parse(await readFile(path.join(out, 'report.json'), 'utf8')).status, 'not_run');
});

test('正常页跨宽度截图，未运行分寸不能得到整体通过', async t => {
  const url = await serve(t);
  const out = await temporary();
  const report = await inspectPage({ url, out, widths: [360, 768], noMeasure: true });
  assert.equal(report.browser.status, 'pass', report.browser.reason);
  assert.equal(report.pages.length, 2);
  assert.ok(report.pages.every(page => page.status === 'pass'), JSON.stringify(report.pages));
  assert.equal(report.status, 'not_run');
  assert.equal(report.chineseAcceptance, 'not_run');
  for (const page of report.pages) assert.ok((await readFile(page.screenshot)).length > 100);
});

test('明确的 1px 读屏文本隐藏模式不会误报裁切或丢失按钮名称', async t => {
  const url = await serve(t);
  const report = await inspectPage({ url, out: await temporary(), widths: [390], noMeasure: true });
  assert.equal(report.pages[0].status, 'pass', JSON.stringify(report.pages[0].findings));
  assert.ok(!report.pages[0].findings.some(item => ['clipped_content', 'unnamed_control'].includes(item.code)));
});

test('异常页报告溢出、裁切、坏图、名称、链接和页面异常', async t => {
  const url = await serve(t);
  const report = await inspectPage({ url: `${url}/异常`, out: await temporary(), widths: [390], noMeasure: true });
  assert.equal(report.status, 'fail');
  const codes = report.pages[0].findings.map(item => item.code);
  for (const code of ['horizontal_overflow', 'clipped_content', 'broken_image', 'unnamed_control', 'empty_href', 'pageerror']) assert.ok(codes.includes(code), code);
});

test('CLI 遇到真实页面问题退出 1', async t => {
  const url = await serve(t);
  const out = await temporary();
  const exitCode = await new Promise(resolve => {
    const child = spawn(process.execPath, [script, '--url', `${url}/异常`, '--out', out, '--widths', '390', '--no-measure'], { stdio: 'ignore' });
    child.on('close', resolve);
  });
  assert.equal(exitCode, 1);
  assert.equal(JSON.parse(await readFile(path.join(out, 'report.json'), 'utf8')).status, 'fail');
});

async function adapter(version, summary, exitCode = 0) {
  const folder = await temporary();
  const cli = path.join(folder, '分寸入口.mjs');
  await writeFile(cli, `import { writeFileSync } from 'node:fs';\nif(process.argv.includes('--version')){console.log(${JSON.stringify(version)});}else{const raw={tool:{name:'measure-cjk',version:${JSON.stringify(version)}},summary:${JSON.stringify(summary)},run:{render:{problems:[]}}};const index=process.argv.indexOf('--out');writeFileSync(process.argv[index+1],JSON.stringify(raw));console.log('原始标准输出');process.exitCode=${exitCode};}\n`);
  return cli;
}

test('分寸 0.1.0 保留原始 JSON 和退出码，规则失败传递为失败', async t => {
  const url = await serve(t);
  const measureCli = await adapter('0.1.0', { status: 'fail', errors: 1, files: 1, cjk_files: 1 }, 1);
  const report = await inspectPage({ url, out: await temporary(), widths: [360], measureCli });
  assert.equal(report.measure.status, 'fail');
  assert.equal(report.measure.exitCode, 1);
  assert.equal(report.measure.raw.summary.errors, 1);
  assert.match(report.measure.stdout, /原始标准输出/);
  assert.equal(report.status, 'fail');
});

test('不支持的分寸版本保持未知，不能合并为通过', async t => {
  const url = await serve(t);
  const report = await inspectPage({ url, out: await temporary(), widths: [360], measureCli: await adapter('0.2.0', { status: 'pass' }) });
  assert.equal(report.measure.status, 'unknown');
  assert.equal(report.status, 'unknown');
});

test('外部资源与跳转在本地默认模式中被阻断', async t => {
  const url = await serve(t);
  for (const route of ['/外部资源', '/外部跳转']) {
    const report = await inspectPage({ url: `${url}${route}`, out: await temporary(), widths: [360], noMeasure: true });
    assert.notEqual(report.pages[0].status, 'pass');
    assert.ok(report.pages[0].blockedRequests?.some(value => value.startsWith('https://example.com')));
  }
});

test('缺少分寸安装时明确未运行，不发起自动安装', async t => {
  const url = await serve(t);
  const report = await inspectPage({ url, cwd: await temporary(), out: await temporary(), widths: [360] });
  assert.equal(report.measure.status, 'not_run');
  assert.equal(report.status, 'not_run');
});

test('真实分寸 0.1.0 接口产生可仲裁的原始结果', async t => {
  const url = await serve(t);
  const report = await inspectPage({ url, out: await temporary(), widths: [360] });
  assert.ok(['pass', 'fail', 'not_applicable'].includes(report.measure.status), JSON.stringify(report.measure));
  assert.equal(report.measure.raw.tool.version, '0.1.0');
});

test('完整通过只对应已运行的自动规则，人工验收仍未运行', async t => {
  const url = await serve(t);
  const report = await inspectPage({ url, out: await temporary(), widths: [360], measureCli: await adapter('0.1.0', { status: 'pass', errors: 0, files: 1, cjk_files: 1 }) });
  assert.equal(report.status, 'pass');
  assert.equal(report.manualAcceptance, 'not_run');
  assert.ok(report.limitations.some(value => value.includes('审美评分')));
});

test('分寸结果自相矛盾时保持未知', async t => {
  const url = await serve(t);
  const report = await inspectPage({ url, out: await temporary(), widths: [360], measureCli: await adapter('0.1.0', { status: 'pass', errors: 1, files: 1, cjk_files: 1 }) });
  assert.equal(report.measure.status, 'unknown');
  assert.equal(report.status, 'unknown');
});

test('主脚本或样式404及断连不能在分寸通过后变成整体通过', async t => {
  const url = await serve(t);
  for (const route of ['/资源缺失', '/资源缺失断连']) {
    const report = await inspectPage({ url: url + encodeURI(route), out: await temporary(), widths: [390], measureCli: await adapter('0.1.0', { status: 'pass', errors: 0, files: 1, cjk_files: 1 }) });
    assert.equal(report.status, 'fail');
    assert.ok(report.pages[0].findings.some(item => item.code === 'resource_http_error' && item.url.endsWith('/style.css')));
    assert.ok(report.pages[0].findings.some(item => route.includes('断连') ? item.code === 'resource_request_failed' && decodeURI(item.url).endsWith('/断连.js') : item.code === 'resource_http_error' && item.url.endsWith('/app.js')));
  }
});

test('分寸不适用不能被合并为中文验收通过', async t => {
  const url = await serve(t);
  const report = await inspectPage({ url, out: await temporary(), widths: [360], measureCli: await adapter('0.1.0', { status: 'skipped', errors: 0, files: 1, cjk_files: 0 }) });
  assert.equal(report.measure.status, 'not_applicable');
  assert.equal(report.status, 'not_applicable');
});

test('项目配置在项目内证据目录下被显式传给真实分寸', async t => {
  const url = await serve(t);
  const cwd = await temporary();
  const configuration = path.join(cwd, 'measure.config.json');
  await writeFile(configuration, JSON.stringify({ schema_version: '1.0.0', thresholds: { min_font_px_body: 18 } }));
  const out = path.join(cwd, '证据');
  await mkdir(out);
  const report = await inspectPage({ url, cwd, out, widths: [360], measureCli: path.join(root, 'node_modules/.bin/measure-cjk') });
  assert.ok(['pass', 'fail'].includes(report.measure.status), JSON.stringify(report.measure));
  assert.equal(report.measure.configuration.path, configuration);
  assert.equal(report.measure.raw.run.threshold_overrides.min_font_px_body, 18);
  assert.ok(report.measure.args.includes('--config'));
});

test('外置证据目录与项目配置根限制冲突时明确未知', async t => {
  const url = await serve(t);
  const cwd = await temporary();
  await writeFile(path.join(cwd, 'measure.config.json'), '{}');
  const report = await inspectPage({ url, cwd, out: await temporary(), widths: [360], measureCli: await adapter('0.1.0', { status: 'pass', errors: 0, files: 1, cjk_files: 1 }) });
  assert.equal(report.measure.status, 'unknown');
  assert.equal(report.status, 'unknown');
  assert.match(report.measure.reason, /项目内/);
});

test('复用输出目录时不能读取上一次分寸的旧通过结果', async t => {
  const url = await serve(t);
  const out = await temporary();
  await writeFile(path.join(out, 'measure-raw.json'), JSON.stringify({ tool: { name: 'measure-cjk', version: '0.1.0' }, summary: { status: 'pass', files: 1 }, run: { render: { problems: [] } } }));
  const measureCli = path.join(await temporary(), '空结果.mjs');
  await writeFile(measureCli, "if(process.argv.includes('--version')) console.log('0.1.0');");
  const report = await inspectPage({ url, out, widths: [360], measureCli });
  assert.equal(report.measure.status, 'unknown');
  assert.equal(report.status, 'unknown');
});

test('重复检查保留前一轮失败截图与完整报告', async t => {
  const url = await serve(t);
  const out = await temporary();
  const first = await inspectPage({ url: `${url}/异常`, out, widths: [390], noMeasure: true });
  const pixels = await readFile(first.pages[0].screenshot);
  const second = await inspectPage({ url, out, widths: [390], noMeasure: true });
  assert.notEqual(first.pages[0].screenshot, second.pages[0].screenshot);
  assert.deepEqual(await readFile(first.pages[0].screenshot), pixels);
  assert.equal(JSON.parse(await readFile(path.join(first.evidenceDirectory, 'report.json'), 'utf8')).status, 'fail');
});

test('标题报告保留浏览器真实行片段而非按字符数猜断行', async t => {
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>h1{font:20px/2 monospace;width:4em;word-break:break-all;margin:0}</style><h1>中文标题逐行观察</h1></html>');
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise(done => server.close(done)));
  const report = await inspectPage({ url: `http://127.0.0.1:${server.address().port}`, out: await temporary(), widths: [390], noMeasure: true });
  const heading = report.pages[0].headings[0];
  assert.equal(heading.text, '中文标题逐行观察');
  assert.ok(heading.lines.length >= 2);
  assert.equal(heading.lines.join(''), heading.text);
  assert.ok(heading.fontFamily);
});

test('竖排标题不占用十二个横排标题的测量额度', async t => {
  const server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<html lang="zh-CN"><meta charset="utf-8">${'<h2 style="writing-mode:vertical-rl">竖排</h2>'.repeat(12)}<h1>横排标题</h1></html>`);
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise(done => server.close(done)));
  const report = await inspectPage({ url: `http://127.0.0.1:${server.address().port}`, out: await temporary(), widths: [390], noMeasure: true });
  assert.deepEqual(report.pages[0].headings.map(item => item.text), ['横排标题']);
});

test('CLI 帮助使用中文，不依赖浏览器', () => {
  const cli = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  assert.equal(cli.status, 0);
  assert.match(cli.stdout, /用法/);
  assert.match(cli.stdout, /--allow-remote/);
});

test('默认检查实际包含320像素，避免漏掉最窄重排状态', async t => {
  const url=await serve(t);
  const report=await inspectPage({url,out:await temporary(),noMeasure:true});
  assert.ok(report.widths.includes(320));
  assert.equal(report.pages.find(page=>page.width===320)?.status,'pass');
});
