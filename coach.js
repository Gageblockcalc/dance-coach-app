// On-device run feedback: which body part needs work, arm height, timing (early/late), weakest part of the song, difficulty hint.
import { similarity, wrap } from "./moves.js";
const PART = ["left arm", "left forearm", "right arm", "right forearm", "left leg", "left lower leg", "right leg", "right lower leg"];
const GROUP = { arms: [0, 1, 2, 3], legs: [4, 5, 6, 7] };
let st = null;
export function coachReset() { st = { err: new Float32Array(8), cnt: new Float32Array(8), armLow: 0, armN: 0, now: 0, late: 0, early: 0, tn: 0, thirds: [[0, 0], [0, 0], [0, 0]], t: 0 }; }
export function coachAdd(u, ref, refV, t, dur, latePose, earlyPose) {
  if (!st || !u || !(t >= 0)) return;
  for (let i = 0; i < 8; i++) { if (u.v[i] < 0.4) continue; st.err[i] += Math.abs(wrap(u.a[i] - ref[i])); st.cnt[i]++; }
  for (const i of [0, 2]) if (u.v[i] >= 0.4 && Math.abs(ref[i]) > 45) { st.armN++; if (Math.abs(u.a[i]) < Math.abs(ref[i]) - 20) st.armLow++; }
  const sN = similarity(u, ref, refV); if (sN == null) return;
  if (latePose && earlyPose) { const sL = similarity(u, latePose), sE = similarity(u, earlyPose); if (sL != null && sE != null) { st.tn++; if (sL > sN + 0.04 && sL > sE) st.late++; else if (sE > sN + 0.04 && sE > sL) st.early++; else st.now++; } }
  const k = Math.max(0, Math.min(2, Math.floor((t / Math.max(1, dur)) * 3))); st.thirds[k][0] += sN; st.thirds[k][1]++; st.t = t;
}
export function coachReport(pct, diff) {
  if (!st) return null; const tips = [];
  const avg = [...st.err].map((e, i) => (st.cnt[i] > 10 ? e / st.cnt[i] : 0)); const worst = avg.indexOf(Math.max(...avg));
  const grp = (g) => GROUP[g].reduce((s, i) => s + avg[i], 0) / 4;
  if (avg[worst] > 18) tips.push(`🎯 Focus on your <b>${grp("arms") >= grp("legs") ? "arms" : "legs"}</b> — your ${PART[worst]} was furthest from Coach Disco Dan.`);
  if (st.armN > 20 && st.armLow / st.armN > 0.35) tips.push("🙌 Raise your arms higher — reach all the way up on the big moves.");
  if (st.tn > 20) { if (st.late / st.tn > 0.3) tips.push("⏱️ You were about half a beat late — try moving right on the beat."); else if (st.early / st.tn > 0.3) tips.push("⏱️ You were a little early — wait for the beat before you switch moves."); else if (st.now / st.tn > 0.6) tips.push("🎵 Great timing — you stayed right on the beat!"); }
  const th = st.thirds.map(([s, n]) => (n > 10 ? s / n : null)); const valid = th.filter((x) => x != null);
  if (valid.length >= 2) { const lo = Math.min(...valid), i = th.indexOf(lo); if (Math.max(...valid) - lo > 0.08) tips.push(`📍 The ${["start", "middle", "end"][i]} of the song was your toughest part — practise that bit.`); }
  if (!tips.length) tips.push("⭐ Nice and steady all over — keep it up!");
  let sug = null; if (diff !== "hard" && pct >= 85) sug = diff === "easy" ? "normal" : "hard"; else if (diff !== "easy" && pct < 35) sug = diff === "hard" ? "normal" : "easy";
  st = null; return { tips: tips.slice(0, 3), sug };
}
export function coachHTML(r) {
  if (!r) return ""; const name = { easy: "Easy", normal: "Normal", hard: "Hard" };
  return `<section class="tipsBox" aria-label="Coach tips"><h3>💡 Coach tips</h3><ul>${r.tips.map((t) => `<li>${t}</li>`).join("")}</ul>${r.sug ? `<button id="diffSug" class="b-sky" data-d="${r.sug}">Try ${name[r.sug]} next time</button>` : ""}</section>`;
}

// Live form cues during a song: a short tip at most every 7 s about the body part that is furthest off (on-device only).
// Rotates phrasing, never repeats the same tip text within 15 s, and gives an occasional cheer when form is on point.
const LIVE = {
  armLow: ["lift your {p} higher", "reach your {p} up tall", "stretch that {p} all the way up"],
  fore: ["match the coach with your {p}", "bend your {p} like the coach", "copy the coach's {p} shape"],
  leg: ["watch your {s} leg, copy the coach's step", "step with your {s} leg like the coach", "check your {s} foot — follow the coach"],
  gen: ["line up your {p} with the coach", "point your {p} the same way as the coach", "mirror the coach with your {p}"],
  good: ["looking sharp — keep it up!", "great form — you've got this!", "nice moves — stay on the beat!"],
};
let lv = null;
export function liveReset() { lv = { err: new Float32Array(8), low: new Float32Array(8), n: 0, last: performance.now(), said: new Map(), rot: 0, goodAt: 0 }; }
function pick(list, w, now) {
  const side = w === 0 || w === 1 || w === 4 || w === 5 ? "left" : "right";
  for (let k = 0; k < list.length; k++) {
    const txt = list[(lv.rot + k) % list.length].replace("{p}", PART[w] || "arms").replace("{s}", side);
    if (now - (lv.said.get(txt) || -1e9) >= 15000) { lv.rot++; lv.said.set(txt, now); return "Coach tip: " + txt; }
  }
  return null;
}
export function coachLive(u, ref, now) {
  if (!lv || !u || !ref) return null;
  for (let i = 0; i < 8; i++) { if (u.v[i] < 0.4) continue; lv.err[i] = lv.err[i] * 0.96 + Math.abs(wrap(u.a[i] - ref[i])) * 0.04; lv.low[i] = lv.low[i] * 0.96 + (Math.abs(ref[i]) - Math.abs(u.a[i])) * 0.04; }
  if (++lv.n < 45 || now - lv.last < 7000) return null;
  let w = 0, sum = 0; for (let i = 0; i < 8; i++) { sum += lv.err[i]; if (lv.err[i] > lv.err[w]) w = i; }
  if (lv.err[w] < 28) {
    if (sum / 8 < 14 && now - lv.goodAt > 25000) { const t = pick(LIVE.good, w, now); if (t) { lv.goodAt = lv.last = now; return t; } }
    return null;
  }
  const list = (w === 0 || w === 2) && lv.low[w] > 18 ? LIVE.armLow : w === 1 || w === 3 ? LIVE.fore : w >= 4 ? LIVE.leg : LIVE.gen;
  const t = pick(list, w, now); if (t) lv.last = now; return t;
}
