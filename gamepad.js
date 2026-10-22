// Dance Coach — controller support: Xbox / PlayStation / Switch / GameSir / 8BitDo / generic pads.
// Scans ALL pads every frame, hot-plug via events + polling, remaps non-standard pads, press-to-bind
// wizard (per pad, localStorage), matching button prompts, rumble, and an Android native key bridge.
import { S, saveSettings } from "./ui.js";
const $ = (s) => document.querySelector(s);
// Logical buttons use the W3C "standard" layout indices.
const A = 0, B = 1, LB = 4, RB = 5, SEL = 8, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;

// ---- detection ----
export const WHEEL_RE = /moza|wheel|racing|g29|g920|t300|fanatec|logitech g/i; // steering wheels never drive the UI
export function safePad(p) { return !!(p && p.connected && !WHEEL_RE.test(p.id || "") && p.buttons && p.buttons.length > 0); }
export function family(id = "") {
  const s = id.toLowerCase();
  if (/045e|xbox|xinput|x-box/.test(s)) return "xbox";
  if (/054c|playstation|dualsense|dualshock|ps[345]|wireless controller/.test(s)) return "ps";
  if (/057e|switch|pro controller|joy-con|nintendo/.test(s)) return "switch";
  if (/gamesir/.test(s)) return "gamesir";
  if (/2dc8|8bitdo/.test(s)) return "8bitdo";
  return "generic";
}
// raw button index for each logical button, used only when mapping !== "standard"
const REMAP = {
  xbox: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 8: 6, 9: 7 },
  ps: { 0: 1, 1: 2, 2: 0, 3: 3, 4: 4, 5: 5, 8: 8, 9: 9 },          // DInput: □ ✕ ○ △
  switch: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 8: 8, 9: 9 },      // positional: B(bottom) A(right)
  gamesir: { 0: 0, 1: 1, 2: 3, 3: 4, 4: 6, 5: 7, 8: 10, 9: 11 },   // DInput mode
  "8bitdo": { 0: 0, 1: 1, 2: 3, 3: 4, 4: 6, 5: 7, 8: 10, 9: 11 },
  generic: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 8: 8, 9: 9 },
};
export const LABELS = {
  xbox: { 0: "A", 1: "B", 4: "LB", 5: "RB", 8: "View", 9: "Menu" },
  ps: { 0: "✕", 1: "○", 4: "L1", 5: "R1", 8: "Share", 9: "Options" },
  switch: { 0: "B", 1: "A", 4: "L", 5: "R", 8: "−", 9: "+" },
  generic: { 0: "A", 1: "B", 4: "LB", 5: "RB", 8: "Select", 9: "Start" },
};
const labelsFor = (f) => LABELS[f] || LABELS.generic;
const padKey = (p) => "dc.pad." + (p.id || "pad").replace(/\s+/g, " ").slice(0, 80);
const binds = (p) => { try { return JSON.parse(localStorage.getItem(padKey(p)) || "null"); } catch { return null; } };
export function rawFor(p, logical) {
  const b = binds(p); if (b && b[logical] != null) return b[logical];
  if (p.mapping === "standard" && p.id !== NATIVE_ID) return logical;
  return (REMAP[family(p.id)] || REMAP.generic)[logical] ?? logical;
}
const pressed = (p, i) => { const b = p.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
// Read a pad into logical state {buttons:Set, x, y}
export function readPad(p) {
  const out = new Set();
  for (const l of [0, 1, 2, 3, 4, 5, 8, 9]) if (pressed(p, rawFor(p, l))) out.add(l);
  let x = p.axes[0] || 0, y = p.axes[1] || 0;
  const std = p.mapping === "standard" || p.id === NATIVE_ID;
  if (std) { if (pressed(p, 12)) y = -1; if (pressed(p, 13)) y = 1; if (pressed(p, 14)) x = -1; if (pressed(p, 15)) x = 1; }
  else {
    const hat = p.axes[9];                       // Chrome DInput POV hat: -1 up … 1 up-left, >1 idle
    if (hat != null && hat >= -1.05 && hat <= 1.05 && p.axes.length >= 10) { const a = Math.round((hat + 1) * 3.5) % 8; x = [0, 1, 1, 1, 0, -1, -1, -1][a]; y = [-1, -1, 0, 1, 1, 1, 0, -1][a]; }
    else if (p.axes.length >= 8 && (Math.abs(p.axes[6]) > 0.5 || Math.abs(p.axes[7]) > 0.5)) { x = p.axes[6]; y = p.axes[7]; }
    for (const [i, dx, dy] of [[12, 0, -1], [13, 0, 1], [14, -1, 0], [15, 1, 0]]) if (p.buttons.length > 15 && pressed(p, i)) { if (dx) x = dx; if (dy) y = dy; }
  }
  return { buttons: out, x, y };
}

// ---- Android native bridge (MainActivity forwards controller keys/axes here) ----
const NATIVE_ID = "Android native controller (STANDARD GAMEPAD)";
const nat = { id: NATIVE_ID, index: "native", mapping: "standard", connected: false, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), t: 0 };
const KEYMAP = { 96: 0, 97: 1, 99: 2, 100: 3, 102: 4, 103: 5, 104: 6, 105: 7, 109: 8, 108: 9, 106: 10, 107: 11, 19: 12, 20: 13, 21: 14, 22: 15, 110: 16 };
window.dcNativePad = (kind, code, v) => {
  nat.connected = true; nat.t = performance.now();
  if (kind === "key") { const i = KEYMAP[code]; if (i != null) nat.buttons[i] = { pressed: !!v, value: v ? 1 : 0 }; }
  else if (kind === "axes") { const [x, y, hx, hy] = code; nat.axes = [x, y, 0, 0]; nat.buttons[12] = { pressed: hy < -0.5 }; nat.buttons[13] = { pressed: hy > 0.5 }; nat.buttons[14] = { pressed: hx < -0.5 }; nat.buttons[15] = { pressed: hx > 0.5 }; }
};
function allPads() {
  const list = [];
  try { for (const p of navigator.getGamepads?.() || []) if (safePad(p)) list.push(p); } catch {}
  // native pad only fills in when the WebView exposes no pads (avoids double input)
  if (nat.connected && !list.length) list.push(nat);
  return list;
}

