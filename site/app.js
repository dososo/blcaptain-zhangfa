"use strict";

const $ = (selector) => document.querySelector(selector);
const armIds = ["control", "measure", "full"];
const armLabels = { control: "无本技能", measure: "仅分寸", full: "章法＋分寸" };
const state = { cases: [], selectedId: null, arm: "full", device: "desktop", kind: "all", review: null };
let resizeObserver;
let previewTimer;

function localUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, location.href);
    return url.origin === location.origin && ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function caseKind(item) {
  return item.kind === "规则示意" ? "规则示意" : item.kind === "真实智能体试验" ? "真实智能体试验" : "待生成";
}

function statusLabel(status) {
  return { planned: "尚未制作", generated: "已生成", verified: "已生成（附技术记录）", failed: "生成失败" }[status] || "状态待确认";
}

function currentCase() {
  return state.cases.find((item) => item.id === state.selectedId);
}

function currentArm(item) {
  return Array.isArray(item?.arms) ? item.arms.find((arm) => arm.id === state.arm) : null;
}

function canOpen(arm) {
  return arm && ["generated", "verified"].includes(arm.status) && localUrl(arm.url);
}

function setPressed(selector, attribute, value) {
  document.querySelectorAll(selector).forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset[attribute] === value));
  });
}

function renderList() {
  const term = $("#case-search").value.trim().toLocaleLowerCase("zh-CN");
  const category = $("#category-filter").value;
  const filtered = state.cases.filter((item) => {
    const text = [item.title, item.brief, item.category, item.task].join(" ").toLocaleLowerCase("zh-CN");
    return (!term || text.includes(term)) && (category === "all" || item.category === category) && (state.kind === "all" || caseKind(item) === state.kind);
  });
  const list = $("#case-list");
  list.replaceChildren();
  $("#filter-count").textContent = `${filtered.length} / ${state.cases.length}`;
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "list-placeholder";
    empty.textContent = "没有符合条件的场景。试试其他类型或关键词。";
    list.append(empty);
    return;
  }
  filtered.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "case-item";
    button.setAttribute("aria-pressed", String(item.id === state.selectedId));
    button.setAttribute("aria-controls", "case-title preview-stage");
    const number = document.createElement("span");
    number.className = "item-number";
    number.textContent = String(state.cases.indexOf(item) + 1).padStart(2, "0");
    const content = document.createElement("span");
    const title = document.createElement("span");
    title.className = "item-title";
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.className = "item-meta";
    meta.textContent = `${caseKind(item) === "待生成" ? "尚未制作" : caseKind(item)} · ${item.arms?.some(arm => arm.visualRevision) ? "含视觉修订版" : statusLabel(item.status)}`;
    content.append(title, meta);
    button.append(number, content);
    button.addEventListener("click", () => {
      state.selectedId = item.id;
      renderList();
      renderPreview();
      const selectedButton = [...list.querySelectorAll(".case-item")].find((entry) => entry.getAttribute("aria-pressed") === "true");
      selectedButton?.focus({ preventScroll: true });
    });
    list.append(button);
  });
}

function resizePreview() {
  const shell = $("#frame-shell");
  if (shell.hidden) return;
  const stage = $("#preview-stage");
  const style = getComputedStyle(stage);
  const available = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const width = state.device === "mobile" ? 390 : 1440;
  const height = state.device === "mobile" ? 844 : 1000;
  const scale = Math.min(1, Math.max(0.1, available / width));
  shell.style.width = `${width * scale}px`;
  shell.style.height = `${height * scale}px`;
  const frame = $("#case-frame");
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  frame.style.transform = `scale(${scale})`;
}

