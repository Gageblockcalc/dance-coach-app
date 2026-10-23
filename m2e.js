// Move to Earn: local wallet + reward rules for Dance Coach. Opt-in, local-only (localStorage), no network, no location.
// Event sources (steps/shakes from the phone's motion sensor, squats/jacks from the camera) call onSteps / onShake / onReps.
// Detection lives in m2e-source.js (adapter). Coins are spendable on cosmetics only.
import { createSource } from "./m2e-source.js";
const KEY = "dc.m2e";
// Tuning: every coin goes through addCoins(), which enforces bucket cap, daily cap and per-minute cap.
export const RULES = {
  stepsPerCoin: 100, stepsPerCrate: 500, maxStepsPerDay: 10000, maxStepsPerMin: 190, maxCratesPerDay: 5,
  shakesPerCoin: 10, maxShakesPerMin: 30, maxShakesPerDay: 100,
  repsPerEgg: 5, eggCoins: 3, jackPerReward: 10, jackCoins: 2,
  cap: { steps: 50, shakes: 10, eggs: 30, jacks: 20, crate: 10 }, dayCap: 100, minCap: 10,
};
const clock = { now: () => Date.now() };
export const _setClock = (f) => (clock.now = f); // tests only
const dayKey = () => { const d = new Date(clock.now()); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const fresh = () => ({ v: 1, coins: 0, owned: [], crates: 0, crateSteps: 0, opened: 0, day: dayKey(), d: { coins: 0, steps: 0, shakes: 0, eggs: 0, jacks: 0, crates: 0, by: {}, pend: { steps: 0, shakes: 0, reps: 0, jacks: 0 } }, min: { t: 0, c: 0, st: 0, sh: 0 }, lastMove: 0 });
let st;
function load() { try { const j = JSON.parse(localStorage.getItem(KEY)); st = j && j.v === 1 ? Object.assign(fresh(), j) : fresh(); } catch { st = fresh(); } roll(); }
function roll() { if (st.day !== dayKey()) { const k = { coins: st.coins, owned: st.owned, crates: st.crates, crateSteps: st.crateSteps, opened: st.opened }; st = Object.assign(fresh(), k); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }
const emit = (what) => { try { window.dispatchEvent(new CustomEvent("dc-m2e", { detail: what })); } catch {} };
load();
const minute = () => { const m = Math.floor(clock.now() / 6e4); if (st.min.t !== m) st.min = { t: m, c: 0, st: 0, sh: 0 }; return st.min; };
const num = (x) => (Number.isFinite(x) ? x : 0);

/** Grant coins honoring bucket cap, daily cap and per-minute cap. Returns coins actually granted. */
function addCoins(bucket, amount) {
  roll(); amount = Math.floor(num(amount)); if (amount <= 0) return 0;
  const m = minute(), by = st.d.by[bucket] || 0;
  const g = Math.max(0, Math.min(amount, (RULES.cap[bucket] ?? 0) - by, RULES.dayCap - st.d.coins, RULES.minCap - m.c));
  if (g > 0) { st.coins += g; st.d.coins += g; st.d.by[bucket] = by + g; m.c += g; save(); emit("coins"); }
  return g;
}
const moved = () => { st.lastMove = clock.now(); };

/** n detected steps (already plausibility-filtered by the source; capped again here). */
function onSteps(n) {
  roll(); n = Math.floor(num(n)); if (n <= 0) return 0; const m = minute();
  n = Math.min(n, RULES.maxStepsPerMin - m.st, RULES.maxStepsPerDay - st.d.steps); if (n <= 0) return 0;
  m.st += n; st.d.steps += n; moved();
  st.d.pend.steps += n; while (st.d.pend.steps >= RULES.stepsPerCoin) { st.d.pend.steps -= RULES.stepsPerCoin; addCoins("steps", 1); }
  st.crateSteps += n; while (st.crateSteps >= RULES.stepsPerCrate) { st.crateSteps -= RULES.stepsPerCrate; if (st.d.crates < RULES.maxCratesPerDay) { st.d.crates++; st.crates++; emit("crate"); } }
  save(); emit("steps"); return n;
}
/** One shake. Min interval and per-minute/day limits are enforced here too. */
let lastShake = 0;
function onShake() {
  roll(); const t = clock.now(), m = minute(); if (t - lastShake < 600) return 0; lastShake = t;
  if (m.sh >= RULES.maxShakesPerMin || st.d.shakes >= RULES.maxShakesPerDay) return 0;
  m.sh++; st.d.shakes++; moved();
  if (++st.d.pend.shakes >= RULES.shakesPerCoin) { st.d.pend.shakes = 0; addCoins("shakes", 1); }
  save(); emit("shakes"); return 1;
}
/** Camera/exercise reps: kind "squat" (5 reps = 1 golden egg) or "jack" (10 = coins). Min 0.6s between reps. */
const lastRep = {};
function onReps(kind, n = 1) {
  roll(); const t = clock.now(); n = Math.min(Math.floor(num(n)), 3); if (n <= 0 || t - (lastRep[kind] || 0) < 600) return 0; lastRep[kind] = t; moved();
  if (kind === "squat") { st.d.pend.reps += n; let eggs = 0; while (st.d.pend.reps >= RULES.repsPerEgg) { st.d.pend.reps -= RULES.repsPerEgg; if (st.d.eggs < RULES.cap.eggs / RULES.eggCoins) { st.d.eggs++; addCoins("eggs", RULES.eggCoins); eggs++; } } save(); emit(eggs ? "egg" : "reps"); return n; }
  if (kind === "jack") { st.d.pend.jacks += n; while (st.d.pend.jacks >= RULES.jackPerReward) { st.d.pend.jacks -= RULES.jackPerReward; st.d.jacks++; addCoins("jacks", RULES.jackCoins); } save(); emit("reps"); return n; }
  return 0;
}
/** Spend coins on a cosmetic. Cosmetics only. */
function buy(id, price) { roll(); if (st.owned.includes(id)) return true; price = Math.floor(num(price)); if (price <= 0 || st.coins < price) return false; st.coins -= price; st.owned.push(id); save(); emit("buy"); return true; }
function unlock(id) { if (!st.owned.includes(id)) { st.owned.push(id); save(); emit("buy"); } }
const owned = (id) => st.owned.includes(id);
/** Open a mystery crate: returns the id won from `pool` (ids not yet owned), or null (+5 coins) when everything is owned or no crate. */
function openCrate(pool) {
  roll(); if (st.crates < 1) return { none: true };
  st.crates--; st.opened++; const left = pool.filter((i) => !st.owned.includes(i));
  if (!left.length) { addCoins("crate", 5); save(); emit("crate"); return { coins: 5 }; }
  const id = left[Math.floor(Math.random() * left.length)]; st.owned.push(id); save(); emit("buy"); return { id };
}
const state = () => { roll(); return JSON.parse(JSON.stringify(st)); };
/** Wipe every Move to Earn value on this device (coins, unlocks, counters). */
function reset() { st = fresh(); try { localStorage.removeItem(KEY); localStorage.removeItem("dc.m2e.on"); } catch {} lastShake = 0; for (const k in lastRep) delete lastRep[k]; emit("reset"); }
const idleMs = () => clock.now() - (st.lastMove || 0);

// ---- sensor session (permission only requested from a tap) ----
let src = null, running = false;
async function start() {
  if (running) return { ok: true };
  src ??= createSource({ onSteps, onShake });
  const r = await src.start(); running = !!r.ok; emit("sensor"); return r;
}
function stop() { src?.stop(); running = false; emit("sensor"); }
export const m2e = { RULES, onSteps, onShake, onReps, addCoins, buy, unlock, owned, openCrate, state, reset, idleMs, start, stop, running: () => running, supported: () => !!(window.DeviceMotionEvent) };
export const isOwned = owned;
