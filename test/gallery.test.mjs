import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../scripts/serve.mjs';

test('作品画廊保留真实页面入口，窄屏与图片失败下仍可阅读', async () => {
  const server = await startServer({ port: 0 });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const base = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    for (const selector of ['.hero-work img', '.work-card img']) {
      const images = page.locator(selector);
      for (let i = 0; i < await images.count(); i++) {
        await images.nth(i).scrollIntoViewIfNeeded();
        assert.ok(await images.nth(i).evaluate(img => img.complete && img.naturalWidth === 1440));
      }
    }
    const links = await page.locator('.hero-work>a, .work-picture').evaluateAll(nodes => nodes.map(a => a.getAttribute('href')));
    assert.deepEqual(links, ['./runs/05/full/', './runs/21/full/', './runs/17/full/']);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px有根溢出`);
      assert.ok(await page.locator('#hero-title').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${width}px标题超出行宽`);
    }
    await page.locator('#type-input').fill('从页面结构到中文阅读节奏的设计方法，让真实内容决定标题、行宽、留白与动作的关系。');
    await page.locator('#type-layout').selectOption('narrow');
    await page.locator('#typesetting').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#type-canvas').evaluate(canvas => {
      const text = canvas.querySelector('#type-output').getBoundingClientRect();
      const box = canvas.getBoundingClientRect();
      return text.bottom < box.bottom && text.left >= box.left && text.right <= box.right;
    }), '长中文试排不应被固定高度裁切');
    await page.route('**/assets/gallery/*', route => route.abort());
    await page.reload({ waitUntil: 'networkidle' });
    assert.match(await page.locator('#hero-title').innerText(), /好内容/);
    assert.equal(await page.locator('.hero-work>a').getAttribute('href'), './runs/05/full/');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise(done => server.close(done));
  }
});

test('预览切换期间遮住旧页，加载完成后展示目标页', async () => {
  const server = await startServer({ port: 0 });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  const base = `http://127.0.0.1:${server.address().port}`;
  let resume;
  const pending = new Promise(done => { resume = done; });
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.route('**/runs/01/control/index.html', async route => { await pending; await route.continue(); });
    await page.locator('[data-arm="control"]').click();
    assert.equal(await page.locator('#frame-loading').isVisible(), true);
    assert.equal(await page.locator('#case-frame').evaluate(el => getComputedStyle(el).visibility), 'hidden');
    resume();
    await page.waitForFunction(() => document.querySelector('#frame-loading').hidden);
    assert.equal(await page.locator('#case-frame').evaluate(el => getComputedStyle(el).visibility), 'visible');
  } finally {
    resume();
    await browser.close();
    await new Promise(done => server.close(done));
  }
});

test('同页打磨使用记录中的两侧素材，窄屏单列且保留前后页面入口', async () => {
  const server = await startServer({ port: 0 });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await page.route('**/refinements.json', route => route.fulfill({ json: { cases: [{ id: '05', title: '中文书名保持完整', description: '<img src=x>同页面两侧采用同一内容。', width: 390, beforeImage: './assets/gallery/作品-05.jpg', afterImage: './assets/gallery/作品-17.jpg', beforeUrl: './history/v0.1.0/runs/05/full/index.html', afterUrl: './runs/05/full/index.html' }] } }));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForSelector('#refinement-cases[data-state="ready"]');
    assert.equal(await page.locator('.refinement-card').count(), 1);
    assert.equal(await page.locator('.refinement-card>div:first-child img').count(), 0, '记录文字不能当HTML执行');
    const figures = page.locator('.refinement-images figure');
    const before = await figures.nth(0).boundingBox();
    const after = await figures.nth(1).boundingBox();
    assert.ok(after.y > before.y + before.height, '窄屏应单列排放');
    assert.match(await figures.nth(0).locator('figcaption').innerText(), /修复前 · 390 像素/);
    assert.match(await figures.nth(1).locator('figcaption').innerText(), /修复后 · 390 像素/);
    assert.equal(await figures.nth(0).locator('figcaption a').getAttribute('href'), `${base}/history/v0.1.0/runs/05/full/index.html`);
    assert.equal(await figures.nth(1).locator('figcaption a').getAttribute('href'), `${base}/runs/05/full/index.html`);
  } finally {
    await browser.close();
    await new Promise(done => server.close(done));
  }
});
