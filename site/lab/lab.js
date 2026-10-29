const paragraph = '傍晚的书店把长桌留给读者。我们沿着河岸步行，记录城市更新中的小事：一盏重新亮起的路灯，一间仍然营业的修理铺，以及愿意停下来交谈的人。好的阅读界面应当让这些内容自然进入视线，也为查证和返回留出清楚的路径。';
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const rules = [
  { id: 'title', title: '标题：把语义放进断行', intro: '字号保持 28 像素。缩窄容器容易拆散专名；改进条件给标题更充分的宽度，并为短语设置可解释的断点。', variables: '标题可用宽度：7 字宽 → 11 字宽；“城市更新”等短语保持成组。字号、字重、原文不变。', proves: '这段标题在当前几何条件下，专名成组与断行位置的变化。', limits: '这是人工语义断点，不是全部标题通用算法；不能保证所有宽度都无孤字。', html: after => `<h1 class="demo-title" data-content data-measure>${after ? '<span>城市更新</span><wbr><span>中的书店，</span><wbr><span>与阅读的未来</span>' : '城市更新中的书店，与阅读的未来'}</h1>`, css: after => `.demo-title{font-size:28px;line-height:1.4;font-weight:600;max-width:${after ? 11 : 7}em}.demo-title span{display:inline-block;max-width:100%}` },
  { id: 'spacing', title: '混排：给中英文一点距离', intro: '关闭自动间距，仅比较明确的局部外边距。拉丁片段始终保留原样，不依赖浏览器自动间距能力。', variables: '拉丁片段两侧外边距：0 → 0.14 字宽；关闭自动间距；不插入或删除空格字符。', proves: '这段混排在当前浏览器中，显式间距的实际表现。', limits: '没有验证自动间距能力或所有浏览器支持；原生能力和字体实际命中仍为未知。', html: () => '<p data-content data-measure>用<span class="latin">API</span>连接服务，用<span class="latin">CLI</span>执行检查。当前版本<span class="latin">v0.1.0</span>，适配<span class="latin">3.5mm</span>接口；费用为<span class="latin">¥1,280</span>。</p>', css: after => `p{text-autospace:no-autospace}.latin{margin-inline:${after ? '.14em' : '0'}}` },
  { id: 'punctuation', title: '标点：成对符号留在句中', intro: '同样的引号、书名号、括号和省略号。切换宽度，观察机械逐字换行与浏览器常规中文断行的差别。', variables: '断行策略：逐字任意换行 → 常规换行与严格行禁则声明；原文、字号、容器不变。', proves: '当前环境里，成对标点在这段内容中的可复现断行位置。', limits: '严格行禁则声明是否完整生效、地区规范与字形是否正确，仍需人工检查；未代表繁体地区规范。', html: () => '<p data-content data-measure>她说：“读完《城市与书店》（修订版），我们再讨论‘公共空间’。”书店保留了两种声音——留下，或者出发……报名时间为（周六）下午。</p>', css: after => `p{line-break:${after ? 'strict' : 'anywhere'};overflow-wrap:${after ? 'normal' : 'anywhere'}}` },
  { id: 'measure', title: '行长：让目光容易返回', intro: '在 768 像素上限下更容易看清差异。两边保持 16 像素字号和相同行高，只改变正文容器的最大宽度。', variables: '正文最大宽度：不限制 → 24 字宽。字号、行高、内容完全相同。', proves: '当前字体与实际视口中的行数、列宽和段落高度。', limits: '行数不等于审美胜率，也未证明所有内容都适合 24 字宽；手机窄屏时两边可能相同。', html: () => `<p data-content data-measure>${paragraph}${paragraph}</p>`, css: after => `p{max-width:${after ? '24em' : 'none'}}` },
  { id: 'leading', title: '行高：给段落一个节奏', intro: '两边都保留同一个标题与两段正文，不修改措辞。调整行高和段间距，观察连续阅读的节奏。', variables: '正文行高：1.2 → 1.85；段间距：4 → 18 像素；标题下边距：4 → 18 像素。', proves: '相同内容、字号与字体下，行盒和段落间隔的局部变化。', limits: '没有做用户阅读速度、理解程度或偏好实验。', html: () => `<div data-content><h2>河岸阅读计划</h2><p data-measure>${paragraph}</p><p>${paragraph}</p></div>`, css: after => `p{line-height:${after ? 1.85 : 1.2};margin-bottom:${after ? 18 : 4}px}h2{margin-bottom:${after ? 18 : 4}px}` },
  { id: 'terms', title: '条款：价格之外也要看见', intro: '演示价格与取消条款完整保留。问题条件使用 10 像素条款，改进条件只调整到 16 像素。', variables: '条款字号：10 → 16 像素；条款内容、颜色、行高比例不变。', proves: '条款在当前显示环境下的可见程度与布局占用。', limits: '没有证明条款合法、业务可售或满足所有无障碍要求；价格仅为演示数据。', html: () => '<div data-content><h2>河岸周末房</h2><p class="price">¥ 680 <span>每晚 · 演示价格</span></p><p class="terms" data-measure>入住前七日可免费取消；之后取消收取首晚费用。价格不含早餐，每间最多入住两人。请在确认前完整阅读取消条款。</p></div>', css: after => `.price{font-size:32px;margin:22px 0}.price span{font-size:14px}.terms{font-size:${after ? 16 : 10}px;line-height:1.7}` },
  { id: 'emphasis', title: '强调：别让假斜体替你说话', intro: '问题条件请求浏览器斜体；改进条件使用直立字形、字重声明和下划线。系统是否提供真实字重资源，本页不能确认。', variables: '强调方式：请求斜体 → 直立、600 字重声明和下划线；改进条件禁用字形合成。', proves: '当前系统字体环境下，两种强调方法的字形与辨识差异。', limits: '真实字重是否存在、字形是否经过合成均为未知；没有外部字体资源或真实字重加载证据。', html: () => '<p data-content data-measure>报名之前，请留意：<em>课程需要自备耳机，且不提供录播回放。</em>这些条件会影响你是否适合参加。</p>', css: after => after ? 'em{font-style:normal;font-weight:600;text-decoration:underline;text-underline-offset:.25em;font-synthesis:none}' : 'em{font-style:italic;font-weight:400;font-synthesis:style}' },
  { id: 'button', title: '长按钮：动作名称要完整', intro: '同一个动作、同一句文案。问题条件在窄按钮内截断；改进条件允许文字换行。两个按钮都可点击，反馈仅为本地模拟。', variables: '按钮宽度：140 像素 → 容器宽度；单行裁切 → 多行；最小高度：36 → 48 像素。', proves: '动作名称是否完整、点击区域的实际几何，以及窄屏是否可操作。', limits: '没有实际报名服务，也没有验证所有语言和文本放大情形。', html: () => '<div data-content><h2>资料已经准备好</h2><p>继续前请确认申请信息。</p><button class="long-action" type="button">确认信息并继续申请河岸周末阅读计划</button><p class="feedback" role="status">尚未触发演示动作。</p></div>', css: after => `.long-action{margin-top:22px;${after ? 'width:100%;min-height:48px;white-space:normal;overflow-wrap:anywhere' : 'width:140px;height:36px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'}}` },
  { id: 'numbers', title: '数字：按同一个基准扫描', intro: '三个项目和金额保持一致。通过金额对齐、数字字形声明和单位不拆分，观察表格的扫描路径。', variables: '金额列左对齐 → 右对齐；比例数字声明 → 等宽数字声明；单位保持不换行。', proves: '当前环境中的数据保全和列对齐；金额、中文单位没有被删减。', limits: '等宽数字字形是否由系统字体提供仍为未知；不能从声明推断真实字体资源。', html: () => '<table data-content><caption>阅读计划支出 · 演示数据</caption><thead><tr><th scope="col">项目</th><th scope="col">金额</th></tr></thead><tbody><tr><th scope="row">场地</th><td>1,280.00 <span>元</span></td></tr><tr><th scope="row">资料</th><td>89.50 <span>元</span></td></tr><tr><th scope="row">设备</th><td>7,011.00 <span>元</span></td></tr></tbody></table>', css: after => `td{text-align:${after ? 'right' : 'left'};font-variant-numeric:${after ? 'tabular-nums' : 'proportional-nums'};${after ? 'white-space:nowrap' : ''}}` },
  { id: 'fallback', title: '后备字体：失败之后继续读', intro: '没有发起字体请求。按钮会在本地切换字体栈，模拟首选字体不可用后的回退试排；这不是实际加载失败测试。', variables: '本地模拟字体回退：问题条件使用通用衬线后备；改进条件使用系统无衬线后备；容器、字号、全文不变。', proves: '手动切换指定字体栈后的布局变化和内容保留。', limits: '没有实际阻断网络字体请求；系统字体实际命中、字体加载时序与真实失败表现均为未知。', html: () => `<div><button type="button" class="font-toggle" aria-pressed="false">模拟首选字体不可用</button><div class="font-copy" data-content><h2>河岸书店 · 阅读档案</h2><p data-measure>${paragraph}</p><p>本期编号：2026-10 / API v0.1.0</p></div><p class="font-status" role="status">本地默认试排；实际字体命中未知。</p></div>`, css: after => `.font-copy{margin-top:22px;font-family:"PingFang SC","Microsoft YaHei",sans-serif}.fallback .font-copy{font-family:${after ? '"Arial","Microsoft YaHei",sans-serif' : '"Songti SC","Times New Roman",serif'}}` },
  { id: 'focus', title: '键盘焦点：浮层之下还有按钮', intro: '点击或用键盘激活“定位最后一步”，再按回车。两边会把同一个按钮滚动到局部底部；问题条件被浮层遮挡，改进条件为它留出空间。', variables: '滚动区域底部留白与滚动内边距：0 → 100 像素；浮层尺寸、任务和目标按钮不变。', proves: '当前局部滚动容器中，焦点目标是否可见，以及键盘是否能触发同一动作。', limits: '没有覆盖操作系统级浮层、屏幕阅读器或所有浏览器的焦点滚动策略。', html: () => '<div data-content><button class="focus-jump" type="button">定位最后一步</button><div class="focus-stage"><div class="scroll-area" tabindex="0" aria-label="可滚动的准备步骤"><p>一、核对材料名称。</p><p>二、确认参加日期。</p><p>三、检查联系信息。</p><p>四、阅读取消条款。</p><p>五、保留准备清单。</p><button type="button" class="focus-target">确认清单已准备好</button></div><div class="floating-note">浮动提示：所有步骤仅作本地演示。</div></div><p class="focus-status" role="status">尚未定位最后一步。</p></div>', css: after => `.focus-stage{position:relative;margin-top:18px}.scroll-area{height:240px;overflow:auto;border:1px solid #bac2b1;padding:14px 12px ${after ? 100 : 0}px;scroll-padding-bottom:${after ? 100 : 0}px}.scroll-area p{margin-bottom:52px}.focus-target{width:100%}.floating-note{position:absolute;inset:auto 0 0;background:#e0e7d4;border-top:1px solid #7c896c;padding:20px 14px;min-height:80px;pointer-events:none;font-size:13px}` },
  { id: 'recovery', title: '错误恢复：失败后还能继续', intro: '输入一个清单名称并提交，两边第一次都会模拟失败。改进条件保留输入并开放重试；第二次本地重试得到演示清单。页面不会提交任何信息。', variables: '失败后是否保留输入、是否提供可用重试；首次失败与成功数据固定，不连接后端。', proves: '空状态 → 失败 → 本地恢复的反馈与功能连续性，以及焦点和输入是否保留。', limits: '没有真实后端、重试策略、数据持久化或网络恢复验证。', html: () => '<form data-content novalidate><label for="list-name">清单名称</label><input id="list-name" name="list-name" autocomplete="off" value="河岸阅读计划"><div class="form-actions"><button type="submit">载入演示清单</button><button type="button" class="retry" disabled>重试本地请求</button></div><p class="recovery-status" role="status">空状态：尚未载入清单。</p><ul class="result-list" hidden><li>阅读材料 · 已准备</li><li>个人耳机 · 待核对</li></ul></form>', css: () => 'form label{display:block;margin-bottom:8px}input{width:100%;padding:10px;border:1px solid #7b8671;background:white;font:inherit}.form-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}.recovery-status{margin-top:20px}.result-list{padding-left:22px}' }
];

