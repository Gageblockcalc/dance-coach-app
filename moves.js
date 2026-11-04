/** Original Coach routine (our own moves, not copied from any video).
 *  Each pose = 8 segment angles in degrees, as a filmed dancer facing the camera:
 *  [L upper arm, L forearm, R upper arm, R forearm, L thigh, L shin, R thigh, R shin]
 *  0 = pointing straight down, +90 = toward the image's right (the dancer's own left), 180 = straight up. */

export const SEGS = [[11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28]];
export const WEIGHT = [1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5];

export const MOVES = [
  { name: "Ready", tip: "Stand tall, arms down", p: [12, 5, -12, -5, 5, 0, -5, 0] },
  { name: "V arms", tip: "Both arms up like a V", p: [150, 155, -150, -155, 8, 0, -8, 0] },
  { name: "Airplane", tip: "Arms out to the sides", p: [90, 90, -90, -90, 5, 0, -5, 0] },
  { name: "Flex", tip: "Elbows out, hands up", p: [90, 175, -90, -175, 5, 0, -5, 0] },
  { name: "Point left", tip: "Your left arm points up high", p: [150, 155, -15, -10, 5, 0, -5, 0] },
  { name: "Point right", tip: "Your right arm points up high", p: [15, 10, -150, -155, 5, 0, -5, 0] },
  { name: "Hands on hips", tip: "Hands on your hips", p: [35, -45, -35, 45, 5, 0, -5, 0] },
  { name: "Clap up", tip: "Clap above your head", p: [150, -160, -150, 160, 5, 0, -5, 0] },
  { name: "Step left", tip: "Step your left foot out, arms out", p: [70, 80, -20, -10, 30, 25, -5, 0] },
  { name: "Step right", tip: "Step your right foot out, arms out", p: [20, 10, -70, -80, 5, 0, -30, -25] },
  { name: "Disco", tip: "Left arm up and out, right arm across", p: [135, 140, -30, 40, 5, 0, -5, 0] },
  { name: "Disco flip", tip: "Right arm up and out, left arm across", p: [30, -40, -135, -140, 5, 0, -5, 0] },
  { name: "Heart", tip: "Make a big heart over your head", p: [160, -130, -160, 130, 5, 0, -5, 0] },
  { name: "Wide stance", tip: "Feet wide, arms out low", p: [45, 45, -45, -45, 22, 18, -22, -18] },
  { name: "Wave left", tip: "Left arm out, hand up", p: [90, 170, -15, -10, 5, 0, -5, 0] },
  { name: "Wave right", tip: "Right arm out, hand up", p: [15, 10, -90, -170, 5, 0, -5, 0] },
];
/** the routine: move index per 2 beats */
export const ROUTINE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
/** How big a pose reads on screen. Arms only — legs in this routine are small steps. */
export function poseEnergy(p) {
  if (!p) return 0;
  let e = 0;
  for (let i = 0; i < 4; i++) e += Math.abs(p[i] || 0);
  return e;
}
/**
 * Gold Move windows for one song.
 * `section` is the same 8-bar grid as the cymbal crash in the music (every 32 beats).
 * Around each crash that still falls inside the song, the current routine's biggest
 * pose (arm energy, wrapping) is the Gold Move. Returns the first beat of each window;
 * the window itself is that beat and the next one (the move is held for two beats).
 * Juice only — callers must not feed this into match %, grades, stars, or combo.
 */
