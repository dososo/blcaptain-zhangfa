import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {startServer} from './serve.mjs';
const data=JSON.parse(await readFile('site/refinements.json','utf8'));
await mkdir('docs/media',{recursive:true});
const server=await startServer({port:0});const browser=await chromium.launch({channel:'chrome'});
const base=`http://127.0.0.1:${server.address().port}/`,captures=[];
try {
  for(const item of data.cases)for(const arm of ['before','after']) {
    const page=await browser.newPage({viewport:{width:item.width,height:data.viewportHeight},reducedMotion:'reduce'});
    const url=new URL(item[`${arm}Url`],base).href;
    await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
    const file='site/'+item[`${arm}Image`].replace(/^\.\//,'');
    await page.screenshot({path:file,type:'webp',quality:88});
    captures.push({id:item.id,condition:arm,url:item[`${arm}Url`],width:item.width,height:data.viewportHeight,scrollY:0,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
    await page.close();
  }
  const sources=[];
  for(const id of ['05','17','21']) {
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await page.goto(`${base}runs/${id}/full/`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`site/assets/gallery/作品-${id}.jpg`,type:'jpeg',quality:88});
    sources.push({id,url:`./runs/${id}/full/`,viewport:[1440,1000],source:'0.2.0视觉修订后的真实页面截图；内容为合成演示',file:`作品-${id}.jpg`,capturedAt:new Date().toISOString()});await page.close();
  }
  await writeFile('site/assets/gallery/来源.json',JSON.stringify(sources,null,2)+'\n');
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await page.goto(base,{waitUntil:'networkidle'});await page.screenshot({path:'docs/media/章法-画廊.webp',type:'webp',quality:88});
  await writeFile('site/assets/refinements/截图记录.json',JSON.stringify({version:data.version,browser:browser.version(),anchor:data.anchor,capturedAt:new Date().toISOString(),captures},null,2)+'\n');
  console.log(`已重新捕获${captures.length}张同页修复截图、3张作品图与README封面。`);
} finally {await browser.close();await new Promise(done=>server.close(done));}
