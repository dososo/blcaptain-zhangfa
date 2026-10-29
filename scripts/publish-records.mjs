import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'site/records/runs');
await mkdir(out, { recursive: true });
function publicValue(value) {
  if (Array.isArray(value)) return value.map(publicValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, publicValue(item)]));
  if (typeof value !== 'string') return value;
  return value.replaceAll(root, '.').replace(/\/private\/var\/folders\/[^\s"']+|\/var\/folders\/[^\s"']+/g, '本机临时目录（已隐去）').replace(/\/Users\/manxiaochu\/[^\s"']+|\/private\/tmp\/[^\s"']+|\/tmp\/(?:blcaptain|full-remaining)[^\s"']*/g, '本机研究或临时路径（已隐去）');
}
for (const arm of ['control', 'measure', 'full']) for (const batch of ['development', 'remaining']) {
  const name = `${arm}-${batch}.json`;
  const raw = JSON.parse(await readFile(resolve(root, 'evidence/generation', name), 'utf8'));
  await writeFile(resolve(out, name), JSON.stringify({ 公开说明: '生成记录脱敏副本。只移除本机绝对路径；未补写成本、模型版本或未执行的检查。截图等原始二进制证据保留本地，不在此链接中分发。', 记录: publicValue(raw) }, null, 2) + '\n');
}
for (const id of ['04', '10', '18', '24']) {
  const dest = resolve(root, 'site/inputs', id);
  await mkdir(dest, { recursive: true });
  await copyFile(resolve(root, 'bench/inputs', id, 'index.html'), resolve(dest, 'index.html'));
}
console.log('六份生成记录脱敏副本与四份只审阅输入已准备；原始本地证据未覆盖。');
