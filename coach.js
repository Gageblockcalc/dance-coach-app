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
