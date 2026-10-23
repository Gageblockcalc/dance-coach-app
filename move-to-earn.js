/**
 * move-to-earn v1.0.0: framework-free activity detector + anti-cheat + daily caps.
 * No dependencies, no location, no camera/mic, no personal data. Raw sensor samples never leave createDetector().
 * See README.md for the full API. Works in browsers, React Native (feed it expo-sensors samples) and Node (server checks).
 *
 * HONEST LIMITS: a browser cannot read true step counts. Everything here is a motion-based ESTIMATE from the accelerometer,
 * and software that fakes sensor events cannot be proven fake from summaries. The server checks (checkClaim/applyBatch)
 * plus hard daily caps bound the damage; they do not make cheating impossible.
 */
export const VERSION = '1.0.0';

/* ───────────────────────── tunables ───────────────────────── */

/** Detector thresholds. m/s^2 are deviations from the slowly-moving gravity baseline. */
export const DETECT = Object.freeze({
  walk:   { baseTau: 1000, smoothTau: 45, minPeak: 1.3, maxPeak: 16, maxMeanAmp: 12, maxFastMean: 9, minGapMs: 280, maxGapMs: 1300, chain: 5, window: 10, maxPeakyRatio: 2.6 },
  shake:  { baseTau: 1000, smoothTau: 18, minPeak: 6,   maxPeak: 80, minGapMs: 110, maxGapMs: 900,  chain: 4, window: 8,  minRms: 2.0 },
  jacks:  { baseTau: 1500, smoothTau: 22, minPeak: 4,   maxPeak: 60, pairMinMs: 70, pairMaxMs: 420, repMinMs: 500, repMaxMs: 1800, chain: 3, window: 8 },
  squats: { baseTau: 4000, slowTau: 280, fastTau: 22, hfTau: 400, neg: 0.9, pos: 1.0, hyst: 0.45, pairMinMs: 350, pairMaxMs: 2600, repMinMs: 1600, repMaxMs: 7000, maxHfRatio: 0.9, chain: 2, window: 6 },
});
/** Rhythm rules shared by every mode: perfectly regular input is a machine, not a person. */
export const RHYTHM = Object.freeze({ minIntervalCv: 0.012, minAmpCv: 0.03, maxIntervalCv: 0.5 });

/** Server/client plausibility limits for a claimed batch (units per second of active time). */
export const LIMITS = Object.freeze({
  walk:   { minRate: 1.0,  maxRate: 3.5, minCount: 8,  maxSpanMs: 120000 },
  shake:  { minRate: 1.7,  maxRate: 8,   minCount: 8,  maxSpanMs: 60000 },
  jacks:  { minRate: 0.5,  maxRate: 2.0, minCount: 5,  maxSpanMs: 120000 },
  squats: { minRate: 0.14, maxRate: 0.65, minCount: 3, maxSpanMs: 180000 },
  minSpanMs: 4000,
  /** active time claimed may exceed wall-clock time since the last claim by at most this much */
  graceMs: 6000,
  /** first claim of a session may cover at most this much */
  firstClaimMaxMs: 60000,
  minClaimGapMs: 8000,
});

/** Points per unit, daily unit caps, diminishing tiers, coin conversion. */
export const CAPS = Object.freeze({
  mpPerUnit: { walk: 0.1, shake: 1 / 3, jacks: 1.5, squats: 3 },
  dailyUnits: { walk: 5000, shake: 450, jacks: 150, squats: 90 },
  /** [from, to, multiplier] on raw Move Points: full value, then half, then quarter, then nothing */
  tiers: [[0, 300, 1], [300, 500, 0.5], [500, 700, 0.25]],
  mpPerCoin: 20,
  dailyCoinCap: 20,
  maxCoinsPerGrant: 10,
});

