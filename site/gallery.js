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
      const images = document.createElement("div");
      images.className = "refinement-images";
      for (const arm of ["before", "after"]) {
        const label = arm === "before" ? "修复前" : "修复后";
        const figure = document.createElement("figure");
        const imageLink = document.createElement("a");
        imageLink.className = "refinement-image-link";
        imageLink.href = arm === "before" ? beforeImage : afterImage;
        imageLink.target = "_blank";
        imageLink.rel = "noopener noreferrer";
        imageLink.setAttribute("aria-label", `查看${item.title}的${label}原始截图`);
        const img = document.createElement("img");
        img.src = imageLink.href;
        img.alt = item[`${arm}Alt`] || `${item.title}，${label}的真实页面截图`;
        img.loading = "lazy";
        imageLink.append(img);
        const caption = document.createElement("figcaption");
        const open = document.createElement("a");
        open.href = arm === "before" ? beforeUrl : afterUrl;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        open.textContent = "打开页面 ↗";
        caption.append(text("span", `${label} · ${item.width} 像素`), open);
        figure.append(imageLink, caption);
        images.append(figure);
      }
      card.append(copy, images);
      return card;
    });
    host.replaceChildren(...cards);
    host.dataset.state = "ready";
  } catch {
    host.replaceChildren(text("p", "对比素材暂未就绪。你仍可在下方试验场查看实际页面与生成记录。", "refinement-intro"));
    host.dataset.state = "unavailable";
  }
})();
