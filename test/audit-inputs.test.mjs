import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { startServer } from '../scripts/serve.mjs';

test('四个只审阅输入的八项预置缺陷在真实浏览器中成立', async () => {
  const server = await startServer({ root: resolve('bench/inputs'), port: 0 });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await page.goto(`${base}/04/`);
    assert.ok(await page.locator('.package-name').evaluate(el => el.scrollWidth > el.clientWidth));
    const href = await page.getByRole('link', { name: '迁移说明' }).getAttribute('href');
    assert.equal(await page.locator(href).count(), 0);
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => { window.copiedText = value; } } }));
    await page.goto(`${base}/10/`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
    await page.getByRole('button', { name: '复制检查命令' }).click();
    assert.ok(!(await page.evaluate(() => window.copiedText)).endsWith('--verbose'));
    assert.ok((await page.locator('#command').textContent()).endsWith('--verbose'));
    await page.goto(`${base}/18/`);
    assert.equal(await page.locator('.prerequisites').isVisible(), false);
    assert.equal(await page.locator('.hover-only span').getAttribute('tabindex'), null);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.prerequisites').isVisible(), false);
    await page.getByRole('button', { name: '本地模拟申请' }).click();
    assert.equal(await page.locator('#result').textContent(), '已录取');
    await page.goto(`${base}/24/`);
    assert.equal(await page.locator('.terms').evaluate(el => getComputedStyle(el).fontSize), '8px');
    await page.getByRole('button', { name: '提交本地演示需求' }).click();
    assert.match(await page.locator('#result').textContent(), /本地模拟咨询已记录/);
  } finally {
    await browser.close();
    await new Promise(done => server.close(done));
  }
});