export const COPY = Object.freeze({
  honesty: "Browsers can't read true step counts. These are motion-based estimates from your phone's sensors, so numbers are approximate.",
  caps: 'Rewards have a daily limit so everyone gets a fair go. Shaking a phone on a desk earns nothing.',
  privacy: 'No location, camera or microphone. Only a small counter stays on this device.',
  screenOn: 'Keep your screen on while you move. Sensors pause when the screen sleeps.',
  noSensor: 'This needs a phone or tablet with motion sensors. Open this page on your phone to play.',
  denied: 'Motion access was not allowed. You can allow it in your browser or phone settings and try again.',
});

export const MODES = Object.freeze(['walk', 'shake', 'jacks', 'squats']);
export const UNIT_EVENT = Object.freeze({ walk: 'step', shake: 'shake', jacks: 'jack', squats: 'squat' });

/* ───────────────────────── small math helpers ───────────────────────── */

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) * (x - m)))); };
const cv = (a) => { const m = mean(a); return m > 0 ? sd(a) / Math.abs(m) : 0; };
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const ema = (prev, x, dt, tau) => prev + (x - prev) * (1 - Math.exp(-dt / tau));
const intervalsOf = (ts) => { const r = []; for (let i = 1; i < ts.length; i++) r.push(ts[i] - ts[i - 1]); return r; };

/** parabolic interpolation around a sampled local max: sub-sample time + value */
function refinePeak(t0, v0, t1, v1, t2, v2) {
  const den = v0 - 2 * v1 + v2;
  if (!(den < 0)) return { t: t1, v: v1 };
  const off = clamp(0.5 * (v0 - v2) / den, -1, 1);
  const dt = off >= 0 ? t2 - t1 : t1 - t0;
  return { t: t1 + off * dt, v: v1 - 0.25 * (v0 - v2) * off };
}

/** Rhythm test for a window of accepted candidates ({t,v}). Returns {ok, reason, intervalCv, ampCv, meanInt}. */
export function rhythmCheck(cands, minMean, maxMean) {
  const iv = intervalsOf(cands.map((c) => c.t));
  const mi = mean(iv);
  const icv = cv(iv), acv = cv(cands.map((c) => c.v));
  if (mi < minMean || mi > maxMean) return { ok: false, reason: 'cadence', intervalCv: icv, ampCv: acv, meanInt: mi };
  if (icv < RHYTHM.minIntervalCv || (cands.length >= 5 && acv < RHYTHM.minAmpCv)) return { ok: false, reason: 'too_regular', intervalCv: icv, ampCv: acv, meanInt: mi };
  if (icv > RHYTHM.maxIntervalCv) return { ok: false, reason: 'erratic', intervalCv: icv, ampCv: acv, meanInt: mi };
  return { ok: true, reason: '', intervalCv: icv, ampCv: acv, meanInt: mi };
}

/* ───────────────────────── mode pipelines ───────────────────────── */
/* Each pipeline: feed(t, s, d, dt) with s = smoothed deviation; calls credit(t, amp) for each accepted unit and reject(reason). */

function makeGate(cfg, minMean, maxMean, credit, reject) {
  let cands = []; let on = false;
  return {
    reset() { cands = []; on = false; },
    get on() { return on; },
    /** add a candidate event (already past the per-mode shape tests) */
    add(t, v, extra) {
      if (cands.length && t - cands[cands.length - 1].t > cfg.maxGapMs) { cands = []; on = false; }
      cands.push({ t, v, credited: false });
      if (cands.length > cfg.window) cands.shift();
      if (cands.length < cfg.chain) return;
      const win = cands.slice(-cfg.window);
      const r = rhythmCheck(win, minMean, maxMean);
      if (!r.ok || (extra && !extra(win))) { on = false; if (!r.ok) reject(r.reason); return; }
      on = true;
      for (const c of win) if (!c.credited) { c.credited = true; credit(c.t, c.v); }
    },
  };
}

