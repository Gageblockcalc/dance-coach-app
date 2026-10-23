// Progress: XP, levels, badges, forgiving streak, run history. All local (localStorage "dc.prog"), no network, no personal data.
const KEY = "dc.prog";
export const MAX_LEVEL = 30;
/** Unlock levels. Only NEW items are gated; everything that existed before stays available. */
export const UNLOCK = { candy: 3, gold: 4, aurora: 5, drive: 6, ember: 7, sunrise: 8, turbo: 9, midnight: 12 };
export const xpAt = (lvl) => 30 * lvl * (lvl - 1); // total XP needed to reach a level: L2=60, L3=180, L5=600, L10=2700
export const levelFor = (xp) => { let l = 1; while (l < MAX_LEVEL && xp >= xpAt(l + 1)) l++; return l; };
export const BADGES = [
  { id: "first", icon: "💃", name: "First dance", desc: "Finish your first song", xp: 20 },
  { id: "star3", icon: "🌟", name: "Triple star", desc: "Get 3 stars on a song", xp: 30 },
  { id: "perf10", icon: "🎯", name: "Sharpshooter", desc: "10 perfect moments in one song", xp: 30 },
  { id: "combo8", icon: "🔗", name: "Combo king", desc: "A combo of 8 or more", xp: 30 },
  { id: "daily1", icon: "🏆", name: "Daily dancer", desc: "Finish a Daily challenge", xp: 25 },
  { id: "goal", icon: "🎖️", name: "Goal getter", desc: "Reach a Daily challenge goal", xp: 40 },
  { id: "streak3", icon: "🔥", name: "On a roll", desc: "3-day streak", xp: 30 },
  { id: "streak7", icon: "🌋", name: "Week warrior", desc: "7-day streak", xp: 60 },
  { id: "songs10", icon: "🎶", name: "Ten songs", desc: "Finish 10 songs", xp: 40 },
  { id: "songs50", icon: "🪩", name: "Dance floor regular", desc: "Finish 50 songs", xp: 100 },
  { id: "lvl5", icon: "⭐", name: "Level 5", desc: "Reach level 5", xp: 0 },
  { id: "lvl10", icon: "🌠", name: "Level 10", desc: "Reach level 10", xp: 0 },
  { id: "alltracks", icon: "🎧", name: "Sampler", desc: "Dance to 4 different songs", xp: 40 },
  { id: "season", icon: "🎉", name: "Season star", desc: "Reach a seasonal event goal", xp: 30 },
  { id: "mover", icon: "👟", name: "Mover", desc: "Earn a Move coin", xp: 20 },
];
const blank = () => ({ xp: 0, badges: {}, songs: 0, tracks: [], m2e: { day: "", n: 0 }, hist: [], moves: {}, v: 1 });
let st = null;
const load = () => { if (st) return st; try { st = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { st = blank(); } return st; };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
const emit = (d) => { try { window.dispatchEvent(new CustomEvent("dc-prog", { detail: d })); } catch {} };
export const state = () => load();
export const level = () => levelFor(load().xp);
export const progressInfo = () => { const x = load().xp, l = levelFor(x), a = xpAt(l), b = l >= MAX_LEVEL ? a : xpAt(l + 1); return { xp: x, level: l, into: x - a, need: Math.max(1, b - a), pct: l >= MAX_LEVEL ? 1 : (x - a) / (b - a), max: l >= MAX_LEVEL }; };
export const isUnlocked = (lvl) => !lvl || level() >= lvl;
function award(id, out) { const s = load(); if (s.badges[id]) return; s.badges[id] = Date.now(); const b = BADGES.find((x) => x.id === id); if (b) { out.badges.push(b); out.xp += b.xp; } }
/** Local day key (device date). */
export const dayKey = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function addXp(n, out) { const s = load(), before = levelFor(s.xp); s.xp = Math.max(0, Math.min(1e7, s.xp + Math.round(n))); const after = levelFor(s.xp); if (after > before) { out.levelUp = after; if (after >= 5) award("lvl5", out); if (after >= 10) award("lvl10", out); } }
/** Called once when a song finishes. r: {pct, stars, perfect, combo, daily, goalMet, trackId, streak, speed}. */
export function onRun(r) {
  const s = load(), out = { xp: 0, badges: [], levelUp: 0 };
  let gain = Math.floor(r.pct / 2) + r.stars * 10 + Math.min(30, r.perfect) + (r.daily ? 25 : 0) + (r.goalMet ? 25 : 0);
  const today = dayKey(); if (s.lastDay !== today) { gain += 10; s.lastDay = today; } // first dance of the day
  gain = Math.min(gain, 200); out.xp = gain; s.songs++; if (r.trackId && !s.tracks.includes(r.trackId)) s.tracks.push(r.trackId);
  award("first", out); if (r.stars >= 3) award("star3", out); if (r.perfect >= 10) award("perf10", out); if (r.combo >= 8) award("combo8", out);
  if (r.daily) award("daily1", out); if (r.goalMet) award("goal", out); if (r.streak >= 3) award("streak3", out); if (r.streak >= 7) award("streak7", out);
  if (s.songs >= 10) award("songs10", out); if (s.songs >= 50) award("songs50", out); if (s.tracks.length >= 4) award("alltracks", out);
  if (r.eventKey && r.eventMet) { s.events = s.events || {}; if (!s.events[r.eventKey]) { s.events[r.eventKey] = Date.now(); out.xp += 50; out.event = r.eventKey; award("season", out); } } // once per season
  addXp(out.xp, out); addXp(0, out);
  s.hist.push({ t: r.trackId || "?", p: r.pct, d: today, sp: r.speed || 1 }); if (s.hist.length > 40) s.hist.splice(0, s.hist.length - 40);
  save(); emit("run"); return out;
}
/** Move to Earn bridge: XP follows today's earned Move coins (2 XP each). The Move to Earn daily caps bound this to 200 XP a day. */
export function onMoveCoins(todayCoins, day) {
  const s = load(), out = { xp: 0, badges: [], levelUp: 0 }; if (!(todayCoins >= 0)) return out;
  if (s.m2e.day !== day) s.m2e = { day, n: 0 };
  const d = Math.max(0, Math.min(todayCoins, 100) - s.m2e.n); if (!d) return out;
  s.m2e.n += d; out.xp = d * 2; award("mover", out); addXp(out.xp, out); save(); emit("m2e"); return out;
}
/** Per-move accuracy for the "Practice" routine: running average similarity per move index. */
export function noteMove(idx, sim) { const s = load(), m = s.moves[idx] || (s.moves[idx] = [0, 0]); m[0] += sim; m[1]++; if (m[1] > 600) { m[0] /= 2; m[1] /= 2; } } // recent runs weigh more
export function flushMoves() { save(); }
export function weakMoves(n = 4) { const m = load().moves, rows = Object.keys(m).filter((k) => m[k][1] >= 40 && +k > 0).map((k) => [+k, m[k][0] / m[k][1]]); rows.sort((a, b) => a[1] - b[1]); return rows.slice(0, n).map((r) => r[0]); }
export function resetProgress() { st = blank(); try { localStorage.removeItem(KEY); } catch {} emit("reset"); }
/** Streak with a gentle rule: a missed day is forgiven once per 7 played days. `days` = Set of "YYYY-MM-DD" played. Today not yet played does not break it. */
export function streakOf(days, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); let s = 0, forgiven = 0, sinceForgive = 99;
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // still time to play today
  for (let guard = 0; guard < 400; guard++) {
    if (days.has(dayKey(d))) { s++; sinceForgive++; }
    else { const prev = new Date(d); prev.setDate(prev.getDate() - 1); if (sinceForgive >= 7 && days.has(dayKey(prev))) { forgiven++; sinceForgive = 0; } else break; }
    d.setDate(d.getDate() - 1);
  }
  return { streak: s, forgiven };
}
