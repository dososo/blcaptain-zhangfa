import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const catalogPath = resolve(root, 'site/cases.json');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const folder = resolve(root, 'evidence/generation');
const records = [];
for (const name of await readdir(folder)) {
  const match = /^(control|measure|full)-(development|remaining)\.json$/.exec(name);
  if (!match) continue;
  const raw = JSON.parse(await readFile(resolve(folder, name), 'utf8'));
  const entries = raw.runs || raw.items || raw.记录 || [];
  records.push({ arm: match[1], name, raw, entries, ids: (raw.题号 || entries.map(item => item.id || item.题号)).map(String) });
}
await mkdir(resolve(root, 'site/records'), { recursive: true });
let count = 0;
for (const item of catalog.cases) {
  const report = { 题号: item.id, 模式: item.mode, 任务: item.task, 内容包: `../../bench/briefs/${item.id}.json`, 说明: '这是批次生成示例。各条件分开会话，组内共享上下文；不是逐题独立统计胜率实验。作者自测、独立复核和人工验收分别记录。', 人工验收: 'MANUAL_PENDING', 条件: [] };
  for (const arm of item.arms) {
    const record = records.find(record => record.arm === arm.id && record.ids.includes(item.id));
    if (!record) continue;
    const path = resolve(root, `site/runs/${item.id}/${arm.id}/index.html`);
    try { if (!(await stat(path)).size) continue; } catch { continue; }
    arm.url = `./runs/${item.id}/${arm.id}/index.html`;
    arm.status = 'generated';
    arm.protocolNotes = record.raw.protocolDeviations || [];
    let independent = null;
    try { independent = JSON.parse(await readFile(resolve(root, `evidence/qa/${item.id}-${arm.id}.json`), 'utf8')); } catch {}
    arm.technicalStatus = independent?.status || 'not_run';
    const entry = record.entries.find(entry => String(entry.id || entry.题号) === item.id) || {};
    const started = entry.开始时间 || entry.startedAt || record.raw.开始时间 || record.raw.startedAt || '未记录';
    const finished = entry.结束时间 || entry.finishedAt || entry.endedAt || record.raw.结束时间 || record.raw.finishedAt || record.raw.endedAt || '未记录';
    const files = [];
    for (const name of await readdir(resolve(path, '..'))) {
      const file = resolve(path, '..', name);
      if ((await stat(file)).isFile() && !name.endsWith('.mjs')) files.push({ 文件: name, sha256: createHash('sha256').update(await readFile(file)).digest('hex') });
    }
    report.条件.push({ 条件: arm.label, 产物: `../runs/${item.id}/${arm.id}/index.html`, 类型: item.mode === '只审阅' ? '审阅报告，不是替代网页' : '实际生成页面', 流程偏差: arm.protocolNotes, 模型完整版本: record.raw.模型完整版本 || record.raw.modelFullVersion || '未暴露', 批次开始时间: started, 批次结束时间: finished, 作者记录脱敏副本: `./runs/${record.name}`, 作者自测性质: '由该条件的生成智能体执行，不冒充独立人类验收', 方向理由: entry.方向理由 || entry.direction || null, 任务与操作: entry.actions || entry.实际操作 || entry.操作 || entry.checks?.interaction || [], 修复记录: entry.repairs || entry.repairBudget || entry.已修复失败记录 || entry.额外修复 || entry.修复 || '见生成记录脱敏副本', 已知问题与边界: entry.knownIssues || entry.knownLimitations || entry.已知问题 || entry.已知缺陷 || record.raw.已知问题 || [], 独立自动复核: independent || { status: 'not_run' }, 文件: files });
    count++;
  }
  if (report.条件.length) {
    item.status = 'generated';
    item.kind = '真实智能体试验';
    item.evidenceUrl = `./records/${item.id}.json`;
    await writeFile(resolve(root, `site/records/${item.id}.json`), JSON.stringify(report, null, 2) + '\n');
  }
}
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log(`已核对${count}份实际产物；保留生成与技术、人工状态的区别。`);