function renderPreview() {
  const item = currentCase();
  if (!item) return;
  const arm = currentArm(item);
  const url = canOpen(arm);
  const kind = caseKind(item);
  const number = String(state.cases.indexOf(item) + 1).padStart(2, "0");
  $("#case-meta").textContent = `${item.category || "场景"} / ${item.mode || "模式待确认"} / ${kind === "待生成" ? "尚未制作" : kind}`;
  $("#case-title").textContent = item.title;
  $("#case-brief").textContent = item.brief || "在相同需求下，逐页比较三种生成条件。";
  $("#case-number").textContent = number;
  $("#case-task").textContent = typeof item.task === "string" ? item.task : "原始需求尚未提供。";
  setPressed("[data-arm]", "arm", state.arm);
  setPressed("[data-device]", "device", state.device);
  $("#size-note").textContent = state.device === "mobile" ? "手机布局 · 390 像素宽 · 按区域等比缩放" : "桌面布局 · 1440 像素宽 · 按区域等比缩放";

  const frame = $("#case-frame");
  const openPage = $("#open-page");
  $("#empty-state").hidden = Boolean(url);
  $("#frame-shell").hidden = !url;
  openPage.hidden = !url;
  if (url) {
    if (frame.getAttribute("src") !== url) {
      clearTimeout(previewTimer);
      frame.style.visibility = "hidden";
      $("#frame-loading").hidden = false;
      $("#frame-loading").textContent = "正在加载这一页…";
      frame.onload = () => {
        if (frame.getAttribute("src") !== url) return;
        clearTimeout(previewTimer);
        frame.style.visibility = "visible";
        $("#frame-loading").hidden = true;
      };
      frame.src = url;
      previewTimer = setTimeout(() => {
        if (frame.getAttribute("src") === url) $("#frame-loading").textContent = "预览尚未加载完成，可打开独立页面继续查看。";
      }, 8000);
    }
    frame.title = `${item.title}：${armLabels[state.arm]}的页面预览`;
    openPage.href = url;
  } else {
    clearTimeout(previewTimer);
    $("#frame-loading").hidden = true;
    frame.removeAttribute("src");
    openPage.removeAttribute("href");
    $("#empty-title").textContent = arm?.status === "failed" ? "本次生成未成功" : ["generated", "verified"].includes(arm?.status) ? "页面地址待补充" : "这个条件的页面尚未制作";
    $("#empty-description").textContent = `${armLabels[state.arm]} · ${item.title}。${arm?.status === "failed" ? "当前保留失败状态，不能打开预览。" : "索引已列出需求，暂时没有可查看的成品。"}`;
  }

  const checkLabels = { pass: "所列自动检查通过（覆盖范围见记录）", fail: "自动检查发现问题，保留失败记录", unknown: "存在无法判断项", not_run: "尚未运行", not_applicable: "该项不适用" };
  const available = ["generated", "verified"].includes(arm?.status);
  const reviewed = state.arm === "full" && item.mode !== "只审阅" && state.review?.independentVisual && available;
  const status = $("#evidence-status");
  status.replaceChildren();
  const lines = [
    `产物：${armLabels[state.arm]} · ${arm?.visualRevision ? `${arm.visualRevision.version}视觉修订版，原始生成另存` : `${statusLabel(arm?.status || "planned")}${available ? item.mode === "只审阅" ? "的审阅报告，未改写输入" : "；原始生成结果" : ""}`}`,
    `技术：${available ? checkLabels[arm.technicalStatus] || "待验证" : "尚无可验收产物"}。`,
    `模型视觉：${reviewed ? "已完成本批次四宽审查与问题复核；不代表全部状态通过" : state.arm === "full" && !state.review ? "本轮审查记录未读取，状态待确认" : "本轮未进行独立视觉审查"}。`,
    "人工与真机：待验（MANUAL_PENDING）。"
  ];
  if (kind === "规则示意") lines.push("规则示意：用于说明方法，不作为真实智能体试验的效果证据。");
  for (const line of lines) { const p = document.createElement("p"); p.textContent = line; status.append(p); }
  const originalUrl = localUrl(arm?.visualRevision?.originalUrl);
  $("#open-original").hidden = !originalUrl;
  if (originalUrl) $("#open-original").href = originalUrl;
  else $("#open-original").removeAttribute("href");
  if (arm?.protocolNotes?.length) {
    const note = document.createElement("p"); note.className = "status-note";
    note.textContent = `过程说明：${arm.protocolNotes.map(note => typeof note === "string" ? note : JSON.stringify(note)).join("；")}。本条件不作为完整流程严格对照。`;
    status.append(note);
  }
  const evidenceUrl = localUrl(item.evidenceUrl);
  $("#evidence-link").hidden = !evidenceUrl;
  if (evidenceUrl) $("#evidence-link").href = evidenceUrl;
  else $("#evidence-link").removeAttribute("href");
  $("#open-input").hidden = item.mode !== "只审阅";
  if (item.mode === "只审阅") $("#open-input").href = `./inputs/${encodeURIComponent(item.id)}/index.html`;
  else $("#open-input").removeAttribute("href");
  resizePreview();
}