function walkPipe(credit, reject, env) {
  const cfg = DETECT.walk;
  const raws = []; let acc = []; let lastT = -1e9; const fp = [];
  const gate = makeGate(cfg, 1000 / LIMITS.walk.maxRate, 1000 / LIMITS.walk.minRate, credit, reject);
  return {
    reset() { raws.length = 0; acc = []; lastT = -1e9; fp.length = 0; gate.reset(); },
    onPeak(t, v) {
      raws.push(t); while (raws.length && t - raws[0] > 6000) raws.shift();
      if (v > cfg.maxPeak) { reject('impact'); return; }
      if (t - lastT < cfg.minGapMs) return; // debounce
      lastT = t;
      acc.push(t); while (acc.length > cfg.window) acc.shift();
      fp.push(env.takeFast()); while (fp.length > cfg.window) fp.shift();
      // "peaky": a clean walking signal has about one raw local max per accepted step; buzzing/vibration has many
      gate.add(t, v, (win) => {
        const t0 = win[0].t; const nRaw = raws.filter((x) => x >= t0).length;
        if (nRaw / win.length > cfg.maxPeakyRatio) { reject('vibration'); return false; }
        if (mean(win.map((c) => c.v)) > cfg.maxMeanAmp || mean(fp) > cfg.maxFastMean) { reject('too_vigorous'); return false; } // shaking/running: use another mode
        return true;
      });
    },
  };
}

function shakePipe(credit, reject, env) {
  const cfg = DETECT.shake;
  let lastT = -1e9; const recent = [];
  const gate = makeGate(cfg, 110, 700, credit, reject);
  return {
    reset() { lastT = -1e9; recent.length = 0; gate.reset(); },
    onPeak(t, v) {
      if (v > cfg.maxPeak) { reject('impact'); return; }
      if (t - lastT < cfg.minGapMs) return;
      lastT = t; recent.push(v); while (recent.length > cfg.window) recent.shift();
      // real acceleration variance over the last ~1.5 s (a phone resting on a buzzing desk has almost none)
      gate.add(t, v, () => { const ok = env.rms() >= cfg.minRms; if (!ok) reject('no_variance'); return ok; });
    },
  };
}

function jacksPipe(credit, reject) {
  const cfg = DETECT.jacks;
  let first = null; let lastPairT = -1e9; let lastPeakT = -1e9;
  const gate = makeGate({ ...cfg, maxGapMs: cfg.repMaxMs }, cfg.repMinMs, cfg.repMaxMs, credit, reject);
  return {
    reset() { first = null; lastPairT = -1e9; lastPeakT = -1e9; gate.reset(); },
    onPeak(t, v) {
      if (v > cfg.maxPeak) { reject('impact'); return; }
      if (t - lastPeakT < cfg.pairMinMs) return; // debounce
      lastPeakT = t;
      if (first && t - first.t >= cfg.pairMinMs && t - first.t <= cfg.pairMaxMs) {
        const pairStart = first.t, amp = (first.v + v) / 2; first = null;
        if (pairStart - lastPairT < cfg.repMinMs) return; // faster than a person can jump
        lastPairT = pairStart; gate.add(pairStart, amp);
      } else first = { t, v };
    },
  };
}

