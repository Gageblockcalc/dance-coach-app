// Shared features: first-run tips, ghost replay of your best run, local personal-best board. All local, nothing uploaded.
const LMK = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]; // shoulders, arms, hips, legs
const BONES = [[0, 2], [2, 4], [1, 3], [3, 5], [6, 8], [8, 10], [7, 9], [9, 11], [0, 1], [6, 7], [0, 6], [1, 7]];
const HZ = 8, MAXF = HZ * 240, KEEP = 12;
const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } } };

// ---- tips (toasts) ----
const TIPS = ["📷 Tap “Turn on camera” and allow access — video never leaves your device.", "🧍 Step back until your whole body fits in the picture.", "▶ Press Start and copy Coach Disco Dan’s moves.", "⚙️ Settings has Sparkle effects, Reduce motion and your Ghost replay."];
let tipBox, tipI = 0, tipT = 0;
function tipShow() {
  clearTimeout(tipT); if (tipI >= TIPS.length) return tipEnd();
  tipBox.querySelector("span").textContent = TIPS[tipI]; tipBox.querySelector("small").textContent = `${tipI + 1}/${TIPS.length}`; tipBox.hidden = false;
  tipT = setTimeout(() => { tipI++; tipShow(); }, 5200);
}
function tipEnd() { clearTimeout(tipT); if (tipBox) tipBox.hidden = true; localStorage.setItem("dc.tips", "1"); }
export function showTips() { tipI = 0; tipShow(); }
export function initTips() {
  const css = document.createElement("style");
  css.textContent = `#tips{position:fixed;inset-inline:calc(12px + var(--sl,0px)) calc(12px + var(--sr,0px));bottom:calc(84px + var(--sb,0px));max-width:480px;margin-inline:auto;z-index:65;background:#2b1d4f;color:#fff;border:2px solid #B8FF00;border-radius:16px;padding:10px 12px;display:flex;gap:10px;align-items:center;font-size:15px;box-shadow:0 6px 24px #0008;animation:tipIn .3s ease-out}#tips span{flex:1}#tips small{color:#cfc6e6}#tips button{min-width:44px;min-height:44px}@keyframes tipIn{from{opacity:0;transform:translateY(10px)}}html.reduce #tips{animation:none}@media (prefers-reduced-motion:reduce){#tips{animation:none}}body.dancing:not(.paused) #tips{display:none}.pb{margin-top:12px;text-align:start;max-width:340px;margin-inline:auto}.pb h3{margin:0 0 4px;font-size:16px}.pb ol{list-style:none;margin:0;padding:0}.pb li{display:flex;gap:8px;align-items:baseline;padding:3px 6px;border-radius:8px}.pb li small{margin-inline-start:auto;color:#cfc6e6}.pb li.me{background:#3a2a66;outline:2px solid #FFD23F}.judge{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px;font-weight:800;font-size:14px}.judge span{padding:3px 10px;border-radius:999px;background:#2b1d4f}.j-p{color:#FFD23F}.j-g{color:#B8FF00}.j-o{color:#7fd3ff}.j-m{color:#ff8a8a}.j-c{color:#fff;outline:2px solid #ff4fd8}@keyframes dcBeat{0%{box-shadow:0 0 0 0 rgba(255,79,216,.75),0 0 22px rgba(127,211,255,.6)}70%{box-shadow:0 0 0 12px rgba(255,79,216,0),0 0 0 rgba(127,211,255,0)}100%{box-shadow:none}}body.dancing:not(.paused) #startBtn{animation:dcBeat var(--spb,.6s) ease-out infinite}html.reduce body.dancing #startBtn{animation:none}@media (prefers-reduced-motion:reduce){body.dancing #startBtn{animation:none}}#stage{box-shadow:0 0 0 2px rgba(255,79,216,.35),0 0 28px rgba(127,211,255,.18)}.volRow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.volRow input{flex:1;min-width:120px;accent-color:#ff4fd8;min-height:32px}.volRow output{min-width:3.5em;text-align:end;font-weight:800}.tipsBox{margin:12px auto 0;max-width:420px;text-align:start}.tipsBox h3{margin:0 0 4px;font-size:16px}.tipsBox ul{margin:0 0 8px;padding-inline-start:18px}.tipsBox li{margin:4px 0}`;
  document.head.append(css);
  tipBox = document.createElement("div"); tipBox.id = "tips"; tipBox.hidden = true; tipBox.setAttribute("role", "status"); tipBox.setAttribute("aria-live", "polite");
  tipBox.innerHTML = `<span></span><small></small><button class="icon" id="tipNext" aria-label="Next tip">›</button><button class="icon" id="tipClose" aria-label="Dismiss tips">✕</button>`;
  document.body.append(tipBox);
  tipBox.querySelector("#tipNext").onclick = () => { tipI++; tipShow(); };
  tipBox.querySelector("#tipClose").onclick = tipEnd;
  const go = () => { if (!localStorage.getItem("dc.tips")) setTimeout(showTips, 600); };
  const ob = document.getElementById("onboard"); // wait until the welcome screen is closed
  if (ob && !ob.hidden) new MutationObserver((m, o) => { if (ob.hidden) { o.disconnect(); go(); } }).observe(ob, { attributes: true, attributeFilter: ["hidden"] }); else go();
}