// ---- rumble ----
export function rumble(mag = 0.5, ms = 120) {
  if (!S.rumble) return;
  for (const p of allPads()) {
    try {
      if (p.vibrationActuator?.playEffect) p.vibrationActuator.playEffect("dual-rumble", { duration: ms, strongMagnitude: mag, weakMagnitude: Math.min(1, mag + 0.2) }).catch(() => {});
      else p.hapticActuators?.[0]?.pulse?.(mag, ms);
    } catch {}
  }
}

// ---- UI: toast, hint, focus ring ----
const css = document.createElement("style");
css.textContent = `#padToast{position:fixed;top:calc(12px + var(--st));left:50%;transform:translateX(-50%);background:#1b1030;color:#fff;border:2px solid #7fd3ff;border-radius:14px;padding:8px 14px;font-weight:700;z-index:60;opacity:0;transition:opacity .25s;pointer-events:none}
#padToast.show{opacity:1}#padHint{position:fixed;right:calc(16px + var(--sr));bottom:calc(20px + var(--sb));background:rgba(18,10,34,.88);color:#fff;border-radius:12px;padding:6px 10px;font-size:13px;z-index:15;display:flex;gap:10px;flex-wrap:wrap;max-width:calc(100vw - 20px)}
#padHint kbd{display:inline-block;min-width:1.4em;text-align:center;background:#fff;color:#1b1030;border-radius:6px;padding:0 4px;font:700 12px system-ui;margin-right:3px}
body.pad-on :focus{outline:4px solid #FFD23F!important;outline-offset:4px!important;box-shadow:0 0 0 8px rgba(255,210,63,.35)!important}
html.reduce #padToast{transition:none}`;
document.head.appendChild(css);
const toastEl = Object.assign(document.createElement("div"), { id: "padToast", role: "status" }); toastEl.setAttribute("aria-live", "polite");
const hint = Object.assign(document.createElement("div"), { id: "padHint", hidden: true }); hint.setAttribute("aria-hidden", "true");
document.body.append(toastEl, hint);
let toastT = 0;
export function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("show"), 2200); }
let hintFam = "";
function renderHint(f) {
  if (f === hintFam) return; hintFam = f; const L = labelsFor(f);
  hint.innerHTML = `<span><kbd>${L[0]}</kbd>Select</span><span><kbd>${L[1]}</kbd>Back</span><span><kbd>${L[9]}</kbd>Play/Pause</span><span><kbd>${L[8]}</kbd>Settings</span><span><kbd>${L[4]}</kbd><kbd>${L[5]}</kbd>Song</span>`;
}