/** squats use the slow (0.2-1 Hz) part of the signal; faster shaking/walking/jumping is rejected by the fast-band energy ratio */
function squatPipe(credit, reject) {
  const cfg = DETECT.squats;
  let st = 0, extV = 0, extT = 0, trough = null, lastRepT = -1e9, hf = 0, sp = 0; // st: 0 idle, -1 tracking min, +1 tracking max
  const gate = makeGate({ ...cfg, maxGapMs: cfg.repMaxMs + 1500 }, cfg.repMinMs, cfg.repMaxMs, credit, reject);
  return {
    reset() { st = 0; extV = 0; extT = 0; trough = null; lastRepT = -1e9; hf = 0; sp = 0; gate.reset(); },
    feed(t, slow, fastAbs, dt) {
      hf = ema(hf, fastAbs, dt, cfg.hfTau);
      sp = Math.max(sp * Math.exp(-dt / 3000), Math.abs(slow)); // slow-signal envelope
      const noisy = hf > cfg.maxHfRatio * Math.max(sp, 0.5);
      if (st === 0) {
        if (slow < -cfg.neg) { st = -1; extV = slow; extT = t; }
        else if (slow > cfg.pos && trough) { st = 1; extV = slow; extT = t; }
      } else if (st === -1) {
        if (slow < extV) { extV = slow; extT = t; }
        else if (slow > extV + cfg.hyst) { trough = noisy ? null : { t: extT, v: extV }; st = 0; if (noisy) reject('too_fast'); }
      } else {
        if (slow > extV) { extV = slow; extT = t; }
        else if (slow < extV - cfg.hyst) {
          const pk = { t: extT, v: extV }; st = 0;
          if (trough && !noisy) {
            const gap = pk.t - trough.t;
            if (gap >= cfg.pairMinMs && gap <= cfg.pairMaxMs && trough.t - lastRepT >= cfg.repMinMs) {
              lastRepT = trough.t; gate.add(trough.t, pk.v - trough.v);
            }
          }
          trough = null;
        }
      }
      if (trough && t - trough.t > cfg.pairMaxMs) trough = null;
    },
  };
}

/* ───────────────────────── detector ───────────────────────── */

/**
 * createDetector({mode, now, energyHz}) -> detector
 *   push({t, x, y, z})      feed one accelerometer sample (t in ms, x/y/z in m/s^2, gravity included or not)
 *   on(type, fn) -> off     types: 'unit' | 'step' | 'shake' | 'jack' | 'squat' | 'state' | 'energy' | 'reject'
 *   setMode(mode), reset(), takeBatch() -> batch|null, peekBatch(), counts, state, energy, mode
 */
