// Opt-in "Share my dance" (website only). Off by default: Dance Coach is family-friendly, so sharing stays hidden and the hub is
// told kids mode (NickHub.media.setKids(true)) unless a grown-up/13+ user explicitly turns on "Grown-up sharing" in Settings.
// Uploads need a hub passkey account; nothing is ever posted without an explicit tap + confirmation. Server moderates + strips metadata.
const HUB = "https://nick-sites-hub.tekjeep.workers.dev", CTX = "dancecoach";
const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const on = () => !native && localStorage.getItem("dc.share") === "1";
let hubP = null, clip = null;
const $ = (s) => document.querySelector(s);
function loadHub() {
  return (hubP ??= new Promise((res, rej) => {
    const sc = document.createElement("script"); sc.src = HUB + "/embed.js"; sc.defer = true;
    Object.assign(sc.dataset, { site: CTX, chat: "off", feedback: "off", media: on() ? "on" : "off" });
    sc.onload = () => { try { window.NickHub.hide(); window.NickHub.media.setKids(!on()); } catch {} res(window.NickHub); };
    sc.onerror = () => { hubP = null; rej(new Error("hub")); }; document.head.append(sc);
  }));
}
function ui() {
  const b = $("#shareDanceBtn"), g = $("#gallery");
  if (b) b.hidden = !(on() && clip); const sc = $("#shareClipBtn"); if (sc) sc.hidden = !(on() && clip);
  if (g) g.hidden = !on();
}
async function mountGallery() {
  if (!on()) return; try { const H = await loadHub(); H.media.setKids(false); const g = $("#galleryList"); if (g && !g.dataset.m) { g.dataset.m = 1; H.media.mount("#galleryList", { context: CTX, upload: false }); } } catch {}
}
function msg(t) { const e = $("#shareMsg"); if (e) e.textContent = t; }
async function doShare() {
  if (!on() || !clip) return;
  if (clip.duration > 30.5) { msg("That clip is longer than 30 seconds. Record a shorter one to share (sharing stops recording at 30 s)."); return; }
  if (clip.blob.size > 25e6) { msg("That clip is over 25 MB. Record a shorter one to share."); return; }
  if (!confirm("This will be public on Dance Coach. Make sure only you are in the clip.\n\nShare it now?")) return;
  msg("Uploading…");
  try {
    const H = await loadHub(); H.media.setKids(false);
    const ext = clip.type.includes("mp4") ? "mp4" : "webm", file = new File([clip.blob], `dance.${ext}`, { type: ext === "mp4" ? "video/mp4" : "video/webm" });
    const r = await H.media.upload(file, { kind: "video", context: CTX, caption: "My Dance Coach routine", duration: Math.round(clip.duration * 10) / 10 });
    if (r && r.error === "signed_in_required") { $("#shareAuth").hidden = false; msg("Sign in (or create a free account with a passkey) to share. Playing never needs an account."); return; }
    if (r && r.error) { msg(r.error === "too_long" ? "Clips must be 30 seconds or less." : r.error === "kids_mode" ? "Sharing is off in kids mode." : r.error === "rate_limited" ? "Too many uploads today. Try again tomorrow." : "Couldn't share right now (" + r.error + ")."); return; }
    const st = r && r.item && r.item.status;
    msg(st === "approved" ? "🎉 Shared! It's live in Community dances." : st === "rejected" ? "That clip didn't pass the safety check, so it wasn't shared." : "Thanks! It'll appear after a quick safety review.");
    clip = null; ui(); const g = $("#galleryList"); if (g) { g.innerHTML = ""; delete g.dataset.m; mountGallery(); }
  } catch { msg("Couldn't reach the sharing service. Try again later."); }
}
const ogFor = (r) => `${HUB}/og?site=${CTX}&title=${encodeURIComponent(r ? `I scored ${r.pct}% on Dance Coach!` : "Dance Coach")}&sub=${encodeURIComponent(r ? "Can you beat me? Free, on-device dance game" : "Your camera scores your moves, on-device")}&score=${encodeURIComponent(r ? r.stars + " stars" : "Free")}`;
// Grown-up sharing on: use the hub share sheet (all networks, QR, download). Returns false when not available so the caller can use the simple share.
export async function hubShare({ result, file } = {}) {
  if (!on()) return false;
  try { const H = await loadHub(); H.media.setKids(false);
    const r = await H.share.open({ url: "https://dancecoach.pages.dev/?ref=share", title: result ? `I scored ${result.pct}% on Dance Coach!` : "Dance Coach", text: result ? `${result.stars} stars, ${result.perfect} perfect moments. Can you beat me?` : "Free family-friendly dance game. Your camera scores your moves, on-device.", image: ogFor(result), file });
    return !!(r && r.ok) || true; } catch { return false; }
}
export function initShare() {
  if (native) { for (const id of ["shareRow", "gallery", "shareDanceBtn", "shareClipBtn"]) { const e = document.getElementById(id); if (e) e.hidden = true; } return; }
  $("#shareRow").hidden = false;
  const t = $("#shareToggle"); t.setAttribute("aria-checked", on() ? "true" : "false");
  t.onclick = () => { const v = !on(); localStorage.setItem("dc.share", v ? "1" : "0"); t.setAttribute("aria-checked", v ? "true" : "false"); try { window.NickHub?.media.setKids(!v); } catch {} ui(); if (v) mountGallery(); };
  addEventListener("dc-clip", (e) => { clip = e.detail; ui(); });
  $("#shareDanceBtn").onclick = doShare;
  $("#shareClipBtn").onclick = () => clip && hubShare({ file: new File([clip.blob], clip.type.includes("mp4") ? "dance.mp4" : "dance.webm", { type: clip.type.split(";")[0] }) });
  $("#signInBtn").onclick = async () => { try { const H = await loadHub(); await H.signIn(); $("#shareAuth").hidden = true; msg("Signed in! Tap Share my dance again."); } catch { msg("Sign-in was cancelled."); } };
  $("#signUpBtn").onclick = async () => { const h = (prompt("Pick a public nickname (2-24 letters/numbers, no real names):") || "").trim(); if (!h) return; try { const H = await loadHub(); await H.signUp(h); $("#shareAuth").hidden = true; msg("Account created! Tap Share my dance again."); } catch { msg("Couldn't create the account (" + h + ")."); } };
  ui(); if (on()) mountGallery();
}