function updateTypesetting() {
  $("#type-output").textContent = $("#type-input").value.trim() || "留一点空白，\n等一句好内容。";
  $("#type-canvas").dataset.layout = $("#type-layout").value;
}

async function loadCases() {
  try {
    const response = await fetch("./cases.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`索引读取失败（${response.status}）。`);
    const data = await response.json();
    if (!data || !Array.isArray(data.cases) || data.cases.some((item) => !item || typeof item.id !== "string" || typeof item.title !== "string")) throw new Error("场景索引格式不完整。");
    if (!data.cases.length) throw new Error("场景索引目前为空。");
    state.cases = data.cases;
    try {
      const reviewResponse = await fetch("./review-v2.json", { cache: "no-store" });
      if (reviewResponse.ok) state.review = await reviewResponse.json();
    } catch { state.review = null; }
    state.selectedId = (state.cases.find((item) => item.arms?.some((arm) => canOpen(arm))) || state.cases[0]).id;
    const firstAvailable = currentCase().arms?.find((arm) => armIds.includes(arm.id) && canOpen(arm));
    if (!canOpen(currentArm(currentCase())) && firstAvailable) state.arm = firstAvailable.id;
    const categories = [...new Set(state.cases.map((item) => item.category).filter(Boolean))];
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      $("#category-filter").append(option);
    });
    $("#scene-count").textContent = String(state.cases.length);
    $("#real-count").textContent = String(state.cases.filter((item) => caseKind(item) === "真实智能体试验" && item.arms?.some((arm) => canOpen(arm))).length);
    renderList();
    renderPreview();
  } catch (error) {
    $("#data-error").hidden = false;
    $("#data-error").textContent = `暂时无法读取场景索引。${error instanceof Error ? error.message : "请稍后重试。"}\n请通过本地站点访问，并确认场景数据文件已就绪。标题试排仍可使用。`;
    $("#case-list").replaceChildren();
    $("#filter-count").textContent = "读取失败";
    $("#case-title").textContent = "场景索引暂不可用";
    $("#case-brief").textContent = "页面没有加载到场景数据；当前不展示任何生成成果。";
    $("#empty-title").textContent = "等待场景数据";
    $("#empty-description").textContent = "数据恢复后重新打开页面，即可浏览场景与生成结果。";
    $("#evidence-status").textContent = "未读取到数据，无法确认成果状态。";
  } finally {
    $("#workbench").setAttribute("aria-busy", "false");
  }
}

$("#type-form").addEventListener("submit", (event) => event.preventDefault());
$("#type-input").addEventListener("input", updateTypesetting);
$("#type-layout").addEventListener("change", updateTypesetting);
$("#case-search").addEventListener("input", renderList);
$("#category-filter").addEventListener("change", renderList);
document.querySelectorAll("[data-kind]").forEach((button) => button.addEventListener("click", () => {
  state.kind = button.dataset.kind;
  setPressed("[data-kind]", "kind", state.kind);
  renderList();
}));
document.querySelectorAll("[data-arm]").forEach((button) => button.addEventListener("click", () => {
  if (!armIds.includes(button.dataset.arm)) return;
  state.arm = button.dataset.arm;
  renderPreview();
}));
document.querySelectorAll("[data-device]").forEach((button) => button.addEventListener("click", () => {
  state.device = button.dataset.device;
  renderPreview();
}));
if (typeof ResizeObserver === "function") {
  resizeObserver = new ResizeObserver(resizePreview);
  resizeObserver.observe($("#preview-stage"));
} else window.addEventListener("resize", resizePreview);
loadCases();
