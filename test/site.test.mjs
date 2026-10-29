import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../scripts/serve.mjs';

test('展示站以真实索引驱动筛选、条件、试排及窄屏布局', async () => {
  const server = await startServer({ port: 0 });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector('#scene-count').textContent === '24');
    assert.equal(await page.locator('.case-item').count(), 24);
    await page.locator('#case-search').fill('餐厅');
    assert.equal(await page.locator('.case-item').count(), 1);
    await page.locator('.case-item').click();
    assert.match(await page.locator('#case-title').textContent(), /餐厅/);
    await page.getByRole('button', { name: /无本技能/ }).click();
    await page.waitForFunction(() => document.querySelector('[data-arm="control"]').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.locator('[data-arm="control"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#type-input').fill('<img src=x onerror=alert(1)>中文');
    assert.equal(await page.locator('#type-output img').count(), 0);
    assert.match(await page.locator('#type-output').textContent(), /<img/);
    await page.locator('#type-layout').selectOption('narrow');
    assert.equal(await page.locator('#type-canvas').getAttribute('data-layout'), 'narrow');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px出现页面溢出`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise(done => server.close(done));
  }
});
