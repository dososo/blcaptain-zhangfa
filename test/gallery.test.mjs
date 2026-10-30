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
    for (const width of [320, 390, 523, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px有根溢出`);
      assert.ok(await page.locator('#hero-title').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${width}px标题超出行宽`);
    }
    const longText = '从页面结构到中文阅读节奏的设计方法，让真实内容决定标题、行宽、留白与动作的关系。即使标题变长，也要保留每一个字，并让段落继续自然流动。';
    await page.locator('#type-input').fill(longText);
    assert.equal(await page.locator('#type-output').textContent(), longText, '长输入不得被静默截断');
    assert.equal(await page.locator('#type-input').inputValue(), longText);
    assert.ok((await page.locator('#type-output').textContent()).length > 42);
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

test('同页打磨在同一窗口切换前后，键盘与原始入口保留', async () => {
  const server = await startServer({ port: 0 });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForSelector('#refinement-cases[data-state="ready"]');
    assert.equal(await page.locator('.refinement-card').count(), 5);
    const viewer = page.locator('.refinement-viewer').first();
    const window = viewer.locator('.refinement-window');
    await window.scrollIntoViewIfNeeded();
    await viewer.locator('img').last().evaluate(img => img.decode());
    const originalBox = await window.boundingBox();
    assert.equal(await viewer.getAttribute('data-selected'), 'after');
    assert.equal(await window.locator('figure:visible').count(), 1);
    assert.equal(await window.locator('img:visible').evaluate(img => img.getBoundingClientRect().width), 390, '截图不应随手机窗口缩成小字');
    await window.evaluate(el => { el.scrollTop = 180; el.scrollLeft = 30; });
    await viewer.locator('button').first().click();
    await viewer.locator('img').first().evaluate(img => img.decode());
    assert.equal(await viewer.getAttribute('data-selected'), 'before');
    assert.equal(await window.locator('figure:visible').count(), 1);
    assert.equal(await window.evaluate(el => el.scrollTop), 180, '前后切换应保留观察高度');
    assert.equal(await window.evaluate(el => el.scrollLeft), 30, '前后切换应保留横向位置');
    assert.equal((await window.boundingBox()).height, originalBox.height, '前后图不应改变观察窗口高度');
    assert.equal(await viewer.locator('.refinement-links a').last().getAttribute('href'), `${base}/history/v0.1.0/runs/01/full/index.html`);
    assert.match(await viewer.locator('.refinement-links a').first().getAttribute('href'), /01-390-before.webp$/);
    await viewer.locator('button').first().press('ArrowRight');
    assert.equal(await viewer.getAttribute('data-selected'), 'after');
    assert.equal(await viewer.locator('button').last().evaluate(el => el === document.activeElement), true);
    assert.match(await viewer.locator('.refinement-caption').innerText(), /视觉审查后修订/);
    assert.equal(await viewer.locator('.refinement-links a').last().getAttribute('href'), `${base}/runs/01/full/index.html`);
    assert.ok(await page.locator('#refinements').evaluate(el => el.getBoundingClientRect().height < 6500), '五组对比不应重新堆成超长图墙');
    for (const width of [320, 390, 523, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px有根溢出`);
      for (const selector of ['.hero-positioning', '.refinement-card p', '.refinement-toggle button', '.evidence-status', '.condition-tabs button', '.preview-caption']) {
        assert.ok(await page.locator(selector).first().evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 14), `${width}px ${selector}重要文字小于14px`);
      }
    }
  } finally {
    await browser.close();
    await new Promise(done => server.close(done));
  }
});

test('产物、技术、模型视觉与人工状态分列，不把失败或缺失审查写成通过', async () => {
  const server = await startServer({ port: 0 });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    const status = page.locator('#evidence-status');
    assert.match(await status.innerText(), /产物：.*视觉修订版/);
    assert.match(await status.innerText(), /技术：所列自动检查通过/);
    assert.match(await status.innerText(), /模型视觉：已完成本批次四宽审查/);
    assert.match(await status.innerText(), /人工与真机：待验（MANUAL_PENDING）/);
    assert.doesNotMatch(await page.locator('.case-item').first().innerText(), /待检查/);
    await page.locator('[data-arm="control"]').click();
    assert.match(await status.innerText(), /技术：自动检查发现问题/);
    assert.match(await status.innerText(), /模型视觉：本轮未进行独立视觉审查/);
    assert.match(await status.innerText(), /人工与真机：待验/);
    await page.route('**/review-v2.json', route => route.abort());
    await page.reload({ waitUntil: 'networkidle' });
    assert.match(await status.innerText(), /模型视觉：本轮审查记录未读取，状态待确认/);
  } finally {
    await browser.close();
    await new Promise(done => server.close(done));
  }
});

test('窄屏阅读压力下保留关键说明与操作，不靠根裁切消除长状态标识溢出', async () => {
  const server = await startServer({ port: 0 });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const mode of ['文字间距覆盖', '初始计算字号翻倍']) {
      await page.goto(base, { waitUntil: 'networkidle' });
      if (mode === '文字间距覆盖') await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
      else await page.evaluate(() => {
        const sizes = [...document.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(el => [el, parseFloat(getComputedStyle(el).fontSize)]);
        for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`;
      });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${mode}不应根溢出`);
      assert.ok(await page.locator('#evidence-status').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${mode}状态说明应完整换行`);
      assert.equal(await page.locator('.hero-primary').getAttribute('href'), '#refinements');
      assert.equal(await page.locator('.hero-actions a').last().getAttribute('href'), '#get-skill');
      assert.equal(await page.locator('#get-skill').count(), 1);
    }
  } finally {
    await browser.close();
    await new Promise(done => server.close(done));
  }
});
