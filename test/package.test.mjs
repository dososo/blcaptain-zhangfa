import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { startServer } from '../scripts/serve.mjs';
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('本地预览只服务指定站点且拒绝路径越界', async () => {
  const root = await mkdtemp(join(tmpdir(), 'zhangfa-serve-'));
  await writeFile(join(root, 'index.html'), '<h1>中文页面</h1>');
  const server = await startServer({ root, port: 0 });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal(await (await fetch(base)).text(), '<h1>中文页面</h1>');
    assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status, 403);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('技能归档可重现且仅含运行所需内容', async () => {
  const output = await mkdtemp(join(tmpdir(), 'zhangfa-pack-'));
  const args = ['scripts/package.mjs', '--out', output];
  execFileSync(process.execPath, args);
  const first = await readFile(join(output, `blcaptain-zhangfa-${version}.zip`));
  execFileSync(process.execPath, args);
  assert.deepEqual(await readFile(join(output, `blcaptain-zhangfa-${version}.zip`)), first);
  const list = JSON.parse(execFileSync('python3', ['-c', 'import zipfile,json,sys;print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))', join(output, `blcaptain-zhangfa-${version}.zip`)], { encoding: 'utf8' }));
  assert.ok(list.includes('blcaptain-zhangfa/SKILL.md'));
  assert.ok(list.includes('blcaptain-zhangfa/scripts/check-page.mjs'));
  assert.ok(list.includes('blcaptain-zhangfa/LICENSE'));
  assert.ok(list.every(path => path.startsWith('blcaptain-zhangfa/') && !path.includes('..')));
  assert.ok(!list.some(path => /research|node_modules|bench|方案|案例与评测/.test(path)));
});
