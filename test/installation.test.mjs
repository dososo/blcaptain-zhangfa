import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { startServer } from '../scripts/serve.mjs';

test('ZIP安装到独立目录后检查器仍能使用调用项目的依赖', async () => {
  const target = await mkdtemp(join(tmpdir(), 'zhangfa-installed-'));
  execFileSync(process.execPath, ['scripts/package.mjs', '--out', target]);
  execFileSync('python3', ['-c', 'import zipfile,sys;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', join(target, 'blcaptain-zhangfa-0.1.0.zip'), target]);
  const server = await startServer({ root: resolve('test/fixtures/checker'), port: 0 });
  try {
    const out = join(target, '证据');
    const code = await new Promise(done => {
      const child = spawn(process.execPath, [join(target, 'blcaptain-zhangfa/scripts/check-page.mjs'), '--url', `http://127.0.0.1:${server.address().port}/正常.html`, '--out', out, '--widths', '390'], { cwd: process.cwd(), stdio: 'ignore' });
      child.on('close', done);
    });
    assert.ok([0, 1].includes(code), '不能因为独立安装而缺失依赖或返回环境错误');
    const report = JSON.parse(await readFile(join(out, 'report.json'), 'utf8'));
    assert.equal(report.browser.status, 'pass');
    assert.equal(report.measure.version, '0.1.0');
    assert.ok(report.pages[0].headings.length);
  } finally { await new Promise(done => server.close(done)); }
});
