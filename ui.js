import { LOOKS, getLook, lookLocked } from "./coach3d.js";
import { STAGES, getStage, stageLocked } from "./stages.js";
import { level } from "./progress.js";
import { isOwned } from "./m2e.js";
// UI layer: settings, onboarding, CC0 sound effects, haptics, reminders. No tracking, no network.
const $ = (s) => document.querySelector(s);
const Cap = window.Capacitor, native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const P = (native && Cap.Plugins) || {};
export const isNative = native;

// ---- settings (localStorage only, never leaves the device) ----
const DEF = { sounds: true, voice: false, haptics: true, rumble: true, reminder: false, remindAt: "17:00", reduced: matchMedia("(prefers-reduced-motion: reduce)").matches, particles: true, calm: false, hc: false, cb: false, m2e: false, ghost: true, coach3d: true, music: true, musicVol: 70, sfxVol: 80, voiceVol: 100, banter: true, smack: true, big: /\b(TV|AFT[A-Z0-9]*|BRAVIA|GoogleTV|SMART-TV|Tizen|Web0S|CrKey)\b/i.test(navigator.userAgent) || new URLSearchParams(location.search).get("tv") === "1" };
export const S = Object.assign({}, DEF, JSON.parse(localStorage.getItem("dc.settings") || "{}"));
if (localStorage.getItem("dc.voice") === "1") S.voice = true; // migrate old toggle
const save = () => localStorage.setItem("dc.settings", JSON.stringify(S));
const applyMotion = () => { document.documentElement.classList.toggle("reduce", !!S.reduced); document.documentElement.classList.toggle("noparticles", S.particles === false || S.calm === true); document.documentElement.classList.toggle("calm", S.calm === true); document.documentElement.classList.toggle("hc", S.hc === true); document.documentElement.classList.toggle("cb", S.cb === true); };
applyMotion();

// ---- sound effects: several CC0 variants per kind, one picked at random ----
const KINDS = { click: 4, perfect: 3, cheer: 4, start: 3, end: 3 };
const ext = new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? "ogg" : "mp3";
let getAudio = null; const bufs = {}, last = {};
export const saveSettings = () => save();
export function setAudio(fn) { getAudio = fn; }
async function buf(ac, url) { if (!bufs[url]) bufs[url] = fetch(url).then((r) => r.arrayBuffer()).then((a) => ac.decodeAudioData(a)).catch(() => (delete bufs[url], null)); return bufs[url]; }
export async function sfx(kind, vol = 0.8) {
  if (!S.sounds || !getAudio || !KINDS[kind]) return;
  const { ac, out } = getAudio(); if (ac.state === "suspended") ac.resume();
  let i; do { i = 1 + Math.floor(Math.random() * KINDS[kind]); } while (KINDS[kind] > 1 && i === last[kind]); last[kind] = i;
  const b = await buf(ac, `sfx/${kind}${i}.${ext}`); if (!b) return;
  const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; g.gain.value = vol; s.connect(g).connect(out); s.start();
}

// ---- haptics: native Haptics plugin in the app, Vibration API on web ----
export function haptic(kind = "light") {
  if (!S.haptics) return;
  if (document.documentElement.classList.contains("reduce") && kind !== "success") return; // Reduce motion: only the important buzzes
  try {
    if (P.Haptics) { kind === "success" ? P.Haptics.notification({ type: "SUCCESS" }) : P.Haptics.impact({ style: kind === "heavy" ? "HEAVY" : kind === "medium" ? "MEDIUM" : "LIGHT" }); }
    else navigator.vibrate?.(kind === "success" ? [30, 60, 30] : kind === "heavy" ? 40 : 15);
  } catch {}
}

// ---- daily reminder (Android app only, off until the user opts in) ----
async function setReminder(on) {
  const LN = P.LocalNotifications; if (!LN) return false;
  try {
    await LN.cancel({ notifications: [{ id: 1 }] });
    if (!on) return true;
    const p = await LN.requestPermissions(); if (p.display !== "granted") return false;
    const [hour, minute] = S.remindAt.split(":").map(Number);
    await LN.schedule({ notifications: [{ id: 1, title: "💃 Daily challenge is ready", body: "Coach Disco Dan has 9 new moves for you. Keep your streak going!", schedule: { on: { hour, minute }, allowWhileIdle: true } }] });
    return true;
  } catch { return false; }
}

