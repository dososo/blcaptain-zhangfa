import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {startServer} from './serve.mjs';

await mkdir('site/assets/story',{recursive:true});
await mkdir('evidence/review-v3',{recursive:true});
const protectedFiles=Object.keys(JSON.parse(await readFile('bench/protected-v0.1.0.json','utf8')));
async function walk(dir){const files=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${e.name}`;if(e.isDirectory())files.push(...await walk(p));else files.push(p);}return files;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashes={};for(const p of [...protectedFiles,...await walk('site/history')])hashes[p]=hash(await readFile(p));
const server=await startServer({port:0}),browser=await chromium.launch({channel:'chrome'});
const base=`http://127.0.0.1:${server.address().port}`,captures=[],content=[];
try{
  for(const width of [1440,390])for(const arm of ['control','full']){
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    await page.goto(`${base}/runs/05/${arm}/`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
    const file=`site/assets/story/05-${width}-${arm}.webp`;
    await page.screenshot({path:file,type:'webp',quality:88,fullPage:true});
    captures.push({file:file.replace('site/',''),url:`./runs/05/${arm}/`,width,height:await page.evaluate(()=>document.documentElement.scrollHeight),fullPage:true,scrollY:0,sha256:hash(await readFile(file))});
    const text=(await page.locator('body').textContent()).replace(/\s/g,'');
    const required=['把周六，留给一本还没读完的书','《在城市的缝隙里重新学习散步：街道、日常与公共生活》','《纸上的慢天气》','19:00—20:30','15:00—16:00','¥30／人（演示）','演示总席位24席，不显示实时余量','适合16岁以上读者；未成年人由监护人自行确认参与条件。','查看本地演示报名说明，不收集真实信息。','示例市南岸区河沿路128号二层（演示地址）','周二至周日10:00—20:00（演示）','活动不开放真实报名；价格和席位是演示数据，不代表库存。'];
    const missing=required.filter(t=>!text.includes(t.replace(/\s/g,'')));
    await page.getByRole('button',{name:'查看报名信息',exact:false}).click();
    const disclosure=arm==='control'?page.locator('#info'):page.locator('#signup');
    const visible=await disclosure.isVisible();
    const conditionVisible=await disclosure.getByText('适合16岁以上读者；未成年人由监护人自行确认参与条件。',{exact:false}).isVisible();
    const close=arm==='control'?page.locator('#close-info'):page.locator('#close-signup');await close.focus();await page.keyboard.press('Enter');
    content.push({width,arm,missing,open:visible,conditionVisible,close:!await disclosure.isVisible(),focusReturned:await page.getByRole('button',{name:'查看报名信息',exact:false}).evaluate(el=>el===document.activeElement),rootOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)});
    await page.close();
  }
  await writeFile('site/assets/story/来源.json',JSON.stringify({capturedAt:new Date().toISOString(),browser:browser.version(),nature:'同一冻结内容的不同生成条件；full包含0.2.0后期视觉修订。精选非胜率，不是单次改版前后。',captures},null,2)+'\n');
  await writeFile('evidence/review-v3/完整案例验证.json',JSON.stringify({hashes,content},null,2)+'\n');
  if(content.some(c=>c.missing.length||!c.open||!c.close||!c.conditionVisible||!c.focusReturned||c.rootOverflow))throw new Error('完整案例核验失败，见证据');
  console.log(JSON.stringify({截图:captures.map(c=>[c.width,c.height,c.file]),核验:content},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