const baseCSS = `*{box-sizing:border-box}html{color:#253023;background:#fff;font:16px/1.75 "PingFang SC","Microsoft YaHei",sans-serif}body{margin:0;padding:26px 22px}h1,h2,p{margin:0}h2{font-size:22px;line-height:1.5;font-weight:600;margin-bottom:18px}p{overflow-wrap:break-word}button{background:#e9efdf;border:1px solid #8b997b;padding:10px 12px;color:inherit;font:inherit;font-size:14px;line-height:1.5;cursor:pointer;max-width:100%}button:focus-visible,input:focus-visible,[tabindex]:focus-visible{outline:3px solid #385d1f;outline-offset:3px}button:disabled{opacity:.55;cursor:not-allowed}.feedback,.font-status,.focus-status{font-size:13px;margin-top:18px;color:#59634f}table{border-collapse:collapse;width:100%;font-size:16px}caption{text-align:left;margin-bottom:20px;font-size:14px}th,td{border-bottom:1px solid #dbe0d4;padding:14px 4px}th{text-align:left;font-weight:500}th:first-child{width:40%}button,input{font-family:inherit}[hidden]{display:none!important}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}`;

function frameScript(after) {
  return `const after=${after};
document.querySelector('.long-action')?.addEventListener('click',()=>{document.querySelector('.feedback').textContent='本地演示：已记录继续申请动作，未提交报名。'});
document.querySelector('.font-toggle')?.addEventListener('click',event=>{const active=document.body.classList.toggle('fallback');event.currentTarget.setAttribute('aria-pressed',String(active));event.currentTarget.textContent=active?'恢复首选字体试排':'模拟首选字体不可用';document.querySelector('.font-status').textContent=active?'本地回退试排已启用；未发送或阻断字体请求。':'本地默认试排；实际字体命中未知。'});
document.querySelector('.focus-jump')?.addEventListener('click',()=>{const target=document.querySelector('.focus-target');target.focus({preventScroll:true});target.scrollIntoView({block:'end',behavior:'instant'});document.querySelector('.focus-status').textContent='焦点已移到最后一步。按回车可确认。'});
document.querySelector('.focus-target')?.addEventListener('click',()=>{document.querySelector('.focus-status').textContent='本地演示：已确认清单，未向外部提交。'});
const form=document.querySelector('form');
form?.addEventListener('submit',event=>{event.preventDefault();const input=form.querySelector('input');const status=form.querySelector('.recovery-status');if(!input.value.trim()){status.textContent='请输入清单名称，再载入演示清单。';input.setAttribute('aria-invalid','true');input.focus();return;}input.removeAttribute('aria-invalid');form.dataset.state='failed';status.textContent=after?'本地模拟失败：清单暂未载入。名称已保留，可以重试。':'本地模拟失败：清单暂未载入。名称被清空，重试不可用。';form.querySelector('.retry').disabled=!after;if(!after)input.value='';});
document.querySelector('.retry')?.addEventListener('click',()=>{form.dataset.state='recovered';form.querySelector('.recovery-status').textContent='本地模拟恢复：已载入两项演示材料，未连接真实服务。';form.querySelector('.result-list').hidden=false;});`;
}

