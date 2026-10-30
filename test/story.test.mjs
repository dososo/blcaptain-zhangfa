import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {startServer} from '../scripts/serve.mjs';

test('完整案例按实际视口切换完整截图、键盘切换条件且保留页面与来源入口',async()=>{
  const server=await startServer({port:0}),browser=await chromium.launch({channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/story/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>document.querySelector('#viewer').getAttribute('aria-busy')==='false');
    assert.match(await page.locator('#page-image').getAttribute('src'),/390-full/);
    await page.getByRole('button',{name:'无本技能 · 原始页',exact:true}).focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('#viewer').getAttribute('aria-busy')==='false');
    assert.match(await page.locator('#page-image').getAttribute('src'),/390-control/);
    assert.equal(await page.locator('#open-page').getAttribute('href'),'../runs/05/control/');
    assert.match(await page.locator('#view-label').textContent(),/无本技能.*手机390px/);
    await page.getByRole('button',{name:'桌面 · 1440px',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#viewer').getAttribute('aria-busy')==='false');
    assert.ok(await page.locator('#page-image').evaluate(e=>e.naturalWidth===1440&&e.naturalHeight>1000));
    for(const width of [320,390,523,768,1440]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}px根溢出`);
    }
    const sources=JSON.parse(await readFile('site/assets/story/来源.json','utf8'));
    for(const capture of sources.captures){
      assert.equal(createHash('sha256').update(await readFile('site/'+capture.file)).digest('hex'),capture.sha256);
      assert.equal((await page.request.get(`http://127.0.0.1:${server.address().port}/${capture.url.replace('./','')}`)).status(),200);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});

test('完整案例图片失败不把旧图标成新条件，保留失败说明和实际页面入口',async()=>{
  const server=await startServer({port:0}),browser=await chromium.launch({channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(`http://127.0.0.1:${server.address().port}/story/`,{waitUntil:'networkidle'});
    await page.route('**/05-390-control.webp',route=>route.abort());
    await page.getByRole('button',{name:'无本技能 · 原始页',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#image-status').textContent.includes('未能加载'));
    assert.equal(await page.locator('#page-image').evaluate(e=>getComputedStyle(e).visibility),'hidden');
    assert.equal(await page.locator('#open-page').getAttribute('href'),'../runs/05/control/');
    assert.equal(await page.locator('#image-status').isVisible(),true);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