// ---- screens: onboarding, settings, privacy ----
function openSheet(id) { const d = $(id); d.hidden = false; d.querySelector("h2")?.focus(); }
function closeSheet(id) { $(id).hidden = true; $("#settingsBtn")?.focus(); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.querySelectorAll(".sheet:not([hidden])").forEach((d) => (d.hidden = true)); });

function onboarding() {
  const ob = $("#onboard"), steps = [...ob.querySelectorAll(".step")]; let k = 0;
  const show = () => { steps.forEach((s, i) => (s.hidden = i !== k)); ob.querySelectorAll(".dots i").forEach((d, i) => d.classList.toggle("on", i === k)); $("#obNext").textContent = k === steps.length - 1 ? "Let's dance!" : "Next"; steps[k].querySelector("h2").focus(); };
  $("#obNext").onclick = () => { if (k < steps.length - 1) { k++; show(); } else { localStorage.setItem("dc.onboarded", "1"); ob.hidden = true; $("#camBtn").focus(); } };
  $("#obSkip").onclick = () => { localStorage.setItem("dc.onboarded", "1"); ob.hidden = true; };
  if (!localStorage.getItem("dc.onboarded")) { ob.hidden = false; show(); }
}

const VOLS = [["musicVol", "🎵", "Music", 70], ["sfxVol", "🔔", "Sound effects", 80], ["voiceVol", "🗣️", "Coach voice", 100]];
const lockTxt = (l) => (l.lvl && level() < l.lvl ? ` 🔒 Lv ${l.lvl}` : "");
const lockAttr = (l) => (l.lvl && level() < l.lvl ? ` disabled aria-label="${l.name}, unlocks at level ${l.lvl}"` : "");
const stageHTML = () => STAGES.map((l) => `<button class="lookChip stageChip" data-stage="${l.id}" aria-pressed="${getStage().id === l.id}" style="--c:${l.lights[0]}"${lockAttr(l)}>${l.name}${lockTxt(l)}</button>`).join("");
const lookHTML = () => LOOKS.filter((l) => !l.silly || isOwned(l.id)).map((l) => `<button class="lookChip" data-look="${l.id}" aria-pressed="${getLook().id === l.id}" style="--c:${l.top}"${lockAttr(l)}>${l.silly ? l.emoji + " " : ""}${l.name}${lockTxt(l)}</button>`).join("");
function refreshLooks() { const r = $("#lookRow > div"); if (r) r.innerHTML = lookHTML(); const t = document.querySelector('[aria-label="Dance stage"] > div'); if (t) t.innerHTML = stageHTML(); }

