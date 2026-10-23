// Smart coach helpers (pure, on-device, no network): generated Daily challenge, speed suggestions, practice routines.
export function rng(seed) { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
export const tierFor = (level) => Math.max(0, Math.min(4, Math.floor((level || 1) / 5)));
/** Daily challenge from the date + level tier only. moveCount = number of moves (index 0 = Ready pose). */
export function dailyPlan(dateKey, tier, moveCount, trackCount) {
  const r = rng(dateKey + ":" + tier), n = Math.min(moveCount - 1, 7 + tier), pool = [];
  for (let i = 1; i < moveCount; i++) pool.push(i);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return { routine: [0, ...pool.slice(0, n)], trackIdx: Math.floor(r() * trackCount), goal: 55 + 5 * tier, tier };
}
export const SPEEDS = [0.8, 0.9, 1, 1.1, 1.2];
/** Suggest a speed change from recent runs (never applied silently). hist: [{p, sp}], newest last. */
export function speedSuggestion(hist, cur) {
  const h = (hist || []).filter((x) => (x.sp || 1) === cur); if (h.length < 2) return null;
  const last3 = h.slice(-3), avg3 = last3.reduce((s, x) => s + x.p, 0) / last3.length, last2 = h.slice(-2), avg2 = last2.reduce((s, x) => s + x.p, 0) / 2;
  const up = SPEEDS[SPEEDS.indexOf(cur) + 1], down = SPEEDS[SPEEDS.indexOf(cur) - 1];
  if (last3.length === 3 && avg3 >= 85 && last3.every((x) => x.p >= 78) && up) return { speed: up, why: "up" };
  if (avg2 < 35 && down) return { speed: down, why: "down" };
  return null;
}
/** Practice routine: weakest moves first, then a couple of random extras. */
export function practicePlan(weak, moveCount, seed) {
  const r = rng("practice:" + seed), rest = []; for (let i = 1; i < moveCount; i++) if (!weak.includes(i)) rest.push(i);
  rest.sort(() => r() - 0.5); return [0, ...weak.slice(0, 4), ...rest.slice(0, 2)];
}
/** Favourite song from history (most played among allowed ids), or null. */
export function favouriteSong(hist, allowed) { const c = {}; for (const x of hist || []) if (allowed.includes(x.t)) c[x.t] = (c[x.t] || 0) + 1; let best = null; for (const k in c) if (!best || c[k] > c[best]) best = k; return best; }