// ---- ghost replay ----
let rec = null, lastRec = -1, ghost = null;
const enc = (a) => btoa(String.fromCharCode(...a));
const dec = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export function ghostStart(key) {
  rec = []; lastRec = -1;
  const g = ls.get("dc.ghost." + key, null); ghost = g?.f ? { f: g.f.map(dec), pct: g.pct } : null;
}
export function ghostRecord(t, pose) {
  if (!rec || !pose || rec.length >= MAXF) return; const i = Math.floor(t * HZ); if (i <= lastRec || i < 0) return;
  const fr = new Uint8Array(LMK.length * 2); LMK.forEach((k, j) => { const p = pose[k]; fr[j * 2] = Math.max(0, Math.min(255, Math.round((p?.x ?? 0) * 255))); fr[j * 2 + 1] = Math.max(0, Math.min(255, Math.round((p?.y ?? 0) * 255))); });
  while (rec.length < i) rec.push(rec.length ? rec[rec.length - 1] : fr); rec.push(fr); lastRec = i;
}
export function ghostDraw(g, t, W, H) { // call inside the mirrored camera transform
  if (!ghost || !window.dcGhostOn?.()) return; const fr = ghost.f[Math.floor(t * HZ)]; if (!fr) return;
  g.save(); g.globalAlpha = 0.35; g.strokeStyle = "#7fd3ff"; g.lineWidth = 8; g.lineCap = "round"; g.setLineDash([2, 10]);
  for (const [a, b] of BONES) { g.beginPath(); g.moveTo(fr[a * 2] / 255 * W, fr[a * 2 + 1] / 255 * H); g.lineTo(fr[b * 2] / 255 * W, fr[b * 2 + 1] / 255 * H); g.stroke(); }
  g.restore();
}
export const hasGhost = () => !!ghost;
function ghostSave(key, pct) {
  if (!rec || rec.length < HZ * 3) return false; const old = ls.get("dc.ghost." + key, null); if (old && old.pct >= pct) return false;
  const idx = ls.get("dc.ghostIdx", []).filter((k) => k !== key); idx.push(key); while (idx.length > KEEP) localStorage.removeItem("dc.ghost." + idx.shift());
  let ok = ls.set("dc.ghost." + key, { pct, f: rec.map(enc) }); if (!ok && idx.length > 1) { localStorage.removeItem("dc.ghost." + idx.shift()); ok = ls.set("dc.ghost." + key, { pct, f: rec.map(enc) }); }
  ls.set("dc.ghostIdx", idx); return ok;
}

// ---- personal-best board ----
export function finishRun(key, pct) {
  const board = ls.get("dc.pb." + key, []), at = Date.now(); board.push({ pct, at }); board.sort((a, b) => b.pct - a.pct || a.at - b.at); const top = board.slice(0, 5); ls.set("dc.pb." + key, top);
  const newGhost = ghostSave(key, pct); rec = null;
  return { top, at, rank: top.findIndex((r) => r.at === at) + 1, newGhost };
}
export function boardHTML(res, title) {
  const rows = res.top.map((r, i) => `<li${r.at === res.at ? ' class="me" aria-current="true"' : ""}><b>${["🥇", "🥈", "🥉", "4.", "5."][i]}</b> ${r.pct}% <small>${new Date(r.at).toLocaleDateString()}</small></li>`).join("");
  return `<section class="pb" aria-label="Personal bests"><h3>🏆 Your top 5 · ${title}</h3><ol>${rows}</ol>${res.rank === 1 && res.top.length > 1 ? '<div class="note">New personal best!</div>' : ""}${res.newGhost ? '<div class="note">👻 Saved as your ghost for next time.</div>' : ""}</section>`;
}

// ---- 10-foot / TV mode: arrow-key (remote D-pad) focus navigation, big focus ring, large UI ----
export const isTV = /\b(TV|AFT[A-Z0-9]*|BRAVIA|GoogleTV|SMART-TV|Tizen|Web0S|CrKey)\b/i.test(navigator.userAgent) || new URLSearchParams(location.search).get("tv") === "1";
export function initTV(moveFocus) {
  const css = document.createElement("style");
  css.textContent = `:focus-visible{outline:4px solid #FFD23F!important;outline-offset:3px}html.big body{zoom:1.3}html.big .switch small{font-size:15px}`;
  document.head.append(css);
  addEventListener("keydown", (e) => {
    const t = e.target, D = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (!D || e.altKey || e.ctrlKey || e.metaKey) return;
    if (t && (/^(INPUT|TEXTAREA)$/.test(t.tagName) && !/^(checkbox|radio|button|range)$/.test(t.type)) || t?.isContentEditable) return;
    if (t?.type === "range" && D[0] !== 0) return; // left/right adjust sliders natively
    const tvNav = document.documentElement.classList.contains("big") || document.documentElement.classList.contains("tv") || document.body.classList.contains("pad-on");
    if (t?.tagName === "SELECT" && D[0] === 0 && !tvNav) return; // desktop: up/down change the choice; TV/remote: arrows always move
    if (document.body.classList.contains("dancing") && !document.body.classList.contains("paused") && !document.querySelector(".sheet:not([hidden])")) return;
    e.preventDefault(); moveFocus(D[0], D[1]);
  });
  addEventListener("keydown", (e) => { const t = e.target; if (e.key === "Enter" && t?.tagName === "SELECT" && (document.documentElement.classList.contains("big") || document.documentElement.classList.contains("tv"))) { e.preventDefault(); t.selectedIndex = (t.selectedIndex + 1) % t.options.length; t.dispatchEvent(new Event("change", { bubbles: true })); } });
  if (isTV) document.documentElement.classList.add("tv");
}