function settings() {
  const rows = [["music", "Music", "Original beats for every song"], ["sounds", "Sound effects", "Clicks, cheers, hit sounds and stingers"], ["banter", "Coach jokes & commentary", "Funny lines from Coach Disco Dan. Always clean and family-friendly."], ["smack", "Playful trash talk", "Friendly teasing about the beat and the disco ball, never about real people. Clean. Turn off any time."], ["voice", "Coach voice", "Coach Disco Dan reads his lines out loud"], ["haptics", "Haptics", "Little buzzes on great moves"], ["rumble", "Controller rumble", "Gamepad vibration on great moves"], ["reduced", "Reduce motion", "Fewer animations"], ["particles", "Sparkle effects", "Confetti bursts on great moves"], ["calm", "Reduce flashing", "No beat flashes or strobing lights; the stage stays still. Good for light sensitivity."], ["hc", "High contrast", "Brighter text and stronger outlines"], ["cb", "Color-blind friendly colors", "Hit colors that stay clear for every kind of color vision. Shapes (★ ◆ ● ✕) always show too."], ["coach3d", "3D coach", "Animated 3D coach (2D on Low quality or slower devices)"], ["ghost", "Ghost replay", "Faint outline of your best run on each song"], ["big", "Large screen mode", "Bigger buttons and text for TVs — arrow keys or remote to move"]];
  rows.push(["m2e", "Move to Earn (optional)", "Earn silly-outfit coins for steps, shakes and squats. Off by default; nothing is counted until you tap Start inside it. No location, nothing uploaded."]);
  if (native) rows.push(["reminder", "Daily reminder", "A gentle nudge for the daily challenge"]);
  const box = $("#settingsList");
  box.innerHTML = VOLS.map(([k, ic, t, d]) => `<label class="timeRow volRow"><span>${ic} ${t}</span><input type="range" id="${k}" min="0" max="100" step="5" value="${S[k] ?? d}" aria-label="${t} volume"><output id="${k}Out">${S[k] ?? d}%</output></label>`).join("") + rows.map(([k, t, d]) => `<button class="switch" role="switch" aria-checked="${!!S[k]}" data-k="${k}"><span><b>${t}</b><small>${d}</small></span><i aria-hidden="true"></i></button>`).join("")
    + `<div class="lookRow" role="group" aria-label="Dance stage"><b>Dance stage</b><div>${stageHTML()}</div></div>`
    + `<div class="lookRow" id="lookRow" role="group" aria-label="Coach outfit"><b>Coach outfit</b><div>${lookHTML()}</div></div>`
    + (native ? `<label class="timeRow">Reminder time <input type="time" id="remindAt" value="${S.remindAt}"></label>` : `<p class="note">Daily reminders are available in the Android app.</p>`);
  box.onclick = async (e) => {
    const sc = e.target.closest(".stageChip"); if (sc) { localStorage.setItem("dc.stage", sc.dataset.stage); box.querySelectorAll(".stageChip").forEach((x) => x.setAttribute("aria-pressed", x === sc)); haptic(); window.dispatchEvent(new CustomEvent("dc-settings", { detail: "stage" })); return; }
    const lc = e.target.closest(".lookChip"); if (lc) { localStorage.setItem("dc.look", lc.dataset.look); box.querySelectorAll(".lookChip:not(.stageChip)").forEach((x) => x.setAttribute("aria-pressed", x === lc)); haptic(); window.dispatchEvent(new CustomEvent("dc-settings", { detail: "look" })); return; }
    const b = e.target.closest(".switch"); if (!b) return; const k = b.dataset.k; S[k] = !S[k];
    if (k === "reminder") { const ok = await setReminder(S[k]); if (!ok && S[k]) { S[k] = false; alert("Notifications are blocked. You can allow them in Android Settings › Apps › Dance Coach."); } }
    if (k === "voice" && !S.voice) window.speechSynthesis?.cancel();
    if (k === "reduced" || k === "particles" || k === "calm" || k === "hc" || k === "cb") applyMotion(); if (k === "big") document.documentElement.classList.toggle("big", !!S.big);
    b.setAttribute("aria-checked", !!S[k]); save(); haptic(); window.dispatchEvent(new CustomEvent("dc-settings", { detail: k }));
  };
  addEventListener("dc-m2e", refreshLooks); addEventListener("dc-prog", refreshLooks);
  addEventListener("dc-settings", (e) => { if (e.detail === "look") box.querySelectorAll(".lookChip:not(.stageChip)").forEach((x) => x.setAttribute("aria-pressed", x.dataset.look === getLook().id)); });
  for (const [k, , , d] of VOLS) { const el = $("#" + k); if (!el) continue; el.oninput = () => { S[k] = +el.value; $("#" + k + "Out").textContent = el.value + "%"; const sw = { musicVol: "music", sfxVol: "sounds", voiceVol: "voice" }[k]; if (sw && k !== "voiceVol" && S[sw] === false && +el.value > 0) { S[sw] = true; box.querySelector(`[data-k="${sw}"]`)?.setAttribute("aria-checked", "true"); } save(); window.dcApplyMusicVol?.(); if (k === "voiceVol" && S.voice && +el.value > 0) window.speechSynthesis?.cancel(); }; }
  const t = $("#remindAt"); if (t) t.onchange = () => { S.remindAt = t.value; save(); if (S.reminder) setReminder(true); };
  $("#settingsBtn").onclick = () => openSheet("#settings");
  document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => closeSheet("#" + b.closest(".sheet").id)));
  $("#privacyBtn").onclick = () => openSheet("#privacy");
  $("#replayOb").onclick = () => { closeSheet("#settings"); localStorage.removeItem("dc.onboarded"); onboarding(); };
}

// global click sound + light haptic on every button
document.addEventListener("click", (e) => { if (e.target.closest("button, .btn")) { sfx("click", 0.5); haptic("light"); } }, true);

onboarding(); settings();
if (native) { P.SplashScreen?.hide?.(); P.StatusBar?.setBackgroundColor?.({ color: "#120a22" }).catch?.(() => {}); }
