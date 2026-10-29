import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const skill = resolve(root, 'skills/blcaptain-zhangfa');
const problems = [];
async function files(folder) {
  const output = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const p = resolve(folder, entry.name);
    if (entry.isSymbolicLink()) problems.push(`技能包不接受符号链接：${relative(root, p)}`);
    else if (entry.isDirectory()) output.push(...await files(p));
    else output.push(p);
  }
  return output;
}
const all = await files(skill);
for (const file of all) {
  const text = await readFile(file, 'utf8');
  if (/impeccable|hallmark|huashu|elayadesign|ai-design-skills/i.test(text)) problems.push(`技能正文含研究对象：${relative(root, file)}`);
  if (/\/Users\/|\/private\/tmp\/|sk-proj-[a-zA-Z0-9]/.test(text)) problems.push(`技能含本机路径或疑似密钥：${relative(root, file)}`);
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || target.includes('://')) continue;
    try { await stat(resolve(dirname(file), target)); } catch { problems.push(`引用缺失：${relative(root, file)} → ${target}`); }
  }
  if (file.endsWith('.mjs')) execFileSync(process.execPath, ['--check', file]);
}
const main = await readFile(resolve(skill, 'SKILL.md'), 'utf8');
if (!/^---\nname: blcaptain-zhangfa\ndescription: .+/m.test(main)) problems.push('技能元数据缺失或名称不一致。');
const cases = JSON.parse(await readFile(resolve(root, 'site/cases.json'), 'utf8')).cases;
if (cases.length !== 24 || new Set(cases.map(item => item.id)).size !== 24) problems.push('场景索引数量或编号错误。');
const modes = {};
for (const item of cases) {
  const brief = JSON.parse(await readFile(resolve(root, `bench/briefs/${item.id}.json`), 'utf8'));
  modes[brief.mode] = (modes[brief.mode] || 0) + 1;
  if (brief.id !== item.id) problems.push(`内容包编号不一致：${item.id}`);
  for (const arm of item.arms) {
    if (['generated', 'verified'].includes(arm.status)) {
      if (!arm.url || /^(?:https?:)?\/\//.test(arm.url)) { problems.push(`产物必须有本地地址：${item.id}/${arm.id}`); continue; }
      const file = resolve(root, 'site', arm.url);
      if (!file.startsWith(resolve(root, 'site') + '/')) problems.push(`产物路径越界：${item.id}/${arm.id}`);
      else try { if ((await stat(file)).size === 0) problems.push(`空产物：${item.id}/${arm.id}`); } catch { problems.push(`产物不存在：${item.id}/${arm.id}`); }
    } else if (arm.status === 'planned' && arm.url) problems.push(`待生成条目不应假装有产物：${item.id}/${arm.id}`);
  }
}
if (modes.新建 !== 16 || modes.受限改版 !== 4 || modes.只审阅 !== 4) problems.push('三种模式的范围与计划不一致。');
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log(`验证通过：${all.length} 个技能文件，引用闭合，24 个内容包与模式一致，已标记产物存在。此检查不等于视觉或人工验收。`);