// ---- focus navigation ----
function scope() { const open = [...document.querySelectorAll(".sheet:not([hidden])")]; return open[open.length - 1] || document; }
function focusables() {
  return [...scope().querySelectorAll('button, select, a[href], .btn, input:not([type=file]):not([hidden]), [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && !el.hidden && el.offsetParent !== null && el.getClientRects().length && !el.closest("[hidden]"));
}
export function moveFocus(dx, dy) {
  const ae = document.activeElement; if (dx && ae?.type === "range") { dx > 0 ? ae.stepUp() : ae.stepDown(); ae.dispatchEvent(new Event("input", { bubbles: true })); return; }
  const els = focusables(); if (!els.length) return;
  const cur = document.activeElement; if (!els.includes(cur)) { els[0].focus(); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let best = null, bs = Infinity;
  for (const el of els) { if (el === cur) continue; const q = el.getBoundingClientRect(), ex = q.left + q.width / 2 - cx, ey = q.top + q.height / 2 - cy;
    const along = ex * dx + ey * dy; if (along <= 4) continue; const perp = Math.abs(ex * dy - ey * dx); const sc = along + perp * 2.5; if (sc < bs) { bs = sc; best = el; } }
  if (!best) { const i = els.indexOf(cur); best = els[(i + (dx + dy > 0 ? 1 : -1) + els.length) % els.length]; }
  best.focus(); best.scrollIntoView?.({ block: "nearest" });
}
function back() {
  const open = [...document.querySelectorAll(".sheet:not([hidden])")].pop();
  if (open) { const c = open.querySelector("[data-close]"); if (c) c.click(); else open.hidden = true; if (open.id === "padWizard") wiz = null; $("#settingsBtn")?.focus(); return true; }
  if (H.isPlaying()) { if (!H.isPaused()) H.start(); else H.stop(); return true; } // B pauses; B again stops
  return false;
}
function activate() {
  const el = document.activeElement;
  if (el && el.tagName === "SELECT") { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event("change", { bubbles: true })); return; }
  if (el && el !== document.body) el.click(); else focusables()[0]?.focus();
}

// ---- main loop ----
let H = {}, wiz = null;
const known = new Map(), prev = new Map(), lastAct = {};
const DEAD = 0.5, FIRST = 380, REPEAT = 130;
let dirHeld = "", dirNext = 0;
function act(name, fn) { const t = performance.now(); if (t - (lastAct[name] || 0) < 150) return; lastAct[name] = t; fn(); }
window.dcBack = () => back(); // used by the Android bridge for gamepad Back/B
function poll(now = performance.now()) {
  const pads = allPads(), ids = new Set();
  for (const p of pads) {
    const k = String(p.index) + "|" + p.id; ids.add(k);
    if (!known.has(k)) { known.set(k, p.id); toast(`🎮 Controller connected`); document.body.classList.add("pad-on"); }
  }
  for (const [k] of known) if (!ids.has(k)) { known.delete(k); prev.delete(k); toast("🎮 Controller disconnected"); }
  if (nat.connected && now - nat.t > 600000) nat.connected = false;
  hint.hidden = !pads.length; if (!pads.length) { document.body.classList.remove("pad-on"); return; }
  renderHint(family(pads[pads.length - 1].id) === "8bitdo" || family(pads[pads.length - 1].id) === "gamesir" ? "xbox" : family(pads[pads.length - 1].id));
  if (wiz) { wizardStep(pads); return; }
  let dx = 0, dy = 0;
  for (const p of pads) {
    const k = String(p.index) + "|" + p.id, st = readPad(p), was = prev.get(k) || new Set(); prev.set(k, st.buttons);
    const edge = (b) => st.buttons.has(b) && !was.has(b);
    if (edge(A)) act("a", activate);
    if (edge(B)) act("b", back);
    if (edge(START)) act("start", () => { const open = document.querySelector(".sheet:not([hidden])"); if (open) back(); else H.start(); });
    if (edge(SEL)) act("sel", () => { if (!$("#settings").hidden) back(); else $("#settingsBtn")?.click(); });
    if (edge(LB)) act("lb", () => H.song(-1));
    if (edge(RB)) act("rb", () => H.song(1));
    if (Math.abs(st.x) > DEAD && Math.abs(st.x) >= Math.abs(st.y)) dx = Math.sign(st.x); else if (Math.abs(st.y) > DEAD) dy = Math.sign(st.y);
  }
  const dir = dx || dy ? `${dx},${dy}` : "";
  if (!dir) dirHeld = ""; else if (dir !== dirHeld) { dirHeld = dir; dirNext = now + FIRST; moveFocus(dx, dy); } else if (now >= dirNext) { dirNext = now + REPEAT; moveFocus(dx, dy); }
}
let looping = false;
const anyPad = () => [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(Boolean);
function loop(t) { poll(t); if (anyPad()) requestAnimationFrame(loop); else looping = false; }
function startLoop() { if (!looping) { looping = true; requestAnimationFrame(loop); } }

// ---- press-to-bind wizard ----
const STEPS = [[A, "Select / confirm"], [B, "Back"], [START, "Start / pause"], [SEL, "Settings"], [LB, "Previous song"], [RB, "Next song"]];
function openWizard() {
  const p = allPads().pop(); if (!p) { toast("Connect a controller first"); return; }
  let el = $("#padWizard");
  if (!el) { el = document.createElement("div"); el.id = "padWizard"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Controller setup");
    el.innerHTML = `<div><h2 tabindex="-1">🎮 Controller setup</h2><p id="wizPad" class="note"></p><p id="wizMsg" style="font-size:20px;font-weight:800" aria-live="assertive"></p><div class="row grow"><button id="wizSkip" class="link">Skip</button><button id="wizCancel" data-close>Cancel</button></div></div>`;
    document.body.appendChild(el);
    el.querySelector("#wizCancel").onclick = () => { el.hidden = true; wiz = null; };
    el.querySelector("#wizSkip").onclick = () => wiz && nextStep(); }
  el.hidden = false; el.querySelector("h2").focus();
  wiz = { pad: p, i: -1, map: {}, base: null };
  el.querySelector("#wizPad").textContent = `${p.id} · detected as ${family(p.id)}`;
  nextStep();
}
function nextStep() {
  wiz.i++; const msg = $("#wizMsg");
  if (wiz.i >= STEPS.length) { localStorage.setItem(padKey(wiz.pad), JSON.stringify(wiz.map)); msg.textContent = "✅ Saved for this controller!"; rumble(0.6, 200); const w = wiz; wiz = null; setTimeout(() => { if (!wiz) $("#padWizard").hidden = true; }, 1200); return w; }
  msg.textContent = `Press the button for: ${STEPS[wiz.i][1]}`; wiz.base = null;
}
function wizardStep(pads) {
  const p = pads.find((q) => q.id === wiz.pad.id) || pads[0]; if (!p) return;
  const now = p.buttons.map((b) => b.pressed || b.value > 0.5);
  if (!wiz.base) { wiz.base = now; return; }
  const i = now.findIndex((v, j) => v && !wiz.base[j]);
  if (i >= 0) { wiz.map[STEPS[wiz.i][0]] = i; rumble(0.3, 60); wiz.base = now.map(() => true); setTimeout(() => wiz && (wiz.base = null), 250); nextStep(); }
  else wiz.base = wiz.base.map((v, j) => v && now[j]);
}
function settingsRows() {
  const box = $("#settingsList"); if (!box || $("#padSetup")) return;
  const row = document.createElement("div"); row.className = "row";
  row.innerHTML = `<button id="padSetup" class="b-soft">🎮 Set up controller buttons</button><button id="padReset" class="link">Reset controller buttons</button>`;
  box.after(row);
  $("#padSetup").onclick = openWizard;
  $("#padReset").onclick = () => { Object.keys(localStorage).filter((k) => k.startsWith("dc.pad.")).forEach((k) => localStorage.removeItem(k)); toast("Controller buttons reset"); };
}

export function initPads(hooks) {
  H = hooks; if (S.rumble == null) { S.rumble = true; saveSettings(); }
  window.addEventListener("gamepadconnected", () => { poll(); startLoop(); });
  window.addEventListener("gamepaddisconnected", () => poll());
  settingsRows(); startLoop();
}
export const _test = { poll, readPad, family, nextStep, openWizard, get wiz() { return wiz; } };
