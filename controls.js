// Controls guide: '?' button, hold H/? (keyboard), long-press ? (touch), hold View/Select (pad). Never covers the stage while dancing.
import { LABELS, family, safePad } from "./gamepad.js";
let mode = "touch", famNow = "generic";
const $ = (s) => document.querySelector(s);
addEventListener("keydown", () => (mode = "keys"), true);
addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") mode = "touch"; else if (mode !== "pad") mode = "keys"; }, true);
function html() {
  if (mode === "pad") { const L = LABELS[famNow] || LABELS.generic;
    return `<b>🎮 Controller</b><span><kbd>${L[0]}</kbd> select</span><span><kbd>${L[1]}</kbd> back / pause</span><span><kbd>${L[9]}</kbd> start / pause</span><span><kbd>${L[8]}</kbd> settings (hold: this guide)</span><span><kbd>${L[4]}</kbd><kbd>${L[5]}</kbd> change song</span><span><kbd>✛</kbd> move</span>`; }
  if (mode === "keys") return `<b>⌨️ Keyboard</b><span><kbd>Space</kbd> start / pause</span><span><kbd>Esc</kbd> back</span><span><kbd>Tab</kbd> / <kbd>←↑→↓</kbd> move</span><span><kbd>Enter</kbd> select</span><span>hold <kbd>H</kbd> this guide</span>`;
  return `<b>👆 Touch</b><span>Tap ▶ Start, then step back so your whole body shows.</span><span>Tap ■ Stop to finish and see your stars.</span><span>⚙️ settings · long-press ? for this guide</span>`;
}
let box;
function show(on) { if (!box) return; if (on) box.innerHTML = html(); box.classList.toggle("show", on); box.setAttribute("aria-hidden", on ? "false" : "true"); }
export function showControls(ms = 0) { show(true); if (ms) setTimeout(() => show(false), ms); }
export function initControls() {
  const css = document.createElement("style");
  css.textContent = `#ctl{position:fixed;inset-inline:calc(12px + var(--sl)) calc(12px + var(--sr));bottom:calc(12px + var(--sb));max-width:520px;margin-inline:auto;z-index:70;background:rgba(18,10,34,.94);color:#fff;border:2px solid #7fd3ff;border-radius:18px;padding:10px 14px;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px;opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .2s,transform .2s}
#ctl.show{opacity:1;transform:none}#ctl b{flex-basis:100%}#ctl kbd{background:#2b1d4f;border-radius:6px;padding:1px 6px;font:inherit;font-weight:800}
body.dancing:not(.paused) #ctl{top:calc(8px + var(--st));bottom:auto;font-size:12px;padding:6px 10px;max-width:420px}
#helpBtn{font-size:20px}`;
  document.head.append(css);
  box = document.createElement("div"); box.id = "ctl"; box.setAttribute("role", "note"); box.setAttribute("aria-hidden", "true"); document.body.append(box);
  const b = $("#helpBtn"); let lp = 0;
  if (b) {
    b.onclick = () => { show(!box.classList.contains("show")); };
    b.addEventListener("pointerdown", () => { lp = setTimeout(() => show(true), 450); });
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(ev, () => { clearTimeout(lp); });
  }
  const isField = (t) => t && /INPUT|SELECT|TEXTAREA/.test(t.tagName);
  addEventListener("keydown", (e) => { if ((e.key === "h" || e.key === "H" || e.key === "?") && !isField(e.target) && !e.repeat) show(true); });
  addEventListener("keyup", (e) => { if (e.key === "h" || e.key === "H" || e.key === "?") show(false); });
  let held = 0, padShown = false;
  let polling = false; const startPoll = () => { if (!polling) { polling = true; requestAnimationFrame(poll); } };
  addEventListener("gamepadconnected", startPoll); if ([...(navigator.getGamepads ? navigator.getGamepads() : [])].some(Boolean)) startPoll();
  function poll(ts) {
    let sel = false;
    for (const p of navigator.getGamepads ? navigator.getGamepads() : []) if (safePad(p)) { if (p.buttons.some((x) => x.pressed)) { mode = "pad"; famNow = family(p.id); } if (p.buttons[8]?.pressed) sel = true; }
    if (sel) { held ||= ts; if (ts - held > 500 && !padShown) { padShown = true; show(true); } }
    else { if (padShown) show(false); held = 0; padShown = false; }
    if ([...(navigator.getGamepads ? navigator.getGamepads() : [])].some(Boolean)) requestAnimationFrame(poll); else polling = false;
  }
  if (!localStorage.getItem("dc.ctlHint")) { localStorage.setItem("dc.ctlHint", "1"); setTimeout(() => showControls(4000), 1200); }
}