export function createDetector(opts = {}) {
  const listeners = new Map();
  const emit = (type, data) => { const s = listeners.get(type); if (s) for (const f of [...s]) { try { f(data); } catch { /* listener errors never break detection */ } } };
  let mode = MODES.includes(opts.mode) ? opts.mode : 'walk';
  let pipe, cfg;
  let prevT = null, base = 0, s = 0, slow = 0, fast = 0, varS = 0, fastS = 0, fastMax = 0;
  const ring = []; // last three smoothed points for peak detection
  const events = { walk: [], shake: [], jacks: [], squats: [] }; // credited units since last takeBatch, per mode: {t, v}
  const counts = { walk: 0, shake: 0, jacks: 0, squats: 0 };
  let state = 'still', lastUnitT = -1e9, lastEnergyEmit = 0, energy = 0, nowT = 0, lastRejectAt = {};
  const stillAfterMs = opts.stillAfterMs ?? 3000;

  const credit = (t, v) => {
    counts[mode]++; events[mode].push({ t, v }); lastUnitT = nowT;
    const info = { mode, t, v, n: counts[mode], total: counts[mode] };
    emit('unit', info); emit(UNIT_EVENT[mode], info);
    setState(mode === 'walk' ? 'moving' : 'active');
  };
  const reject = (reason) => {
    if (nowT - (lastRejectAt[reason] ?? -1e9) < 1500) return; // coalesce
    lastRejectAt[reason] = nowT; emit('reject', { mode, reason, t: nowT });
  };
  const setState = (st) => { if (st !== state) { state = st; emit('state', { state, mode }); } };

  const build = () => {
    cfg = DETECT[mode];
    pipe = mode === 'walk' ? walkPipe(credit, reject, { takeFast: () => { const v = fastMax; fastMax = 0; return v; } }) : mode === 'shake' ? shakePipe(credit, reject, { rms: () => Math.sqrt(varS) }) : mode === 'jacks' ? jacksPipe(credit, reject) : squatPipe(credit, reject);
  };
  build();

  const api = {
    get mode() { return mode; },
    get state() { return state; },
    get energy() { return energy; },
    get counts() { return { ...counts }; },
    setMode(m) {
      if (!MODES.includes(m) || m === mode) return;
      mode = m; api.resetSignal(); build();
    },
    /** drop filters/pending candidates (keeps counts and the unclaimed batch) */
    resetSignal() { prevT = null; base = 0; s = 0; slow = 0; fast = 0; varS = 0; fastS = 0; fastMax = 0; ring.length = 0; pipe && pipe.reset(); setState('still'); },
    reset() { for (const k of MODES) { events[k] = []; counts[k] = 0; } api.resetSignal(); },
    on(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); return () => listeners.get(type)?.delete(fn); },
    push(sample) {
      const t = sample.t, x = sample.x, y = sample.y, z = sample.z;
      if (!(Number.isFinite(t) && Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) return;
      nowT = t;
      const m = Math.sqrt(x * x + y * y + z * z);
      if (prevT !== null && t <= prevT) return; // out-of-order sample
      if (prevT === null || t - prevT > 1000) { // first sample or a gap (screen slept): re-seed filters
        prevT = t; base = m; s = 0; slow = 0; fast = 0; varS = 0; fastS = 0; fastMax = 0; ring.length = 0; pipe.reset(); return;
      }
      const dt = t - prevT; prevT = t;
      base = ema(base, m, dt, cfg.baseTau);
      const d = m - base;
      s = ema(s, d, dt, cfg.smoothTau);
      varS = ema(varS, s * s, dt, 1500);
      fastS = ema(fastS, d, dt, 18); if (fastS > fastMax) fastMax = fastS;
      if (mode === 'squats') {
        slow = ema(slow, d, dt, cfg.slowTau); fast = ema(fast, d, dt, cfg.fastTau);
        pipe.feed(t, slow, Math.abs(fast - slow), dt);
      } else {
        ring.push({ t, v: s }); if (ring.length > 3) ring.shift();
        if (ring.length === 3) {
          const [a, b, c] = ring;
          if (b.v > a.v && b.v >= c.v && b.v > cfg.minPeak) { const r = refinePeak(a.t, a.v, b.t, b.v, c.t, c.v); pipe.onPeak(r.t, r.v); }
        }
      }
      // state + energy
      if (state !== 'still' && t - lastUnitT > stillAfterMs) setState('still');
      const e = clamp(Math.abs(s) / (mode === 'shake' ? 12 : 6), 0, 1); energy = energy * 0.9 + e * 0.1;
      if (t - lastEnergyEmit >= (opts.energyEveryMs ?? 120)) { lastEnergyEmit = t; emit('energy', { level: energy, state, mode, t }); }
    },
    /** modes that have unclaimed units */
    pendingModes() { return MODES.filter((k) => events[k].length > 0); },
    /** claimable summary of units credited since the last call (then cleared), or null. Defaults to the current mode, else any mode with units. */
    takeBatch(m) { const k = m || (events[mode].length ? mode : api.pendingModes()[0]); if (!k) return null; const b = summarize(k, events[k]); if (b) events[k] = []; return b; },
    peekBatch(m) { const k = m || (events[mode].length ? mode : api.pendingModes()[0]); return k ? summarize(k, events[k]) : null; },
    /** put an unsent batch's events back (e.g. network failure). Only used by createClaimer. */
    _restore(m, evs) { events[m] = evs.concat(events[m]); },
    _events(m) { return events[m].slice(); },
  };
  return api;
}

/** Build the batch object the server checks. Bouts separated by a pause are not mixed into the interval statistics. */
export function summarize(mode, events) {
  if (!events.length) return null;
  const maxGap = mode === 'walk' ? DETECT.walk.maxGapMs : mode === 'squats' ? DETECT.squats.repMaxMs + 1500 : mode === 'jacks' ? DETECT.jacks.repMaxMs : DETECT.shake.maxGapMs;
  const ts = events.map((e) => e.t); const iv = []; let bouts = 1;
  for (let i = 1; i < ts.length; i++) { const g = ts[i] - ts[i - 1]; if (g <= maxGap) iv.push(g); else bouts++; }
  const mi = iv.length ? mean(iv) : 0;
  const spanMs = Math.round(iv.reduce((a, b) => a + b, 0) + bouts * mi);
  return {
    v: 1, mode, count: events.length, spanMs,
    intervalMeanMs: Math.round(mi), intervalCv: +cv(iv).toFixed(4), ampMean: +mean(events.map((e) => e.v)).toFixed(3), ampCv: +cv(events.map((e) => e.v)).toFixed(4),
    bouts,
  };
}