export function goldWindows(routine, poses, songBeats = 96, section = 32) {
  const out = [];
  if (!routine || !routine.length || !poses || !poses.length || section < 2) return out;
  const at = (s) => {
    const b0 = s * 2;
    if (s < 0 || b0 <= 0 || b0 + 1 >= songBeats) return null;
    const idx = routine[((s % routine.length) + routine.length) % routine.length];
    return { s, b0, e: poseEnergy(poses[idx]) };
  };
  const better = (a, b) => b && (!a || b.e > a.e || (b.e === a.e && b.s > a.s));
  for (let crash = section; crash < songBeats; crash += section) {
    const slotC = Math.floor(crash / 2);
    let best = null;
    for (let s = slotC - 1; s <= slotC + 2; s++) { const row = at(s); if (better(best, row)) best = row; }
    if (!best || best.e <= 80) {
      const s0 = Math.floor((crash - section) / 2);
      for (let s = s0; s <= slotC + 2; s++) { const row = at(s); if (better(best, row)) best = row; }
    }
    if (best && best.e > 80) out.push(best.b0);
  }
  return [...new Set(out)];
}
/** Whether this judged beat earns the gold bonus. Perfect or Great only, once per window. */
export function goldHit(windows, beat, judgement, already) {
  let gid = 0;
  const b = beat | 0;
  for (const w of windows || []) if (b === w || b === w + 1) gid = w;
  const gold = !!(gid && gid !== already && (judgement === "Perfect" || judgement === "Great"));
  return { gid, gold, awarded: gold ? gid : (already || 0) };
}
export const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
export function coachPose(t, bpm) {
  const beat = Math.max(0, t) * (bpm / 60);
  const slot = Math.floor(beat / 2), frac = (beat / 2) % 1;
  const a = MOVES[ROUTINE[slot % ROUTINE.length]], b = MOVES[ROUTINE[(slot + 1) % ROUTINE.length]];
  // hold the move, then glide into the next one over the last quarter
  const k = frac < 0.75 ? 0 : (frac - 0.75) / 0.25;
  return { pose: a.p.map((v, i) => v + wrap(b.p[i] - v) * k), idx: ROUTINE[slot % ROUTINE.length], next: ROUTINE[(slot + 1) % ROUTINE.length], frac };
}
/** landmarks (normalised image coords) → segment angles; visibility per segment */
export function poseAngles(lm) {
  if (!lm || lm.length < 29) return null;
  const a = [], v = [];
  for (const [i, j] of SEGS) { const p = lm[i], q = lm[j]; a.push((Math.atan2(q.x - p.x, q.y - p.y) * 180) / Math.PI); v.push(Math.min(p.visibility ?? 1, q.visibility ?? 1)); }
  return { a, v };
}
/** 0..1 similarity, arms count double */
export function similarity(user, ref, refV) {
  let s = 0, w = 0;
  for (let i = 0; i < 8; i++) { const vis = Math.min(user.v[i], refV?.[i] ?? 1); if (vis < 0.4) continue; const ww = WEIGHT[i] * vis; s += ww * Math.max(0, 1 - Math.abs(wrap(user.a[i] - ref[i])) / 75); w += ww; }
  return w > 1.2 ? s / w : null;
}
/** draw a friendly stick coach from a pose */
export function drawCoach(g, W, H, pose, color = "#B8FF00", mirror = false) {
  g.save(); if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
  const u = H / 7.2, cx = W / 2, sy = H * 0.3, hy = H * 0.56;
  const sh = { L: [cx + u * 0.75, sy], R: [cx - u * 0.75, sy] }, hp = { L: [cx + u * 0.45, hy], R: [cx - u * 0.45, hy] };
  const seg = (o, ang, len) => { const r = (ang * Math.PI) / 180; return [o[0] + Math.sin(r) * len, o[1] + Math.cos(r) * len]; };
  g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = color; g.lineWidth = u * 0.42;
  const line = (a, b) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
  // torso
  g.beginPath(); g.moveTo(sh.L[0], sh.L[1]); g.lineTo(sh.R[0], sh.R[1]); g.lineTo(hp.R[0], hp.R[1]); g.lineTo(hp.L[0], hp.L[1]); g.closePath(); g.fillStyle = color; g.fill(); g.stroke();
  g.beginPath(); g.arc(cx, sy - u * 0.95, u * 0.62, 0, Math.PI * 2); g.fill();
  const eL = seg(sh.L, pose[0], u * 1.15), wL = seg(eL, pose[1], u * 1.05), eR = seg(sh.R, pose[2], u * 1.15), wR = seg(eR, pose[3], u * 1.05);
  const kL = seg(hp.L, pose[4], u * 1.5), aL = seg(kL, pose[5], u * 1.45), kR = seg(hp.R, pose[6], u * 1.5), aR = seg(kR, pose[7], u * 1.45);
  line(sh.L, eL); line(eL, wL); line(sh.R, eR); line(eR, wR); line(hp.L, kL); line(kL, aL); line(hp.R, kR); line(kR, aR);
  g.restore();
}
