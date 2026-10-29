import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {startServer} from '../scripts/serve.mjs';

const targets = {
  '01': [['h1','中文'],['h1','都有'],['.repair h2','阅读节奏']],
  '05': [['h1','留给'],['h1','一本'],['.visit h2','空间']],
  '06': [['.poster strong','第三盏灯'],['#chapters a:last-of-type','最后一班车']],
  '07': [['h1','停一会儿']], '08': [['.path','1.2 m'],['.path','通道']],
  '09': [['h1','为什么'],['h1','停在门外']],
  '14': [['#projects h2','入口信息'],['#projects h2','无障碍路径']],
  '17': [['h1','日常'],['h1','城市观察'],['#booking-title','给城市']],
  '19': [['h1','准备指南'],['#progress','会话']],
  '20': [['h1','看清楚']], '21': [['h1','真正需要'],['h1','来选']],
  '22': [['h1','食材']]
};

test('原始对照组与冻结输入字节不变', async () => {
  const hashes=JSON.parse(await readFile('bench/protected-v0.1.0.json','utf8'));
  for(const [path,hash] of Object.entries(hashes)) assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),hash,path);
});

test('修复关键语义片段在四宽中保持完整，并保留原文与页面重排', async () => {
  const server=await startServer({port:0});const browser=await chromium.launch({channel:'chrome'});
  const page=await browser.newPage();const base=`http://127.0.0.1:${server.address().port}`;const failures=[];
  try {
    for(const [id,checks] of Object.entries(targets)) {
      for(const width of [320,390,768,1440]) {
        await page.setViewportSize({width,height:1000});await page.goto(`${base}/runs/${id}/full/`);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${id}/${width}根溢出`);
        for(const [selector,word] of checks) {
          const rows=await page.locator(selector).first().evaluate((el,word)=>{
            const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];let node,offset=0;
            while((node=walker.nextNode())){nodes.push({node,start:offset});offset+=node.textContent.length;}
            const text=el.textContent,index=text.indexOf(word);if(index<0)return ['未找到原文'];
            const tops=[];for(let i=index;i<index+word.length;i++){
              const entry=[...nodes].reverse().find(x=>x.start<=i);const range=document.createRange();
              range.setStart(entry.node,i-entry.start);range.setEnd(entry.node,i-entry.start+1);
              const rect=range.getClientRects()[0];if(rect?.width&&rect.height&&!tops.some(y=>Math.abs(y-rect.top)<3))tops.push(rect.top);
            }return tops;
          },word);
          if(rows.length!==1)failures.push(`${id}/${width} ${selector} “${word}”分成${rows.length}行`);
        }
      }
      const original=await browser.newPage();await original.goto(`${base}/history/v0.1.0/runs/${id}/full/`);
      const text=await original.locator('h1').first().textContent();await original.close();
      assert.equal(await page.locator('h1').first().textContent(),text,`${id}锁定标题被改写`);
    }
    assert.deepEqual(failures,[]);
  } finally {await browser.close();await new Promise(r=>server.close(r));}
});

test('窄屏动态改版保全恢复、草稿、预约结果和清单反馈', async () => {
  const server=await startServer({port:0});const browser=await chromium.launch({channel:'chrome'});
  const page=await browser.newPage({viewport:{width:320,height:1000}});const base=`http://127.0.0.1:${server.address().port}`;
  try {
    await page.goto(`${base}/runs/14/full/`);await page.locator('#owner').selectOption({label:'周禾（演示）'});await page.locator('#archive').check();
    assert.equal(await page.locator('#projects article').count(),2);await page.getByRole('button',{name:'恢复项目'}).click();
    assert.match(await page.locator('#feedback').textContent(),/已恢复PJ-02/);await page.locator('#undo').click();assert.match(await page.locator('#feedback').textContent(),/已撤销恢复/);
    await page.goto(`${base}/runs/16/full/`);await page.locator('#search').fill('TK-002');await page.locator('#tickets button').click();
    await page.locator('#reply').fill('只在本地保留的演示草稿');await page.locator('#fail').click();assert.match(await page.locator('#state').textContent(),/失败，草稿已保留/);
    await page.locator('#retry').click();assert.equal(await page.locator('#state').textContent(),'本地模拟回复成功，未发送真实消息');assert.equal(await page.locator('#state .cjk-unit').count(),2);
    await page.locator('#search').fill('TK-001');await page.locator('#tickets button').click();await page.locator('#search').fill('TK-002');await page.locator('#tickets button').click();assert.equal(await page.locator('#reply').inputValue(),'只在本地保留的演示草稿');
    await page.goto(`${base}/runs/17/full/`);await page.locator('.submit').click();assert.equal(await page.locator('#visitor').getAttribute('aria-invalid'),'true');
    await page.locator('#visitor').fill('演示访客');await page.locator('#email').fill('guest@example.invalid');await page.locator('#agree').check();await page.locator('.submit').click();assert.equal(await page.locator('#success-title').isVisible(),true);assert.match(await page.locator('#success-summary').textContent(),/¥48/);await page.locator('#restart').click();assert.equal(await page.locator('#booking-form').isVisible(),true);
    await page.goto(`${base}/runs/19/full/`);await page.locator('[data-check]').nth(0).check();await page.locator('[data-check]').nth(2).check();assert.equal(await page.locator('#progress').textContent(),'已准备 2／4 项，仅保存于当前会话。');await page.locator('#reset').click();assert.match(await page.locator('#progress').textContent(),/0／4/);
  } finally {await browser.close();await new Promise(r=>server.close(r));}
});

test('清单页初始计算字号翻倍后不靠根裁切，编号与材料文字仍分栏', async () => {
  const server=await startServer({port:0});const browser=await chromium.launch({channel:'chrome'});
  try {
    const page=await browser.newPage({viewport:{width:320,height:1000}});await page.goto(`http://127.0.0.1:${server.address().port}/runs/19/full/`);
    await page.evaluate(()=>{const sizes=[...document.querySelectorAll('*')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const [e,size]of sizes)e.style.fontSize=size*2+'px'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.ok(await page.locator('.checklist label').evaluateAll(labels=>labels.every(label=>label.querySelector('span').getBoundingClientRect().right<=label.querySelector('div').getBoundingClientRect().left)));
  } finally {await browser.close();await new Promise(r=>server.close(r));}
});