/* ───────────────────────── server-side / shared checks ───────────────────────── */

/** shape + plausibility check of a batch. ctx: {now, lastClaimAt|null, sessionStartAt?}. Returns {ok, reason}. */
export function checkClaim(batch, ctx = {}) {
  const fail = (reason) => ({ ok: false, reason });
  if (!batch || typeof batch !== 'object' || batch.v !== 1) return fail('bad_batch');
  const mode = batch.mode; const L = LIMITS[mode];
  if (!MODES.includes(mode)) return fail('bad_mode');
  for (const k of ['count', 'spanMs', 'intervalMeanMs', 'intervalCv', 'ampMean', 'ampCv']) if (!Number.isFinite(batch[k])) return fail('bad_batch');
  const { count, spanMs } = batch;
  if (!Number.isInteger(count) || count < L.minCount) return fail('too_few');
  if (spanMs < LIMITS.minSpanMs) return fail('too_short');
  if (spanMs > L.maxSpanMs) return fail('too_long');
  const rate = count / (spanMs / 1000);
  if (rate > L.maxRate * 1.08) return fail('too_fast');
  if (rate < L.minRate * 0.85) return fail('too_slow');
  if (batch.intervalCv < RHYTHM.minIntervalCv || batch.ampCv < RHYTHM.minAmpCv) return fail('too_regular');
  if (batch.intervalCv > RHYTHM.maxIntervalCv) return fail('erratic');
  if (batch.ampMean < (DETECT[mode].minPeak ?? 0.5) * 0.9 && mode !== 'squats') return fail('too_weak');
  if (ctx.now != null) {
    if (ctx.lastClaimAt != null) {
      const wall = ctx.now - ctx.lastClaimAt;
      if (wall < LIMITS.minClaimGapMs) return fail('too_soon');
      if (spanMs > wall + LIMITS.graceMs) return fail('more_activity_than_time');
    } else if (spanMs > LIMITS.firstClaimMaxMs) return fail('first_claim_too_long');
  }
  return { ok: true, reason: '' };
}

export const emptyDay = (day) => ({ day: day || '', walk: 0, shake: 0, jacks: 0, squats: 0, mpRaw: 0, coinsPaid: 0 });

/** raw Move Points -> effective (diminishing) points */
export function effectiveMp(mpRaw) {
  let e = 0;
  for (const [a, b, k] of CAPS.tiers) if (mpRaw > a) e += (Math.min(mpRaw, b) - a) * k;
  return e;
}

/**
 * Apply an ACCEPTED batch to a day state. Pure: returns {day, creditedUnits, mpGain, capped, coinsOwed}.
 * coinsOwed = coins earned today that are not yet paid (cap-limited); the server pays them via the ledger and bumps coinsPaid.
 */
export function applyBatch(day, mode, count) {
  const d = { ...day };
  const room = Math.max(0, CAPS.dailyUnits[mode] - (d[mode] || 0));
  const credited = Math.max(0, Math.min(Math.floor(count), room));
  const maxRaw = CAPS.tiers[CAPS.tiers.length - 1][1];
  const rawRoom = Math.max(0, maxRaw - d.mpRaw);
  let gain = credited * CAPS.mpPerUnit[mode];
  let creditedUnits = credited;
  if (gain > rawRoom) { creditedUnits = Math.floor(rawRoom / CAPS.mpPerUnit[mode]); gain = creditedUnits * CAPS.mpPerUnit[mode]; }
  d[mode] = (d[mode] || 0) + creditedUnits; d.mpRaw = +(d.mpRaw + gain).toFixed(3);
  const eff = effectiveMp(d.mpRaw);
  const earned = Math.min(CAPS.dailyCoinCap, Math.floor(eff / CAPS.mpPerCoin));
  return { day: d, creditedUnits, mpGain: +gain.toFixed(3), mpEff: +eff.toFixed(2), capped: creditedUnits < count, coinsEarned: earned, coinsOwed: Math.max(0, earned - (d.coinsPaid || 0)) };
}

