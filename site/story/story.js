"use strict";
const viewer=document.querySelector('#viewer'),image=document.querySelector('#page-image');
let width=matchMedia('(max-width:600px)').matches?'390':'1440',arm='full';
function render(){
  const ratio=viewer.scrollTop/Math.max(1,viewer.scrollHeight-viewer.clientHeight);
  const label=arm==='full'?'章法＋分寸 · 0.2.0修订页':'无本技能 · 原始页';
  const source=`../assets/story/05-${width}-${arm}.webp`;
  const status=document.querySelector('#image-status');
  viewer.setAttribute('aria-busy','true');image.style.visibility='hidden';status.hidden=false;status.textContent='正在加载所选完整截图…';
  viewer.dataset.width=width;
  image.onload=()=>{viewer.scrollTop=ratio*Math.max(0,viewer.scrollHeight-viewer.clientHeight);image.style.visibility='visible';status.hidden=true;viewer.setAttribute('aria-busy','false');};
  image.onerror=()=>{status.textContent='截图未能加载。可通过下方入口打开原图或实际页面。';viewer.setAttribute('aria-busy','false');};
  image.src=source;
  image.alt=`纸岸书店${label}，${width}像素完整页面：书籍、活动日程、到店说明及演示边界`;
  document.querySelector('#view-label').textContent=`${label} / ${width==='390'?'手机':'桌面'}${width}px`;
  document.querySelector('#open-image').href=source;
  document.querySelector('#open-page').href=`../runs/05/${arm}/`;
  for(const button of document.querySelectorAll('[data-width]'))if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.width===width));
  for(const button of document.querySelectorAll('[data-arm]'))button.setAttribute('aria-pressed',String(button.dataset.arm===arm));
}
for(const button of document.querySelectorAll('button[data-width]'))button.addEventListener('click',()=>{width=button.dataset.width;render();});
for(const button of document.querySelectorAll('button[data-arm]'))button.addEventListener('click',()=>{arm=button.dataset.arm;render();});
render();
