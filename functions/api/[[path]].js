// Dance Coach account API (same origin, Cloudflare Pages Functions + D1). Optional passkey sign-in to sync progress.
// Stores only: random account id, passkey public keys, hashed session tokens, the progress blob. No email, no names.
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { mergeBlob } from "../../sync-merge.js";

const SESSION_S = 7 * 86400, COOKIE = "__Host-dc_s", MAX_BLOB = 65536;
const LIMITS = { auth: [30, 600], read: [120, 600], write: [120, 600], acct: [60, 600] }; // [max, window seconds]
const enc = new TextEncoder();
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const rnd = (n) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const sha = async (s) => b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))));
const HDR = { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: Object.assign({}, HDR, extra) });
const cookieSet = (tok) => `${COOKIE}=${tok}; Path=/; Max-Age=${SESSION_S}; HttpOnly; Secure; SameSite=Strict`;
const cookieClear = `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

async function limited(db, key, [max, win]) {
  const now = Math.floor(Date.now() / 1000), w = Math.floor(now / win), k = key + ":" + w;
  const r = await db.prepare("INSERT INTO rl (k, n, exp) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n").bind(k, (w + 1) * win).first();
  if (Math.random() < 0.05) await db.prepare("DELETE FROM rl WHERE exp < ?").bind(now).run();
  return r.n > max;
}
async function session(db, req) {
  const m = (req.headers.get("Cookie") || "").match(/(?:^|;\s*)__Host-dc_s=([\w-]{20,80})/);
  if (!m) return null;
  const h = await sha(m[1]), now = Date.now();
  const s = await db.prepare("SELECT uid, exp FROM sessions WHERE h = ? AND exp > ?").bind(h, now).first();
  return s ? { uid: s.uid, h, tok: m[1], exp: s.exp } : null;
}
async function newSession(db, uid) {
  const tok = rnd(32); await db.prepare("INSERT INTO sessions (h, uid, exp) VALUES (?, ?, ?)").bind(await sha(tok), uid, Date.now() + SESSION_S * 1000).run();
  if (Math.random() < 0.1) await db.prepare("DELETE FROM sessions WHERE exp < ?").bind(Date.now()).run();
  return tok;
}
async function takeChallenge(db, resp, kind) {
  let c = ""; try { c = JSON.parse(new TextDecoder().decode(unb64u(resp.response.clientDataJSON))).challenge; } catch { return null; }
  if (typeof c !== "string" || c.length > 200) return null;
  const r = await db.prepare("DELETE FROM chal WHERE c = ? AND kind = ? AND exp > ? RETURNING c, uid").bind(c, kind, Date.now()).first();
  return r || null;
}
async function putChallenge(db, c, kind, uid) {
  await db.batch([db.prepare("DELETE FROM chal WHERE exp < ?").bind(Date.now()), db.prepare("INSERT INTO chal (c, kind, uid, exp) VALUES (?, ?, ?, ?)").bind(c, kind, uid || null, Date.now() + 300000)]);
}
const blobOf = (row) => { try { return row && row.blob ? JSON.parse(row.blob) : null; } catch { return null; } };
async function readBody(req) { const t = await req.text(); if (t.length > MAX_BLOB) return { tooBig: true }; try { return JSON.parse(t || "{}"); } catch { return {}; } }

export async function onRequest({ request: req, env, params }) {
  const db = env.DB; if (!db) return json({ error: "unavailable" }, 503);
  const url = new URL(req.url), origin = url.origin, rpID = url.hostname, path = "/" + [].concat(params.path || []).join("/"), method = req.method;
  const ip = req.headers.get("CF-Connecting-IP") || "local";
  // CSRF: state changes need same-origin Origin + a custom header (cross-site requests can't send it without a CORS preflight, which we never allow).
  if (method !== "GET" && method !== "HEAD") { if (req.headers.get("Origin") !== origin || req.headers.get("X-DC") !== "1") return json({ error: "forbidden" }, 403); }
  const isAuth = path.startsWith("/auth/") && path !== "/auth/logout";
  if (await limited(db, "ip:" + ip + ":" + (isAuth ? "auth" : method === "GET" ? "read" : "write"), LIMITS[isAuth ? "auth" : method === "GET" ? "read" : "write"])) return json({ error: "rate_limited" }, 429, { "Retry-After": "600" });
  const s = await session(db, req);
  try {
    if (path === "/auth/register/options" && method === "POST") {
      const uid = s ? s.uid : rnd(12);
      const exclude = s ? (await db.prepare("SELECT id FROM creds WHERE uid = ?").bind(uid).all()).results.map((r) => ({ id: r.id })) : [];
      const o = await generateRegistrationOptions({ rpName: "Dance Coach", rpID, userID: enc.encode(uid), userName: "Dance Coach player", userDisplayName: "Dance Coach player", attestationType: "none", excludeCredentials: exclude, authenticatorSelection: { residentKey: "required", userVerification: "preferred" }, supportedAlgorithmIDs: [-7, -257] });
      await putChallenge(db, o.challenge, "reg", uid); return json(o);
    }
    if (path === "/auth/register/verify" && method === "POST") {
      const b = await readBody(req); if (b.tooBig || !b.response) return json({ error: "bad_request" }, 400);
      const ch = await takeChallenge(db, b.response, "reg"); if (!ch) return json({ error: "bad_challenge" }, 400);
      const v = await verifyRegistrationResponse({ response: b.response, expectedChallenge: ch.c, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false });
      if (!v.verified || !v.registrationInfo) return json({ error: "not_verified" }, 400);
      const { credential } = v.registrationInfo, uid = ch.uid, now = Date.now();
      if (s && s.uid !== uid) return json({ error: "bad_challenge" }, 400);
      await db.batch([db.prepare("INSERT OR IGNORE INTO accounts (id, created, updated, blob) VALUES (?, ?, ?, NULL)").bind(uid, now, now),
        db.prepare("INSERT INTO creds (id, uid, pk, counter, transports, created) VALUES (?, ?, ?, ?, ?, ?)").bind(credential.id, uid, b64u(credential.publicKey), credential.counter || 0, JSON.stringify(credential.transports || []).slice(0, 200), now)]);
      const tok = s ? s.tok : await newSession(db, uid);
      return json({ ok: true, account: uid.slice(0, 6) }, 200, { "Set-Cookie": cookieSet(tok) });
    }
    if (path === "/auth/login/options" && method === "POST") {
      const o = await generateAuthenticationOptions({ rpID, userVerification: "preferred", allowCredentials: [] });
      await putChallenge(db, o.challenge, "login", null); return json(o);
    }
    if (path === "/auth/login/verify" && method === "POST") {
      const b = await readBody(req); if (b.tooBig || !b.response || typeof b.response.id !== "string") return json({ error: "bad_request" }, 400);
      const ch = await takeChallenge(db, b.response, "login"); if (!ch) return json({ error: "bad_challenge" }, 400);
      const c = await db.prepare("SELECT * FROM creds WHERE id = ?").bind(b.response.id.slice(0, 1400)).first(); if (!c) return json({ error: "unknown_passkey" }, 404);
      if (await limited(db, "acct:" + c.uid + ":auth", LIMITS.acct)) return json({ error: "rate_limited" }, 429, { "Retry-After": "600" });
      const v = await verifyAuthenticationResponse({ response: b.response, expectedChallenge: ch.c, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false, credential: { id: c.id, publicKey: unb64u(c.pk), counter: c.counter, transports: JSON.parse(c.transports || "[]") } });
      if (!v.verified) return json({ error: "not_verified" }, 401);
      await db.prepare("UPDATE creds SET counter = ? WHERE id = ?").bind(v.authenticationInfo.newCounter || 0, c.id).run();
      if (s) await db.prepare("DELETE FROM sessions WHERE h = ?").bind(s.h).run();
      return json({ ok: true, account: c.uid.slice(0, 6) }, 200, { "Set-Cookie": cookieSet(await newSession(db, c.uid)) });
    }
    if (path === "/auth/logout" && method === "POST") { if (s) await db.prepare("DELETE FROM sessions WHERE h = ?").bind(s.h).run(); return json({ ok: true }, 200, { "Set-Cookie": cookieClear }); }
    if (path === "/me" && method === "GET") {
      if (!s) return json({ signedIn: false });
      const a = await db.prepare("SELECT blob, updated FROM accounts WHERE id = ?").bind(s.uid).first(); if (!a) return json({ signedIn: false }, 200, { "Set-Cookie": cookieClear });
      const extra = s.exp - Date.now() < (SESSION_S * 1000) / 2 ? (await db.prepare("UPDATE sessions SET exp = ? WHERE h = ?").bind(Date.now() + SESSION_S * 1000, s.h).run(), { "Set-Cookie": cookieSet(s.tok) }) : {};
      const n = await db.prepare("SELECT COUNT(*) AS n FROM creds WHERE uid = ?").bind(s.uid).first();
      return json({ signedIn: true, account: s.uid.slice(0, 6), passkeys: n.n, updated: a.updated, progress: blobOf(a) }, 200, extra);
    }
    if (path === "/progress" && method === "PUT") {
      if (!s) return json({ error: "signed_out" }, 401);
      if (await limited(db, "acct:" + s.uid + ":write", LIMITS.acct)) return json({ error: "rate_limited" }, 429, { "Retry-After": "600" });
      const b = await readBody(req); if (b.tooBig) return json({ error: "too_big" }, 413); if (!b.progress || typeof b.progress !== "object") return json({ error: "bad_request" }, 400);
      const a = await db.prepare("SELECT blob FROM accounts WHERE id = ?").bind(s.uid).first(); if (!a) return json({ error: "signed_out" }, 401, { "Set-Cookie": cookieClear });
      const merged = mergeBlob(b.progress, blobOf(a) || {}), txt = JSON.stringify(merged); if (txt.length > MAX_BLOB) return json({ error: "too_big" }, 413);
      const now = Date.now(); await db.prepare("UPDATE accounts SET blob = ?, updated = ? WHERE id = ?").bind(txt, now, s.uid).run();
      return json({ ok: true, updated: now, progress: merged });
    }
    if (path === "/me" && method === "DELETE") {
      if (!s) return json({ error: "signed_out" }, 401);
      await db.batch(["DELETE FROM accounts WHERE id = ?", "DELETE FROM creds WHERE uid = ?", "DELETE FROM sessions WHERE uid = ?"].map((q) => db.prepare(q).bind(s.uid)));
      return json({ ok: true }, 200, { "Set-Cookie": cookieClear });
    }
    return json({ error: "not_found" }, 404);
  } catch (e) { return json({ error: "server_error" }, 500); }
}
