// Optional sign-in with a passkey to carry progress between devices. Guests play instantly; progress always stays on this device.
// No passwords, no email. Talks only to this site's own /api (same origin). Hidden in the Android app and on browsers without passkeys.
import { mergeBlob, collect, apply } from "./sync-merge.js";
const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const ok = !native && !!window.PublicKeyCredential && (location.protocol === "https:" || location.hostname === "localhost");
const FLAG = "dc.acct"; let me = null, busy = false, lastSync = 0, timer = 0;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
async function api(path, method = "GET", body) {
  const r = await fetch("/api" + path, { method, credentials: "same-origin", headers: method === "GET" ? {} : { "Content-Type": "application/json", "X-DC": "1" }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {} j.status = r.status; return j;
}
let libP = null;
const lib = () => libP || (libP = new Promise((res, rej) => { if (window.SimpleWebAuthnBrowser) return res(window.SimpleWebAuthnBrowser); const s = document.createElement("script"); s.src = "vendor/simplewebauthn-browser.umd.min.js"; s.onload = () => res(window.SimpleWebAuthnBrowser); s.onerror = () => { libP = null; rej(new Error("load")); }; document.head.appendChild(s); }));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Merge server progress into this device (keep higher values, union unlocks), then upload. Reloads once if this device changed. */
async function syncFull(server, reason) {
  const local = collect(), merged = server ? mergeBlob(local, server) : mergeBlob(local, {});
  const changed = !same(mergeBlob(local, {}), merged);
  if (changed) apply(merged);
  const r = await api("/progress", "PUT", { progress: merged }); if (r.ok) { lastSync = r.updated; if (!same(r.progress, merged)) { apply(r.progress); } }
  if ((changed || (r.ok && !same(r.progress, merged))) && !sessionStorage.getItem("dc.syncReload")) { sessionStorage.setItem("dc.syncReload", "1"); sessionStorage.setItem("dc.syncMsg", reason); location.reload(); return true; }
  return false;
}
async function refresh(initial) {
  const r = await api("/me").catch(() => null);
  if (!r || r.status >= 400 && r.status !== 429) { me = null; if (r && r.status === 404) hideAll(); return; }
  if (r.status === 429) return;
  me = r.signedIn ? r : null; if (!me) { localStorage.removeItem(FLAG); render(); return; }
  localStorage.setItem(FLAG, "1"); lastSync = r.updated;
  if (initial && !playing()) { if (await syncFull(r.progress, "Progress synced from your account.")) return; }
  render();
}
const playing = () => document.body.classList.contains("dancing");
function hideAll() { const el = $("#pgAcct"); if (el) el.innerHTML = ""; }
function msg(t) { const m = $("#acctMsg"); if (m) m.textContent = t; }
function render() {
  const el = $("#pgAcct"); if (!el || !ok) return;
  if (!me) el.innerHTML = `<h3>Save across devices (optional)</h3><p class="note">You're playing as a guest, and your progress is saved on this device. Sign in with a passkey (your fingerprint, face or screen lock) to carry it to your other devices. No password or email needed.</p>
  <div class="row grow"><button id="acctNew" class="b-gold">🔑 Save my progress with a passkey</button><button id="acctIn" class="b-soft">I have a passkey: sign in</button></div><p id="acctMsg" class="note" role="status"></p>`;
  else el.innerHTML = `<h3>Account</h3><p class="note">✅ Signed in with a passkey. Progress syncs after each song${lastSync ? ` · last synced ${esc(new Date(lastSync).toLocaleString())}` : ""}.</p>
  <div class="row grow"><button id="acctSync" class="b-sky">🔄 Sync now</button><button id="acctOut" class="b-soft">Sign out</button></div>
  <p class="note"><button id="acctDel" class="b-soft" style="font-size:13px;padding:6px 10px">Delete account</button> Deletes your synced copy. Progress on this device stays.</p><p id="acctMsg" class="note" role="status"></p>`;
}
const errText = (e, r) => (e && (e.name === "NotAllowedError" || e.name === "AbortError") ? "Cancelled. You can keep playing as a guest." : r && r.status === 429 ? "Too many tries. Please wait a few minutes." : r && r.error === "unknown_passkey" ? "That passkey isn't linked to an account here (maybe it was deleted). Tap 'Save my progress' to make a new one." : "Couldn't finish sign-in. Your progress is safe on this device.");
async function signUp() {
  let r; try { const L = await lib(); r = await api("/auth/register/options", "POST", {}); if (r.status !== 200) throw 0; delete r.status;
    const att = await L.startRegistration({ optionsJSON: r }); r = await api("/auth/register/verify", "POST", { response: att }); if (!r.ok) throw 0;
    localStorage.setItem(FLAG, "1"); msg("Passkey saved. Syncing…"); await refreshAfterAuth("Signed in. Your progress is saved to your account.");
  } catch (e) { msg(errText(e, r)); }
}
async function signIn() {
  let r; try { const L = await lib(); r = await api("/auth/login/options", "POST", {}); if (r.status !== 200) throw 0; delete r.status;
    const as = await L.startAuthentication({ optionsJSON: r }); r = await api("/auth/login/verify", "POST", { response: as }); if (!r.ok) { if (r.error === "unknown_passkey") try { await PublicKeyCredential.signalUnknownCredential?.({ rpId: location.hostname, credentialId: as.id }); } catch {} throw 0; }
    localStorage.setItem(FLAG, "1"); msg("Signed in. Syncing…"); await refreshAfterAuth("Signed in. Progress from this device and your account were combined.");
  } catch (e) { msg(errText(e, r)); }
}
async function refreshAfterAuth(text) { const r = await api("/me"); me = r.signedIn ? r : null; if (me) { sessionStorage.removeItem("dc.syncReload"); if (await syncFull(r.progress, text)) return; } render(); msg(text); }
async function signOut() { await api("/auth/logout", "POST", {}).catch(() => {}); me = null; localStorage.removeItem(FLAG); render(); msg("Signed out. Your progress stays on this device."); }
async function del(b) {
  if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Tap again to delete your account"; return; }
  const r = await api("/me", "DELETE", {}).catch(() => ({})); if (r.ok) { me = null; localStorage.removeItem(FLAG); render(); msg("Account deleted. Your progress on this device is still here. You can also remove the passkey in your device settings."); } else msg(errText(null, r));
}
/** After each song: upload (server keeps the higher values). */
function queueSync() { if (!me) return; clearTimeout(timer); timer = setTimeout(async () => { const r = await api("/progress", "PUT", { progress: collect() }).catch(() => null); if (r && r.ok) lastSync = r.updated; }, 1500); }
if (ok) {
  document.addEventListener("click", (e) => { const b = e.target.closest("#pgAcct button"); if (!b || busy) return; busy = true;
    const f = { acctNew: signUp, acctIn: signIn, acctOut: signOut, acctSync: () => syncFull(me && me.progress, "Progress synced.").then(() => refresh(false)).then(() => msg("Synced ✓")), acctDel: () => del(b) }[b.id];
    Promise.resolve(f && f()).finally(() => (busy = false)); });
  addEventListener("dc-prog", (e) => { if (e.detail === "run" || e.detail === "m2e") queueSync(); });
  window.dcAccountRender = render;
  const m = sessionStorage.getItem("dc.syncMsg"); if (m) { sessionStorage.removeItem("dc.syncMsg"); setTimeout(() => { const t = document.getElementById("progToast"); if (t) { t.textContent = "☁️ " + m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 3500); } }, 800); }
  setTimeout(() => sessionStorage.removeItem("dc.syncReload"), 10000);
  if (localStorage.getItem(FLAG) === "1") refresh(true); // guests make no network calls
}
window.dcAccount = { ok, state: () => (me ? { signedIn: true, account: me.account } : { signedIn: false }) };
