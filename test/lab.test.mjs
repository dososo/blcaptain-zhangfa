import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { startServer } from '../scripts/serve.mjs';

test('十二组局部规则同文案试排、独立样式、键盘交互和窄屏重排', async () => {
  const server = await startServer({ port: 0 });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const base = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(base)) external.push(request.url()); });
  const frame = arm => page.frameLocator(`#${arm}-frame`);
  const choose = async id => {
    await page.locator(`[data-rule="${id}"]`).click();
    for (const arm of ['before', 'after']) await frame(arm).locator(`body[data-rule="${id}"] [data-content]`).waitFor();
  };
  try {
    await page.goto(`${base}/lab/`);
    await frame('after').locator('[data-content]').waitFor();
    assert.equal(await page.locator('#rule-select option').count(), 12);
    assert.match(await page.locator('.boundary').innerText(), /手工规则示意，不计入生成效果实验/);
    const ids = await page.locator('#rule-select option').evaluateAll(options => options.map(option => option.value));
    const cssProperties = {
      title: ['.demo-title', 'maxWidth'], spacing: ['.latin', 'marginLeft'],
      punctuation: ['p', 'lineBreak'], measure: ['p', 'maxWidth'],
      leading: ['p', 'lineHeight'], terms: ['.terms', 'fontSize'],
      emphasis: ['em', 'fontStyle'], button: ['.long-action', 'whiteSpace'],
      numbers: ['td', 'textAlign'], focus: ['.scroll-area', 'paddingBottom']
    };
    for (const id of ids) {
      await choose(id);
      const original = await frame('before').locator('[data-content]').textContent();
      const improved = await frame('after').locator('[data-content]').textContent();
      assert.equal(improved, original, `${id} 两栏没有保留同文案`);
      for (const field of ['variables', 'proves', 'limits']) assert.ok((await page.locator(`#${field}`).innerText()).length > 15);
      if (cssProperties[id]) {
        const [selector, property] = cssProperties[id];
        const values = await Promise.all(['before', 'after'].map(arm => frame(arm).locator(selector).first().evaluate((element, key) => getComputedStyle(element)[key], property)));
        assert.notEqual(values[0], values[1], `${id} 对比参数未改变`);
      }
    }
    await choose('button');
    for (const arm of ['before', 'after']) {
      await frame(arm).locator('.long-action').focus();
      await page.keyboard.press('Enter');
      assert.match(await frame(arm).locator('.feedback').innerText(), /已记录继续申请动作/);
    }
    await choose('fallback');
    for (const arm of ['before', 'after']) {
      await frame(arm).locator('.font-toggle').click();
      assert.equal(await frame(arm).locator('.font-toggle').getAttribute('aria-pressed'), 'true');
      assert.match(await frame(arm).locator('.font-status').innerText(), /未发送或阻断字体请求/);
    }
    const families = await Promise.all(['before', 'after'].map(arm => frame(arm).locator('.font-copy').evaluate(element => getComputedStyle(element).fontFamily)));
    assert.notEqual(families[0], families[1]);
    await choose('focus');
    for (const arm of ['before', 'after']) {
      await frame(arm).locator('.focus-jump').focus();
      await page.keyboard.press('Enter');
      const geometry = await frame(arm).locator('.focus-target').evaluate(element => {
        const target = element.getBoundingClientRect();
        const overlay = document.querySelector('.floating-note').getBoundingClientRect();
        return { focused: document.activeElement === element, bottom: target.bottom, overlayTop: overlay.top };
      });
      assert.equal(geometry.focused, true);
      assert.equal(geometry.bottom <= geometry.overlayTop, arm === 'after', `${arm} 未复现遮挡或修复`);
      await page.keyboard.press('Enter');
      assert.match(await frame(arm).locator('.focus-status').innerText(), /已确认清单/);
    }
    await choose('recovery');
    for (const arm of ['before', 'after']) {
      await frame(arm).locator('input').fill('周六阅读');
      await frame(arm).getByRole('button', { name: '载入演示清单' }).click();
      assert.match(await frame(arm).locator('.recovery-status').innerText(), /本地模拟失败/);
    }
    assert.equal(await frame('before').locator('input').inputValue(), '');
    assert.equal(await frame('before').locator('.retry').isDisabled(), true);
    assert.equal(await frame('after').locator('input').inputValue(), '周六阅读');
    await frame('after').locator('.retry').focus();
    await page.keyboard.press('Enter');
    assert.equal(await frame('after').locator('form').getAttribute('data-state'), 'recovered');
    assert.equal(await frame('after').locator('.result-list li').count(), 2);
    await page.locator('#reset').click();
    await frame('after').locator('form:not([data-state])').waitFor();
    assert.equal(await frame('after').locator('.result-list').isHidden(), true);
    await frame('after').locator('input').fill('');
    await frame('after').getByRole('button', { name: '载入演示清单' }).click();
    assert.equal(await frame('after').locator('input').getAttribute('aria-invalid'), 'true');
    await page.getByRole('button', { name: '平板 768 像素' }).click();
    await page.waitForFunction(() => document.querySelector('#after-frame').contentWindow.innerWidth === 768);
    await page.locator('#view-select').selectOption('after');
    assert.equal(await page.locator('[data-arm="before"]').isVisible(), false);
    await page.locator('#view-select').selectOption('both');
    await page.getByRole('button', { name: '手机 390 像素' }).click();
    await page.waitForFunction(() => document.querySelector('#after-frame').contentWindow.innerWidth === 390);
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 1100 });
      for (const id of ids) {
        if (width <= 760) await page.locator('#rule-select').selectOption(id);
        else await page.locator(`[data-rule="${id}"]`).click();
        await frame('after').locator(`body[data-rule="${id}"] [data-content]`).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id} 在 ${width} 像素根溢出`);
        for (const arm of ['before', 'after']) assert.ok(await frame(arm).locator('html').evaluate(element => element.scrollWidth <= innerWidth + 1), `${id} 的 ${arm} 试排在 ${width} 像素根溢出`);
      }
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  } finally {
    await browser.close();
    await new Promise(done => server.close(done));
  }
});
