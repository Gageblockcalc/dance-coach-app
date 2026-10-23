// Camera exercise counters (squats, jumping jacks) from the existing pose landmarks. On-device only; no video or pose data stored.
// feed(landmarks, nowMs) -> emits onRep(kind). Plausibility: min 0.8 s per squat, 0.5 s per jack, landmarks must be visible.
const V = (p) => p && (p.visibility == null || p.visibility > 0.5);
export function createExerciseCounter(onRep) {
  let kind = null, sq = { stand: 0, down: false, t: 0, last: 0 }, jk = { open: false, last: 0, t: 0 };
  return {
    set(k) { kind = k; sq = { stand: 0, down: false, t: 0, last: 0 }; jk = { open: false, last: 0, t: 0 }; },
    kind: () => kind,
    feed(L, now) {
      if (!kind || !L) return;
      const sh = [L[11], L[12]], hp = [L[23], L[24]], kn = [L[25], L[26]], an = [L[27], L[28]], wr = [L[15], L[16]];
      if (![...sh, ...hp].every(V)) return;
      const shY = (sh[0].y + sh[1].y) / 2, hpY = (hp[0].y + hp[1].y) / 2, torso = hpY - shY; if (torso < 0.05) return;
      if (kind === "squat") {
        if (!kn.every(V)) return;
        const r = ((kn[0].y + kn[1].y) / 2 - hpY) / torso; // thigh drop ratio: ~1 standing, ~0.3 deep squat
        if (!sq.down) { sq.stand = Math.max(r, sq.stand * 0.995); if (sq.stand > 0.7 && r < sq.stand * 0.65) { sq.down = true; sq.t = now; } }
        else if (r > sq.stand * 0.85) { sq.down = false; if (now - sq.t >= 400 && now - sq.last >= 800) { sq.last = now; onRep("squat"); } }
      } else if (kind === "jack") {
        if (!an.every(V) || !wr.every(V)) return;
        const sw = Math.abs(sh[0].x - sh[1].x) || 0.1, feet = Math.abs(an[0].x - an[1].x), up = wr[0].y < shY && wr[1].y < shY, low = wr[0].y > shY && wr[1].y > shY;
        if (!jk.open && up && feet > sw * 1.7) { jk.open = true; jk.t = now; }
        else if (jk.open && low && feet < sw * 1.3) { jk.open = false; if (now - jk.t >= 250 && now - jk.last >= 500) { jk.last = now; onRep("jack"); } }
      }
    },
  };
}
