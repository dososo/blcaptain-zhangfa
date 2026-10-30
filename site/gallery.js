"use strict";

// 对比文字与图片来自单独的实测记录，不在展示层编造结论。
(async function loadRefinements() {
  const host = document.querySelector("#refinement-cases");
  const local = value => {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin && ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  };
  const text = (tag, content, className) => {
    const node = document.createElement(tag);
    node.textContent = content;
    if (className) node.className = className;
    return node;
  };
  try {
    const response = await fetch("./refinements.json", { cache: "no-store" });
    if (!response.ok) throw new Error("对比记录尚未就绪");
    const data = await response.json();
    if (!Array.isArray(data.cases) || !data.cases.length) throw new Error("暂无对比记录");
    const cards = data.cases.map((item, index) => {
      const beforeImage = local(item.beforeImage);
      const afterImage = local(item.afterImage);
      const beforeUrl = local(item.beforeUrl);
      const afterUrl = local(item.afterUrl);
      if (!beforeImage || !afterImage || !beforeUrl || !afterUrl || typeof item.title !== "string" || typeof item.description !== "string" || !Number.isFinite(item.width) || item.width < 1) throw new Error("对比记录不完整");
      const card = document.createElement("article");
      card.className = "refinement-card";
      const copy = document.createElement("div");
      const title = document.createElement("h3");
      for (const phrase of item.title.match(/[^，。？！]+[，。？！]?/g) || [item.title]) title.append(text("span", phrase));
      copy.append(text("span", `${String(index + 1).padStart(2, "0")} / 同页打磨`, "refinement-number"), title, text("p", item.description));
      const viewer = document.createElement("div");
      viewer.className = "refinement-viewer";
      const toolbar = document.createElement("div");
      toolbar.className = "refinement-toolbar";
      const toggle = document.createElement("div");
      toggle.className = "refinement-toggle";
      toggle.setAttribute("role", "group");
      toggle.setAttribute("aria-label", `${item.title}：比较修复前后`);
      const windowId = `refinement-window-${index}`;
      const window = document.createElement("div");
      window.className = "refinement-window";
      window.id = windowId;
      window.tabIndex = 0;
      window.setAttribute("role", "region");
      window.setAttribute("aria-label", `${item.title}，原尺寸截图，可滚动查看`);
      window.style.setProperty("--capture-width", `${item.width}px`);
      const caption = text("p", "", "refinement-caption");
      caption.setAttribute("aria-live", "polite");
      const links = document.createElement("div");
      links.className = "refinement-links";
      const screenshotLink = document.createElement("a");
      screenshotLink.textContent = "打开完整截图 ↗";
      const pageLink = document.createElement("a");
      pageLink.textContent = "打开这一版页面 ↗";
      for (const link of [screenshotLink, pageLink]) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
      const figures = {};
      const buttons = {};
      const select = arm => {
        for (const key of ["before", "after"]) {
          buttons[key].setAttribute("aria-pressed", String(key === arm));
          figures[key].hidden = key !== arm;
        }
        caption.textContent = `${arm === "before" ? "修复前：原始生成" : "修复后：视觉审查后修订"} · 相同内容、视口与顶部锚点`;
        screenshotLink.href = arm === "before" ? beforeImage : afterImage;
        pageLink.href = arm === "before" ? beforeUrl : afterUrl;
        screenshotLink.setAttribute("aria-label", `打开${item.title}的${arm === "before" ? "修复前" : "修复后"}完整截图`);
        pageLink.setAttribute("aria-label", `打开${item.title}的${arm === "before" ? "修复前" : "修复后"}页面`);
        viewer.dataset.selected = arm;
      };
      for (const arm of ["before", "after"]) {
        const label = arm === "before" ? "修复前" : "修复后";
        const button = text("button", label);
        button.type = "button";
        button.setAttribute("aria-controls", windowId);
        buttons[arm] = button;
        button.addEventListener("click", () => select(arm));
        button.addEventListener("keydown", event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "before" : event.key === "End" ? "after" : arm === "before" ? "after" : "before";
          select(next); buttons[next].focus({ preventScroll: true });
        });
        toggle.append(button);
        const figure = document.createElement("figure");
        const img = document.createElement("img");
        img.src = arm === "before" ? beforeImage : afterImage;
        img.alt = item[`${arm}Alt`] || `${item.title}，${label}的真实页面截图`;
        img.loading = "lazy";
        img.width = item.width;
        img.height = data.viewportHeight || 1000;
        figure.append(img);
        figures[arm] = figure;
        window.append(figure);
      }
      toolbar.append(toggle, text("span", `${item.width}px 原尺寸截图`, "refinement-width"));
      links.append(screenshotLink, pageLink);
      const help = text("p", "在窗口内上下、左右移动查看细节；切换前后保留观察位置。完整截图与页面均可另开。", "refinement-help");
      viewer.append(toolbar, window, caption, help, links);
      select("after");
      card.append(copy, viewer);
      return card;
    });
    host.replaceChildren(...cards);
    host.dataset.state = "ready";
  } catch {
    host.replaceChildren(text("p", "对比素材暂未就绪。你仍可在下方试验场查看实际页面与生成记录。", "refinement-intro"));
    host.dataset.state = "unavailable";
  }
})();
