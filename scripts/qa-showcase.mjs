import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectPage } from '../skills/blcaptain-zhangfa/scripts/check-page.mjs';

const root = resolve(import.meta.dirname, '..');
const catalog = JSON.parse(await readFile(resolve(root, 'site/cases.json'), 'utf8'));
await mkdir(resolve(root, 'evidence/qa'), { recursive: true });
const args = process.argv.slice(2);
const armFlag = args.indexOf('--arm');
const selectedArm = armFlag >= 0 ? args[armFlag + 1] : null;
if (armFlag >= 0 && !['control', 'measure', 'full'].includes(selectedArm)) throw new Error('--arm 需要指定 control、measure 或 full。');
const selected = args.filter((value, index) => index !== armFlag && index !== armFlag + 1 || armFlag < 0);
for (const item of catalog.cases) {
  if (item.mode === '只审阅' || selected.length && !selected.includes(item.id)) continue;
  for (const arm of item.arms) {
    if (selectedArm && arm.id !== selectedArm) continue;
    if (!['generated', 'verified'].includes(arm.status) || !arm.url) continue;
    const output = resolve(root, `evidence/qa/${item.id}-${arm.id}.json`);
    const url = new URL(arm.url, 'http://127.0.0.1:4179/').href;
    const project = resolve(root, `site/runs/${item.id}/${arm.id}`);
    const raw = await inspectPage({ url, out: resolve(project, '.zhangfa-evidence'), widths: [320, 390, 1440], cwd: project, measureCli: resolve(root, 'node_modules/.bin/measure-cjk') });
    const summary = {
      status: raw.status,
      检查时间: raw.finishedAt,
      浏览器: raw.browser.version || null,
      视口宽度: raw.widths,
      页面: raw.pages.map(page => ({ 宽度: page.width, 状态: page.status, 资源稳定: page.resourcesReady, 问题: page.findings, 标题行片段: page.headings || [] })),
      分寸: { 状态: raw.measure.status, 版本: raw.measure.version || null, 错误: raw.measure.raw?.summary?.errors ?? null, 警告: raw.measure.raw?.summary?.warns ?? null, 覆盖: raw.measure.raw?.run?.render?.widths || [], 规则计数: (raw.measure.raw?.findings || []).reduce((counts, finding) => { counts[finding.rule] = (counts[finding.rule] || 0) + 1; return counts; }, {}) },
      主任务: '作者自测见生成记录；本自动检查不推断全部主任务通过',
      人工视觉与真机: 'MANUAL_PENDING',
      原始证据: '保存在本地每个产物的.zhangfa-evidence目录，发布摘要不携带本机路径',
      局限: raw.limitations
    };
    await writeFile(output, JSON.stringify(summary, null, 2) + '\n');
    console.log(`${item.id}/${arm.id}：${summary.status}，分寸错误${summary.分寸.错误}、警告${summary.分寸.警告}`);
  }
}