/** progress toward the daily limit, 0..1 (by raw Move Points) */
export const dayProgress = (day) => clamp(day.mpRaw / CAPS.tiers[CAPS.tiers.length - 1][1], 0, 1);

/* ───────────────────────── browser sensor + claimer ───────────────────────── */

/**
 * Start listening to the phone's motion sensor. MUST be called directly from a user tap (iOS asks for permission).
 * Resolves {ok:true, stop} or {ok:false, reason:'unsupported'|'denied'|'nosensor'|'error'}. No errors are thrown.
 */
export async function startMotionSensor(detector, o = {}) {
  const win = o.window || (typeof window !== 'undefined' ? window : null);
  if (!win || typeof win.addEventListener !== 'function' || typeof win.DeviceMotionEvent === 'undefined') return { ok: false, reason: 'unsupported' };
  const nowFn = o.now || (() => (win.performance ? win.performance.now() : Date.now()));
  try {
    const DME = win.DeviceMotionEvent;
    if (typeof DME.requestPermission === 'function') { // iOS 13+: the prompt (needs the user gesture, so no await before this line)
      const r = await DME.requestPermission();
      if (r !== 'granted') return { ok: false, reason: 'denied' };
    }
  } catch { return { ok: false, reason: 'denied' }; }
  return new Promise((resolve) => {
    let got = false, settled = false;
    const h = (e) => {
      const a = e.accelerationIncludingGravity && e.accelerationIncludingGravity.x != null ? e.accelerationIncludingGravity : e.acceleration;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      if (!got) { got = true; if (!settled) { settled = true; resolve({ ok: true, stop }); } }
      detector.push({ t: nowFn(), x: a.x, y: a.y, z: a.z });
    };
    const stop = () => { try { win.removeEventListener('devicemotion', h); } catch { /* */ } detector.resetSignal(); };
    win.addEventListener('devicemotion', h);
    setTimeout(() => { if (!settled) { settled = true; stop(); resolve({ ok: false, reason: 'nosensor' }); } }, o.timeoutMs ?? 2000);
  });
}

/**
 * createClaimer({detector, send, intervalMs, onResult}) sends the detector's batches to your reward callback.
 *   send(batch) -> Promise<any>   (your server call, or a local ledger). Throw/reject to retry once later.
 *   onResult(result, batch)       called after each successful send
 * Returns {start, stop, flush}. flush() sends any pending units now (call it on Stop).
 */
export function createClaimer({ detector, send, intervalMs = 15000, onResult, onError, setIntervalFn, clearIntervalFn }) {
  const si = setIntervalFn || ((f, ms) => setInterval(f, ms)); const ci = clearIntervalFn || ((h) => clearInterval(h));
  let timer = null, busy = false;
  const flush = async () => {
    if (busy) return null;
    busy = true; let last = null;
    try {
      for (const m of detector.pendingModes()) { // one batch per mode that has unclaimed units
        const evs = detector._events(m); const b = detector.takeBatch(m);
        if (!b) continue;
        try { last = await send(b); if (onResult) onResult(last, b); }
        catch (e) { if (b.count >= 5 && b.spanMs < 120000) detector._restore(m, evs); if (onError) onError(e, b); }
      }
    } finally { busy = false; }
    return last;
  };
  return { start() { if (!timer) timer = si(flush, intervalMs); }, stop() { if (timer) { ci(timer); timer = null; } }, flush };
}
