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
  const ma = obj(a.m2e), mb = obj(b.m2e); o.m2e = ma.day && ma.day === mb.day ? { day: ma.day, n: Math.max(num(ma.n), num(mb.n)) } : (String(ma.day || "") >= String(mb.day || "") ? { day: String(ma.day || ""), n: num(ma.n) } : { day: String(mb.day || ""), n: num(mb.n) });
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
  const ma = obj(a.m2e), mb = obj(b.m2e); o.m2e = { coins: Math.max(num(ma.coins), num(mb.coins)), owned: union(ma.owned, mb.owned), crates: Math.max(num(ma.crates), num(mb.crates)), opened: Math.max(num(ma.opened), num(mb.opened)) };
  o.owned = union(a.owned, b.owned); o.songs = Math.max(num(a.songs), num(b.songs));
  return o;
}
/** Collect the syncable blob from localStorage (no settings, no camera data). */
export function collect(ls = localStorage) {
  const J = (k, d) => { try { return JSON.parse(ls.getItem(k)) ?? d; } catch { return d; } };
  const pb = {}; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith("dc.pb.")) pb[k.slice(6)] = J(k, []); }
  const m = J("dc.m2e", {}) || {};
  return { v: 1, prog: J("dc.prog", {}), best: J("dc.best", {}), pb, m2e: { coins: m.coins || 0, owned: m.owned || [], crates: m.crates || 0, opened: m.opened || 0 }, owned: J("dc.owned", []), songs: +(ls.getItem("dc.songs") || 0) };
}
/** Write a merged blob back to localStorage. Keeps local-only fields (daily Move to Earn counters, settings). */
export function apply(o, ls = localStorage) {
  const J = (k, d) => { try { return JSON.parse(ls.getItem(k)) ?? d; } catch { return d; } };
  ls.setItem("dc.prog", JSON.stringify(o.prog)); ls.setItem("dc.best", JSON.stringify(o.best));
  for (const k of Object.keys(o.pb)) ls.setItem("dc.pb." + k, JSON.stringify(o.pb[k]));
  const m = J("dc.m2e", null); if (m || o.m2e.coins || o.m2e.owned.length) ls.setItem("dc.m2e", JSON.stringify(Object.assign(m || { v: 1 }, { v: 1 }, o.m2e)));
  ls.setItem("dc.owned", JSON.stringify(o.owned)); ls.setItem("dc.songs", String(o.songs));
}
