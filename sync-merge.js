// Progress sync merge rule (shared by the browser and the server): keep the higher values and union the unlocks. Never drops guest progress.
const num = (x) => (Number.isFinite(+x) ? +x : 0);
const obj = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
const arr = (x) => (Array.isArray(x) ? x : []);
const union = (a, b) => [...new Set(arr(a).concat(arr(b)).filter((v) => typeof v === "string").map((v) => v.slice(0, 40)))].slice(0, 200);
function mergeProg(a, b) {
  a = obj(a); b = obj(b); const o = Object.assign({}, b, a);
  o.v = 1; o.xp = Math.min(1e7, Math.max(num(a.xp), num(b.xp))); o.songs = Math.max(num(a.songs), num(b.songs));
  o.badges = {}; for (const s of [obj(b.badges), obj(a.badges)]) for (const k of Object.keys(s).slice(0, 100)) { const t = num(s[k]) || 1; o.badges[k] = o.badges[k] ? Math.min(o.badges[k], t) : t; }
  o.events = {}; for (const s of [obj(b.events), obj(a.events)]) for (const k of Object.keys(s).slice(0, 100)) { const t = num(s[k]) || 1; o.events[k] = o.events[k] ? Math.min(o.events[k], t) : t; }
  o.tracks = union(a.tracks, b.tracks);
  o.moves = {}; for (const s of [obj(b.moves), obj(a.moves)]) for (const k of Object.keys(s).slice(0, 200)) { const m = arr(s[k]); if (m.length === 2 && (!o.moves[k] || num(m[1]) > num(o.moves[k][1]))) o.moves[k] = [num(m[0]), num(m[1])]; }
  const seen = new Set(), h = []; for (const r of arr(b.hist).concat(arr(a.hist))) { if (!r || typeof r !== "object") continue; const k = [r.t, r.p, r.d, r.sp].join("|"); if (!seen.has(k)) { seen.add(k); h.push({ t: String(r.t || "?").slice(0, 30), p: num(r.p), d: String(r.d || "").slice(0, 10), sp: num(r.sp) || 1 }); } }
  h.sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0)); o.hist = h.slice(-40);
  delete o.m2e; // daily Move-to-Earn XP counter is device-only
  o.lastDay = String(a.lastDay || "") >= String(b.lastDay || "") ? a.lastDay || "" : b.lastDay || "";
  return o;
}
function mergeBoard(a, b) { const seen = new Set(), out = []; for (const r of arr(a).concat(arr(b))) { if (!r || !Number.isFinite(+r.pct)) continue; const k = r.pct + "|" + r.at; if (!seen.has(k)) { seen.add(k); out.push({ pct: num(r.pct), at: num(r.at) }); } } out.sort((x, y) => y.pct - x.pct || x.at - y.at); return out.slice(0, 5); }
/** a = this device, b = the other side (server). Returns a new merged blob. */
export function mergeBlob(a, b) {
  a = obj(a); b = obj(b); const o = { v: 1 };
  o.prog = mergeProg(a.prog, b.prog);
  o.best = {}; for (const s of [obj(b.best), obj(a.best)]) for (const k of Object.keys(s)) if (/^\d{4}-\d{2}-\d{2}$/.test(k)) o.best[k] = Math.max(o.best[k] ?? 0, Math.min(100, num(s[k])));
  const bk = Object.keys(o.best).sort(); for (const k of bk.slice(0, Math.max(0, bk.length - 400))) delete o.best[k];
  o.pb = {}; const pa = obj(a.pb), pbb = obj(b.pb); for (const k of new Set(Object.keys(pa).concat(Object.keys(pbb)))) if (/^[\w@.-]{1,60}$/.test(k) && Object.keys(o.pb).length < 80) o.pb[k] = mergeBoard(pa[k], pbb[k]);
  // Coin wallet (coins, crates, daily counters) is device-only so spent coins can't come back; only bought cosmetics sync.
  const ma = obj(a.m2e), mb = obj(b.m2e); o.m2e = { owned: union(ma.owned, mb.owned) };
  o.owned = union(a.owned, b.owned); o.songs = Math.max(num(a.songs), num(b.songs));
  return o;
}
/** Drop any wallet fields (e.g. coins stored on the server by an older version). */
export function clean(x) { return x && typeof x === "object" ? mergeBlob({}, x) : null; }
/** Collect the syncable blob from localStorage (no settings, no camera data). */
export function collect(ls = localStorage) {
  const J = (k, d) => { try { return JSON.parse(ls.getItem(k)) ?? d; } catch { return d; } };
  const pb = {}; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith("dc.pb.")) pb[k.slice(6)] = J(k, []); }
  const m = J("dc.m2e", {}) || {};
  return { v: 1, prog: J("dc.prog", {}), best: J("dc.best", {}), pb, m2e: { owned: m.owned || [] }, owned: J("dc.owned", []), songs: +(ls.getItem("dc.songs") || 0) };
}
/** Write a merged blob back to localStorage. Keeps local-only fields (daily Move to Earn counters, settings). */
export function apply(o, ls = localStorage) {
  const J = (k, d) => { try { return JSON.parse(ls.getItem(k)) ?? d; } catch { return d; } };
  const lp = J("dc.prog", {}) || {}; const prog = Object.assign({}, o.prog); delete prog.m2e; if (lp.m2e) prog.m2e = lp.m2e;
  ls.setItem("dc.prog", JSON.stringify(prog)); ls.setItem("dc.best", JSON.stringify(o.best));
  for (const k of Object.keys(o.pb)) ls.setItem("dc.pb." + k, JSON.stringify(o.pb[k]));
  const m = J("dc.m2e", null), own = arr(obj(o.m2e).owned); if (m || own.length) ls.setItem("dc.m2e", JSON.stringify(Object.assign(m || { v: 1, coins: 0, crates: 0, opened: 0 }, { owned: union(obj(m).owned, own) })));
  ls.setItem("dc.owned", JSON.stringify(o.owned)); ls.setItem("dc.songs", String(o.songs));
}