const select = document.querySelector('#rule-select');
const list = document.querySelector('#rule-list');
let selected = rules[0];
rules.forEach((rule, index) => {
  const option = document.createElement('option');
  option.value = rule.id;
  option.textContent = `${String(index + 1).padStart(2, '0')} ${rule.title}`;
  select.append(option);
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.rule = rule.id;
  button.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span>${escapeHTML(rule.title.split('：')[0])}`;
  button.addEventListener('click', () => choose(rule.id));
  item.append(button);
  list.append(item);
});

function report(frame, arm) {
  const doc = frame.contentDocument;
  if (!doc?.querySelector('[data-content]')) return;
  const measured = doc.querySelector('[data-measure]');
  let detail = '';
  if (measured) {
    const lineHeight = parseFloat(frame.contentWindow.getComputedStyle(measured).lineHeight);
    const lines = Number.isFinite(lineHeight) ? Math.round(measured.getBoundingClientRect().height / lineHeight) : null;
    detail = lines ? ` · 首个测量文本块约 ${lines} 行` : ' · 行数未知';
  }
  document.querySelector(`#${arm}-metrics`).textContent = `实际视口 ${Math.round(frame.getBoundingClientRect().width - 2)} 像素${detail} · 字体实际命中未知`;
}

function renderFrames() {
  for (const arm of ['before', 'after']) {
    const after = arm === 'after';
    const frame = document.querySelector(`#${arm}-frame`);
    frame.style.height = selected.id === 'leading' ? '610px' : selected.id === 'focus' ? '485px' : selected.id === 'measure' ? '580px' : '420px';
    frame.onload = () => report(frame, arm);
    frame.srcdoc = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(selected.title)} · ${after ? '改进' : '问题'}条件</title><style>${baseCSS}${selected.css(after)}</style></head><body data-rule="${selected.id}" data-arm="${arm}">${selected.html(after)}<script>${frameScript(after)}</script></body></html>`;
  }
}

function choose(id) {
  selected = rules.find(rule => rule.id === id) || rules[0];
  select.value = selected.id;
  list.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rule === selected.id)));
  document.querySelector('#rule-number').textContent = `局部 ${String(rules.indexOf(selected) + 1).padStart(2, '0')} / 十二组`;
  document.querySelector('#rule-title').textContent = selected.title;
  document.querySelector('#rule-intro').textContent = selected.intro;
  for (const field of ['variables', 'proves', 'limits']) document.querySelector(`#${field}`).textContent = selected[field];
  document.querySelector('#selection-status').textContent = `已切换到${selected.title}。两栏已重置为相同初始内容。`;
  renderFrames();
}

select.addEventListener('change', () => choose(select.value));
document.querySelector('#reset').addEventListener('click', () => {
  renderFrames();
  document.querySelector('#selection-status').textContent = `${selected.title}已重置。`;
});
document.querySelectorAll('[data-width]').forEach(button => {
  if (button.tagName !== 'BUTTON') return;
  button.addEventListener('click', () => {
    document.querySelector('#comparisons').dataset.width = button.dataset.width;
    document.querySelectorAll('button[data-width]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  });
});
document.querySelector('#view-select').addEventListener('change', event => {
  document.querySelector('#comparisons').dataset.view = event.target.value;
});
const resizeObserver = new ResizeObserver(() => {
  for (const arm of ['before', 'after']) report(document.querySelector(`#${arm}-frame`), arm);
});
document.querySelectorAll('iframe').forEach(frame => resizeObserver.observe(frame));
document.querySelector('#environment').textContent = '环境边界：所有示意仅采用本机系统字体栈。未检测真实字体资源、自动间距支持或跨浏览器一致性；相关能力均标为未知。行数由文本块高度与行高估算，混合行盒时仅供观察。';
choose(rules[0].id);
