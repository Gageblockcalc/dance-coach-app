/* Procedural dance venues drawn behind the coach / camera view. Low quality or reduce motion = static gradient. */
import { UNLOCK, level } from "./progress.js";
export const STAGES = [
  { id: "club", name: "Club", a: "#1b0b3a", b: "#05020d", lights: ["#ff4fd8", "#7fd3ff", "#b8ff00"] },
  { id: "festival", name: "Festival", a: "#ff8a3d", b: "#2a0f4a", lights: ["#ffd23f", "#ff4f7a", "#58c8ff"] },
  { id: "rooftop", name: "Rooftop", a: "#0b1a3a", b: "#02040c", lights: ["#9fe8ff", "#ffd23f", "#ff9cf0"] },
  { id: "halloween", name: "Halloween", a: "#2a0f3a", b: "#0a0410", lights: ["#ff8a00", "#7dff6a", "#b07aff"] },
  { id: "aurora", name: "Aurora", a: "#06283d", b: "#02060f", lights: ["#7dffc2", "#58c8ff", "#c9b6ff"], lvl: UNLOCK.aurora },
  { id: "sunrise", name: "Sunrise", a: "#ff9a5a", b: "#3a1456", lights: ["#ffe08a", "#ff7aa8", "#9fe8ff"], lvl: UNLOCK.sunrise },
];
export const stageLocked = (s) => !!s.lvl && level() < s.lvl;
export const getStage = () => { const s = STAGES.find((x) => x.id === localStorage.getItem("dc.stage")) || STAGES[0]; return stageLocked(s) ? STAGES[0] : s; };
const cache = new Map();
function base(st, W, H) { // static layer cached per size
  const k = st.id + W + "x" + H; if (cache.has(k)) return cache.get(k);
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, st.a); gr.addColorStop(1, st.b); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  let r = 7; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  if (st.id === "rooftop") { for (let i = 0; i < 60; i++) { g.fillStyle = "rgba(255,255,255," + (0.3 + rnd() * 0.6) + ")"; g.fillRect(rnd() * W, rnd() * H * 0.45, 1.5, 1.5); }
    for (let x = 0; x < W;) { const w = W * (0.05 + rnd() * 0.08), h = H * (0.15 + rnd() * 0.35); g.fillStyle = "#0a0f22"; g.fillRect(x, H * 0.78 - h, w, h); g.fillStyle = "rgba(255,210,63,.55)"; for (let y = H * 0.78 - h + 6; y < H * 0.76; y += 9) for (let wx = x + 4; wx < x + w - 4; wx += 8) if (rnd() > 0.55) g.fillRect(wx, y, 3, 4); x += w + 2; }
    g.fillStyle = "#151a2e"; g.fillRect(0, H * 0.78, W, H); }
  if (st.id === "festival") { g.fillStyle = "#1a0830"; g.beginPath(); g.moveTo(0, H * 0.8); for (let x = 0; x <= W; x += W / 24) g.lineTo(x, H * 0.8 - Math.abs(Math.sin(x * 0.37)) * H * 0.06); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = "rgba(43,20,80,.75)"; g.fillRect(W * 0.06, H * 0.1, W * 0.025, H * 0.7); g.fillRect(W * 0.915, H * 0.1, W * 0.025, H * 0.7); g.fillRect(W * 0.06, H * 0.08, W * 0.88, H * 0.025); }
  if (st.id === "club") { g.strokeStyle = "rgba(127,211,255,.18)"; g.lineWidth = 1; for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(W / 2 + i * W * 0.03, H * 0.72); g.lineTo(W / 2 + i * W * 0.12, H); g.stroke(); } g.beginPath(); g.moveTo(0, H * 0.72); g.lineTo(W, H * 0.72); g.stroke(); }
  if (st.id === "halloween") { g.fillStyle = "rgba(255,240,200,.9)"; g.beginPath(); g.arc(W * 0.8, H * 0.2, H * 0.08, 0, 7); g.fill();
    g.fillStyle = "#14081c"; g.beginPath(); g.moveTo(0, H * 0.82); for (let x = 0; x <= W; x += W / 10) g.lineTo(x, H * 0.78 + Math.sin(x) * H * 0.03); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    for (const [px, s] of [[0.12, 1], [0.88, 0.8]]) { const x = W * px, y = H * 0.86, rr = H * 0.06 * s; g.fillStyle = "#ff8a00"; g.beginPath(); g.ellipse(x, y, rr * 1.2, rr, 0, 0, 7); g.fill(); g.fillStyle = "#3a1a00"; g.fillRect(x - 2, y - rr - 5, 4, 6); g.fillStyle = "#ffe08a"; g.beginPath(); g.moveTo(x - rr * 0.5, y - rr * 0.2); g.lineTo(x - rr * 0.2, y - rr * 0.2); g.lineTo(x - rr * 0.35, y - rr * 0.5); g.fill(); g.beginPath(); g.moveTo(x + rr * 0.5, y - rr * 0.2); g.lineTo(x + rr * 0.2, y - rr * 0.2); g.lineTo(x + rr * 0.35, y - rr * 0.5); g.fill(); g.fillRect(x - rr * 0.5, y + rr * 0.2, rr, rr * 0.18); } }
  cache.set(k, c); if (cache.size > 12) cache.delete(cache.keys().next().value); return c;
}
/* full = draw background; overlay = only light beams (on top of camera feed). beat = fractional beat count. */
export function drawStage(g, W, H, beat, opts = {}) {
  const st = getStage(), still = opts.still;
  if (!opts.overlay) g.drawImage(base(st, W, H), 0, 0);
  if (still) return;
  beat = Math.max(0, beat); const ph = beat % 1, pulse = Math.pow(1 - ph, 2), bi = Math.floor(beat);
  g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = opts.overlay ? 0.22 : 0.5;
  for (let i = 0; i < 3; i++) { // sweeping spotlights
    const c = st.lights[(i + bi) % 3], x0 = W * (0.2 + i * 0.3), ang = Math.sin(beat * 0.5 + i * 2) * 0.5, len = H * 1.1;
    const gr = g.createLinearGradient(x0, 0, x0 + Math.sin(ang) * len, len); gr.addColorStop(0, c); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr;
    g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + Math.sin(ang - 0.12) * len, Math.cos(ang - 0.12) * len); g.lineTo(x0 + Math.sin(ang + 0.12) * len, Math.cos(ang + 0.12) * len); g.fill(); }
  if (!opts.overlay && opts.fx !== false && st.id !== "rooftop") { g.lineWidth = Math.max(1, W / 300); g.globalAlpha = 0.35 + pulse * 0.4; // lasers
    for (let i = 0; i < 5; i++) { g.strokeStyle = st.lights[i % 3]; g.beginPath(); g.moveTo(W / 2, H * 0.05); g.lineTo(W * (i / 4) + Math.sin(beat + i) * W * 0.1, H); g.stroke(); } }
  g.globalAlpha = (opts.overlay ? 0.06 : 0.14) * (0.5 + pulse); // haze
  const hz = g.createRadialGradient(W / 2, H * 0.7, 0, W / 2, H * 0.7, W * 0.7); hz.addColorStop(0, st.lights[bi % 3]); hz.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = hz; g.fillRect(0, 0, W, H);
  g.restore();
}
