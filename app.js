// Dance Coach — on-device pose scoring (MediaPipe). Camera frames never leave the device.
import { sfx, haptic, S, setAudio } from "./ui.js";
import { initPads, rumble, moveFocus } from "./gamepad.js";
import { initI18n } from "./i18n.js";
import { coins } from "./coins.js";
import { seasonLine, activeSeason, THEMES, seasonLabel, eventKey, EVENT_GOAL } from "./seasons.js";
import { banterFor } from "./banter.js";
import { initShare, hubShare } from "./share.js";
import { initShop, coachColor } from "./shop.js";
import { initControls, showControls } from "./controls.js";
initI18n();
coins.onOpen();
initControls(); window.dcShowControls = showControls; initShop(); initShare();
{ const ss = document.getElementById("speedSel"); if (ss) { ss.value = SPEEDS.includes(+localStorage.getItem("dc.speed")) ? String(+localStorage.getItem("dc.speed")) : "1"; ss.onchange = () => localStorage.setItem("dc.speed", ss.value); } }
{ const ds = document.getElementById("diffSel"); if (ds) { ds.value = localStorage.getItem("dc.diff") || "normal"; ds.onchange = () => localStorage.setItem("dc.diff", ds.value); } }
{ const qs = document.getElementById("qualSel"); if (qs) { qs.value = localStorage.getItem("dc.quality") || "auto"; qs.onchange = () => window.dcSetQuality(qs.value); } }
for (const e of document.querySelectorAll(".ver")) e.textContent = window.DC_VERSION || "";
import { initTV, isTV, initTips, showTips, ghostStart, ghostRecord, ghostDraw, finishRun, boardHTML } from "./features.js";
import { coachReset, coachAdd, coachReport, coachHTML, liveReset, coachLive } from "./coach.js";
import { MOVES, poseAngles, similarity, drawCoach, wrap, SEGS } from "./moves.js";
import { drawStage } from "./stages.js";
import { coach3dLoad, coach3dReady, coach3dRender, applyLook, getLook } from "./coach3d.js";
import "./m2e-ui.js";
import { UNLOCK, level, dayKey, streakOf, onRun, state as progState, noteMove, flushMoves, weakMoves } from "./progress.js";
import { dailyPlan, tierFor, speedSuggestion, practicePlan, favouriteSong, SPEEDS } from "./smart.js";
import "./progress-ui.js";
import "./account.js";
const TV = "0.10.14";
const CDN = new URL("./vendor", location.href).href.replace(/\/$/, ""); // bundled locally (works offline + in the Android app)
const MODEL = new URL("./vendor/pose_landmarker_lite.task", location.href).href;
const $ = (s) => document.querySelector(s);

// ---- original synthesized tracks (made in-browser with Web Audio; CC0, see CREDITS.md) ----
const TRACKS = [ // original patterns synthesized live (Web Audio), CC0 — no samples, no copyrighted songs
  { id: "pulse", name: "Neon Pulse", bpm: 100, bass: [0, 0, 7, 5], root: 45, wave: "sawtooth", arp: [0, 7, 12, 7, 15, 12, 7, 3] },
  { id: "bounce", name: "Bubble Bounce", bpm: 112, bass: [0, 3, 5, 7], root: 48, wave: "square", arp: [0, 12, 7, 12, 3, 12, 5, 12] },
  { id: "groove", name: "Sunset Groove", bpm: 92, bass: [0, 5, 3, 10], root: 43, wave: "triangle", arp: [0, 3, 7, 10, 12, 10, 7, 3] },
  { id: "glow", name: "Glow Up", bpm: 120, bass: [0, 8, 3, 10], root: 41, wave: "sawtooth", arp: [12, 7, 3, 7, 15, 7, 10, 7] },
  // level rewards (new, original; the songs above stay open to everyone)
  { id: "candy", name: "Candy Pop", bpm: 116, bass: [0, 5, 7, 3], root: 50, wave: "square", arp: [0, 4, 7, 12, 7, 4, 9, 12], lvl: UNLOCK.candy },
  { id: "drive", name: "Midnight Drive", bpm: 104, bass: [0, 0, 3, 7], root: 40, wave: "sawtooth", arp: [0, 3, 7, 10, 7, 3, 12, 10], lvl: UNLOCK.drive },
  { id: "turbo", name: "Turbo Hype", bpm: 128, bass: [0, 7, 5, 3], root: 43, wave: "square", arp: [12, 7, 12, 15, 12, 7, 10, 7], lvl: UNLOCK.turbo },
];
const trackLocked = (t) => !!t.lvl && level() < t.lvl;
let runSpd = 1; const speedPref = () => { const v = +localStorage.getItem("dc.speed"); return SPEEDS.includes(v) ? v : 1; }; const BPM = () => track.bpm * runSpd;
let ac = null, master = null, sfxBus = null, musicBus = null, padBus = null, recDest = null, seqTimer = null, nextBeatT = 0, beatN = 0, track = TRACKS[0], noiseBuf = null;
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const lvl = (v, d) => Math.max(0, Math.min(100, v ?? d)) / 100;
const musicLevel = () => (S.music === false ? 0 : lvl(S.musicVol, 70));
const sfxLevel = () => (S.sounds === false ? 0 : lvl(S.sfxVol, 80) / 0.8);
function applyMusicVol() { if (musicBus) musicBus.gain.setTargetAtTime(musicLevel(), ac.currentTime, 0.05); if (sfxBus) sfxBus.gain.setTargetAtTime(sfxLevel(), ac.currentTime, 0.05); }
window.addEventListener("dc-settings", applyMusicVol); window.dcApplyMusicVol = applyMusicVol; window.dcAudioLevels = () => ({ music: musicBus ? +musicBus.gain.value.toFixed(3) : null, sfx: sfxBus ? +sfxBus.gain.value.toFixed(3) : null });
function audio() {
  if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.5;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.connect(comp).connect(ac.destination);
    recDest = ac.createMediaStreamDestination(); comp.connect(recDest);
    musicBus = ac.createGain(); musicBus.gain.value = musicLevel(); musicBus.connect(master); sfxBus = ac.createGain(); sfxBus.gain.value = sfxLevel(); sfxBus.connect(master); padBus = ac.createGain(); padBus.connect(musicBus);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return ac;
}
setAudio(() => (audio(), { ac, out: sfxBus }));
function blip(t, f, dur, type, vol, out = musicBus, cut = 0) { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dur); let n = o; if (cut) { const fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.setValueAtTime(cut, t); fl.Q.value = 6; o.connect(fl); n = fl; } n.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02); }
function kick(t, v = 0.9) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24); o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.26);
  padBus.gain.cancelScheduledValues(t); padBus.gain.setValueAtTime(0.25, t); padBus.gain.linearRampToValueAtTime(1, t + 0.22); } // sidechain pump
function noise(t, dur, type, freq, vol, out = musicBus) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + dur + 0.02); }
function longNoise(t, dur, type, f0, f1, vol) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); return [s, f, g]; }
function riser(t, dur) { const [s, f, g] = longNoise(t, dur, "bandpass", 400, 6000); f.Q.value = 3; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + dur * 0.95); g.gain.linearRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(musicBus); s.start(t); s.stop(t + dur + 0.02); }
function crash(t) { const [s, f, g] = longNoise(t, 1.4, "highpass", 6000, 3500); g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4); s.connect(f).connect(g).connect(musicBus); s.start(t); s.stop(t + 1.45); }
function snareRoll(t, spb, k) { const n = k < 0.5 ? 2 : 4; for (let i = 0; i < n; i++) noise(t + (i * spb) / n, 0.09, "bandpass", 1800 + k * 1200, 0.1 + k * 0.16); }
const hat = (t, vol) => noise(t, 0.05, "highpass", 7500, vol);
const clap = (t) => { for (const k of [0, 0.012, 0.024]) noise(t + k, 0.16, "bandpass", 1500, 0.32); };
function schedule() {
  const spb = 60 / BPM(), arp = track.arp || [0, 7, 12, 7];
  while (nextBeatT < ac.currentTime + 0.2) {
    const t = nextBeatT, b = beatN % 4;
    if (beatN < 4) { kick(t, 0.6); hat(t + spb / 2, 0.18); blip(t, hz(b === 3 ? 88 : 81), 0.12, "square", 0.12, master); if (b === 3) noise(t, spb, "highpass", 2000, 0.12); nextBeatT += spb; beatN++; continue; } // count-in cue
    const m = beatN - 4, bar = Math.floor(m / 4) % 4, sect = Math.floor(m / 32) % 2; // 8-bar sections: verse / drop
    const ps = m % 32, fill = ps >= 28; // last bar of each 8-bar section: drum fill + riser into the next section
    if (ps === 0 && m > 0) crash(t);
    if (fill) { snareRoll(t, spb, (ps - 28) / 4); if (ps === 28) riser(t, spb * 4); }
    if (ps !== 31) kick(t); hat(t + spb / 2, 0.22); if (sect) { hat(t + spb / 4, 0.1); hat(t + (3 * spb) / 4, 0.1); } if (b === 1 || b === 3) clap(t);
    const n = track.root + track.bass[bar], sweep = 500 + 2200 * ((m % 16) / 16);
    blip(t, hz(n), spb * 0.45, track.wave, 0.2, musicBus, sweep); blip(t + spb / 2, hz(n + 12), spb * 0.3, track.wave, 0.09, musicBus, sweep);
    if (b === 0) [0, 3, 7, 10].forEach((iv) => blip(t, hz(n + 24 + iv), spb * 3.6, "sawtooth", 0.022, padBus, 1800));
    if (sect) for (let k = 0; k < 2; k++) blip(t + (k * spb) / 2, hz(n + 36 + arp[(m * 2 + k) % arp.length]), spb * 0.35, "triangle", 0.06);
    nextBeatT += spb; beatN++;
  }
}
function hitSound(j) { if (!ac || S.sounds === false) return; const t = ac.currentTime + 0.01, base = track.root + 48;
  if (j === "Perfect") { blip(t, hz(base + 12), 0.25, "triangle", 0.12, sfxBus); blip(t + 0.06, hz(base + 19), 0.3, "triangle", 0.1, sfxBus); noise(t, 0.12, "highpass", 9000, 0.06, sfxBus); }
  else if (j === "Great") blip(t, hz(base + 12), 0.18, "triangle", 0.08, sfxBus); }
const MILES = [10, 25, 50, 100];
function milestoneSound() { if (!ac || S.sounds === false) return; const t = ac.currentTime + 0.01, base = track.root + 60; [0, 4, 7, 12].forEach((d, i) => blip(t + i * 0.07, hz(base + d), 0.22, "triangle", 0.09, sfxBus)); noise(t + 0.28, 0.2, "highpass", 8000, 0.05, sfxBus); }
const GRADE = (pct) => (pct >= 90 ? ["S", "#FFD23F"] : pct >= 80 ? ["A", "#B8FF00"] : pct >= 65 ? ["B", "#7fd3ff"] : pct >= 50 ? ["C", "#ffb86b"] : ["D", "#ff8a8a"]);
function musicStart() { audio(); ac.resume(); beatN = 0; nextBeatT = ac.currentTime + 0.1; clearInterval(seqTimer); seqTimer = setInterval(schedule, 50); schedule(); return nextBeatT; }
function musicStop() { clearInterval(seqTimer); seqTimer = null; }

// ---- daily challenge: date-seeded routine + track ----
const today = dayKey(); // device-local date: the daily routine changes at your local midnight
function rng(seed) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
function dailyTier() { let o = {}; try { o = JSON.parse(localStorage.getItem("dc.dtier") || "{}"); } catch {} if (o.d !== today) { o = { d: today, t: tierFor(level()) }; try { localStorage.setItem("dc.dtier", JSON.stringify(o)); } catch {} } return o.t; } // tier fixed for the day
function dailyRoutine() { const p = dailyPlan(today, dailyTier(), MOVES.length, 4); return { routine: p.routine, track: TRACKS[p.trackIdx], goal: p.goal, tier: p.tier }; } // generated from the date + your level, no server
const FULL = MOVES.map((_, i) => i);
let routine = FULL, mode = "free";
function coachAt(t, bpm) {
  const beat = Math.max(0, t) * (bpm / 60), slot = Math.floor(beat / 2), frac = (beat / 2) % 1;
  const ai = routine[slot % routine.length], bi = routine[(slot + 1) % routine.length], a = MOVES[ai].p, b = MOVES[bi].p;
  const k = frac < 0.75 ? 0 : (frac - 0.75) / 0.25;
  return { pose: a.map((v, i) => v + wrap(b[i] - v) * k), idx: ai, next: bi };
}

// ---- MediaPipe (loaded on demand from ./vendor, module script, no eval) ----
let mpP = null;
const loadMP = () => (mpP ??= import(`${CDN}/vision_bundle.mjs`).then(async (m) => ({ m, fs: await m.FilesetResolver.forVisionTasks(`${CDN}/wasm`) })).catch((e) => { mpP = null; throw e; }));
async function landmarker() {
  const { m, fs } = await loadMP();
  const o = (d) => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: "VIDEO", numPoses: 1 });
  const want = (new URLSearchParams(location.search).get("delegate") || localStorage.getItem("dc.delegate") || "GPU").toUpperCase();
  const timeIt = (l) => { if (!cam.videoWidth) return 0; const t = performance.now(); for (let i = 0; i < 8; i++) { try { l.detectForVideo(inSrc(), performance.now() + i); } catch {} } return (performance.now() - t) / 8; };
  let gpu = null, gms = Infinity;
  if (want !== "CPU") { try { gpu = await m.PoseLandmarker.createFromOptions(fs, o("GPU")); gms = timeIt(gpu); } catch { gpu = null; } }
  if (gpu && (want === "GPU!" || gms < 30)) { window.dcPerf.backend = `MediaPipe GPU (${gms.toFixed(0)} ms probe)`; return gpu; }
  const cpu = await m.PoseLandmarker.createFromOptions(fs, o("CPU")), cms = timeIt(cpu);
  if (gpu && gms <= cms) { cpu.close(); window.dcPerf.backend = `MediaPipe GPU (${gms.toFixed(0)} vs CPU ${cms.toFixed(0)} ms)`; return gpu; }
  gpu?.close(); window.dcPerf.backend = `MediaPipe CPU/wasm (${cms.toFixed(0)}${gpu ? " vs GPU " + gms.toFixed(0) : ""} ms)`; return cpu;
}

// ---- state ----
let stream = null, lm = null, refLM = null, playing = false, t0 = 0, sum = 0, n = 0, perfect = 0, smooth = null, lastDet = 0, lastPose = null;
let paused = false, pausedAt = 0;
let lastBuzz = 0, rec = null, chunks = [], refVideo = null, refCache = new Map();
const cam = $("#cam"), stage = $("#stage"), g = stage.getContext("2d"), coach = $("#coach"), cg = coach.getContext("2d");
const coachCol = () => { const l = getLook(); return l.silly ? l.top : coachColor(); };
const status = (s) => ($("#status").textContent = s);
function fillTracks() { const sel = $("#track"); sel.innerHTML = TRACKS.map((t) => `<option value="${t.id}"${trackLocked(t) ? " disabled" : ""}>${t.name} · ${t.bpm} BPM${trackLocked(t) ? " · 🔒 Level " + t.lvl : ""}</option>`).join(""); sel.value = track.id; }
addEventListener("dc-prog", () => { fillTracks(); });
// Seasonal tune + event challenge (Settings › Seasonal themes: Auto / a season / Off)
function syncSeason() {
  const i = TRACKS.findIndex((t) => t.id === "season"); if (i >= 0) TRACKS.splice(i, 1);
  const sid = activeSeason(); if (sid) TRACKS.push(Object.assign({}, THEMES[sid].tune, { id: "season", name: "🎵 " + THEMES[sid].tune.name, season: sid }));
  if (!TRACKS.includes(track)) track = TRACKS.find((t) => t.id === track.id) || TRACKS[0];
  if (!sid && mode === "event") { mode = "free"; routine = FULL; }
  fillTracks(); const b = document.getElementById("eventBtn"); if (b) { b.hidden = !sid; if (sid) b.textContent = seasonLabel(sid) + " event"; }
}
function eventPlan() { const sid = activeSeason(); if (!sid) return null; const p = dailyPlan(eventKey(sid), 1, MOVES.length, 4); return { sid, key: eventKey(sid), routine: p.routine, track: TRACKS.find((t) => t.id === "season"), goal: EVENT_GOAL }; }
document.getElementById("eventBtn")?.addEventListener("click", () => { if (playing) return; const e = eventPlan(); if (!e) return; routine = e.routine; track = e.track; $("#track").value = track.id; mode = "event"; status(`${seasonLabel(e.sid)} event loaded: ${e.routine.length - 1} moves, goal ${e.goal}%. Turn on camera, then Start.`); });
addEventListener("dc-settings", (e) => { if (e.detail === "season" && !playing) syncSeason(); });
syncSeason();
$("#track").onchange = (e) => (track = TRACKS.find((t) => t.id === e.target.value));
const best = () => JSON.parse(localStorage.getItem("dc.best") || "{}");
function weekCount() { const b = best(), d = new Date(); let c = 0; for (let i = 0; i < 7; i++) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i); if (b[dayKey(x)] != null) c++; } return c; }
function untilTomorrow() { const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const mins = Math.max(0, Math.round((m - n) / 6e4)); return `${Math.floor(mins / 60)}h ${mins % 60}m`; }
setInterval(() => { const e = document.getElementById("dcCount"); if (e) e.textContent = untilTomorrow(); }, 60000);
function showDaily() { const d = dailyRoutine(), b = best()[today], st = streak(), wk = weekCount(); $("#daily").innerHTML = `<b class="big">🏆 Routine of the Day</b><div>${d.track.name} · ${d.routine.length - 1} moves · 🎯 goal ${d.goal}% · 🔥 ${st}-day streak${b ? ` · best today <b>${b}%</b>` : ""}</div><div class="note" style="color:var(--mut)">${b ? "✅ Done for today! Come back tomorrow for a new routine" : st ? "Dance today to keep your streak alive" : "Start a streak today"} · new routine in <b id="dcCount">${untilTomorrow()}</b> · weekly goal ${Math.min(wk, 5)}/5 ${wk >= 5 ? "🎉" : ""}</div><div style="margin-top:6px">${d.routine.slice(1).map((i) => `<span class="chip">${MOVES[i].name}</span>`).join("")}</div>`; }
function streak() { return streakOf(new Set(Object.keys(best())), new Date()).streak; } // forgiving: one missed day is forgiven per 7 days; today not yet played doesn't break it
showDaily();
$("#dailyBtn").onclick = () => { const d = dailyRoutine(); routine = d.routine; track = d.track; $("#track").value = track.id; mode = "daily"; status("Daily challenge loaded. Turn on camera, then Start."); };
$("#freeBtn").onclick = () => { routine = FULL; mode = "free"; status("Free dance: full routine."); };

$("#camBtn").onclick = async () => {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; $("#camBtn").textContent = "📷 Turn on camera"; return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    cam.srcObject = stream; await cam.play(); $("#camBtn").textContent = "Camera off"; status("Loading pose tracker (on this device)… " + (seasonLine() || "Stretch those dancing feet!"));
    lm ??= await landmarker(); status("Ready! Pick a track and press Start.");
  } catch (e) { if (!stream && (!navigator.mediaDevices || /NotFound|Overconstrained|DevicesNotFound/.test(e?.name || ""))) { status("📷 No camera found on this device. Dance Coach needs a camera to score your moves — you can still press Start and dance along with Coach Disco Dan!"); return; } status(stream ? "Pose tracker couldn't load: " + e.message : (window.Capacitor?.isNativePlatform?.() ? "Camera blocked — allow it in Android Settings › Apps › Dance Coach › Permissions." : "Camera blocked — allow it in your browser's site settings.")); }
};
$("#fileIn").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return; refVideo = document.createElement("video"); refVideo.src = URL.createObjectURL(f); refVideo.muted = false; refVideo.playsInline = true; refCache.clear();
  status("Reference video loaded — moves are read from it on your device."); status("Reading your video… " + (seasonLine() || "")); try { refLM ??= await landmarker(); } catch { status("Pose tracker couldn't load."); }
};

function start() {
  paused = false; document.body.classList.remove("paused");
  sum = n = perfect = 0; smooth = null; combo = maxCombo = 0; limbSum.fill(0); limbCnt.fill(0); firstHit = false; judged = { Perfect: 0, Great: 0, Good: 0, Miss: 0 }; beatI = -1; beatS = beatN2 = 0; hit = null; playing = true; $("#result").hidden = true; runSpd = mode === "daily" || mode === "event" || refVideo ? 1 : speedPref(); ghostStart(runKey()); coachReset(); liveReset();
  if (refVideo) { refVideo.currentTime = 0; refVideo.play(); t0 = performance.now(); } else { const at = musicStart(); t0 = performance.now() + (at - ac.currentTime) * 1000 + (4 * 60000) / BPM(); /* 4-beat count-in */ }
  $("#startBtn").textContent = "■ Stop"; document.body.style.setProperty("--spb", (60 / BPM()).toFixed(3) + "s"); document.body.classList.add("dancing");
}
let lastResult = null, lastBoard = null;
let combo = 0, maxCombo = 0, judged = {}, beatI = -1, beatS = 0, beatN2 = 0, hit = null; // per-beat judgement + combo
const noFx = () => RM.matches || document.documentElement.classList.contains("reduce");
const runKey = () => refVideo ? "video" : mode === "daily" ? "daily-" + today : mode === "practice" ? "practice" : mode === "event" ? "event-" + (eventPlan()?.key || "") : "song-" + track.id + (runSpd !== 1 ? "@" + runSpd : "");
window.dcGhostOn = () => S.ghost !== false;
initTips(); initTV(moveFocus); document.documentElement.classList.toggle("big", !!S.big); document.getElementById("replayOb")?.addEventListener("click", () => { const ob = document.getElementById("onboard"); new MutationObserver((m, o) => { if (ob.hidden) { o.disconnect(); setTimeout(showTips, 400); } }).observe(ob, { attributes: true, attributeFilter: ["hidden"] }); });
function focusHTML() { const av = limbSum.map((v, k) => (limbCnt[k] > 10 ? v / limbCnt[k] : null)); let lo = -1, hi = -1; av.forEach((v, k) => { if (v == null) return; if (lo < 0 || v < av[lo]) lo = k; if (hi < 0 || v > av[hi]) hi = k; }); if (lo < 0) return ""; const pc = (v) => Math.round(v * 100);
  return `<div class="note" id="limbFocus" style="margin-top:8px">💪 Strongest: <b>${LIMB_NAMES[hi]}</b> (${pc(av[hi])}%)${lo !== hi && av[lo] < 0.7 ? ` · 🎯 Focus next time: <b>${LIMB_NAMES[lo]}</b> (${pc(av[lo])}%)` : " · every limb on point!"}</div>`; }
function toastMsg(t) { const e = document.getElementById("padToast"); if (!e) return; e.textContent = t; e.classList.add("show"); clearTimeout(toastMsg.t); toastMsg.t = setTimeout(() => e.classList.remove("show"), 2600); }
async function resultCard() {
  if (!lastResult) return null; const c = document.createElement("canvas"); c.width = 1080; c.height = 1350; const x = c.getContext("2d"), r = lastResult;
  const gr = x.createLinearGradient(0, 0, 1080, 1350); gr.addColorStop(0, "#3a1670"); gr.addColorStop(1, "#120a22"); x.fillStyle = gr; x.fillRect(0, 0, 1080, 1350);
  x.textAlign = "center"; x.fillStyle = "#B8FF00"; x.font = "900 84px system-ui"; x.fillText("💃 Dance Coach", 540, 170);
  x.fillStyle = "#FFD23F"; x.font = "800 46px system-ui"; x.fillText(`Level ${level()}${r.xp ? " · +" + r.xp + " XP" : ""}`, 540, 250); x.fillStyle = "#B8FF00";
  x.font = "120px system-ui"; x.fillText("⭐".repeat(r.stars) || "💪", 540, 420); { const [g1, c1] = GRADE(r.pct); x.fillStyle = c1; x.font = "900 72px system-ui"; x.fillText("Grade " + g1, 540, 510); }
  x.fillStyle = "#fff"; x.font = "900 200px system-ui"; x.fillText(r.pct + "%", 540, 680);
  x.font = "700 52px system-ui"; x.fillStyle = "#FFD23F"; x.fillText(`${r.perfect} perfect moments${r.combo ? " · best combo ×" + r.combo : ""}`, 540, 790);
  x.fillStyle = "#cfc6e6"; x.font = "500 44px system-ui"; x.fillText(r.daily ? "Routine of the Day" : r.song, 540, 870); x.fillText(new Date().toLocaleDateString(), 540, 940);
  try { const cv = document.getElementById("coach"); x.drawImage(cv, lastBoard ? 80 : 390, 980, 300, 300); } catch {}
  if (lastBoard) { x.textAlign = "left"; x.fillStyle = "#B8FF00"; x.font = "800 40px system-ui"; x.fillText("🏆 My top 5", 440, 1010); x.font = "600 32px system-ui"; lastBoard.top.forEach((b, i) => { x.fillStyle = b.at === lastBoard.at ? "#FFD23F" : "#fff"; x.fillText(`${i + 1}. ${b.pct}%  ${new Date(b.at).toLocaleDateString()}`, 440, 1058 + i * 44); }); x.textAlign = "center"; }
  x.fillStyle = "#fff"; x.font = "700 40px system-ui"; x.fillText("Can you beat me? dancecoach.pages.dev", 540, 1310);
  return new Promise((res) => c.toBlob(res, "image/png"));
}
async function share() {
  if (localStorage.getItem("dc.share") === "1") { const f = lastResult ? await resultCard().then((b) => b && new File([b], "dance-coach-result.png", { type: "image/png" })).catch(() => null) : null; if (await hubShare({ result: lastResult, file: f || undefined })) return; }
  const url = "https://dancecoach.pages.dev/?ref=share", text = lastResult ? `I scored ${lastResult.pct}% (grade ${GRADE(lastResult.pct)[0]}) on Dance Coach! Can you beat me?` : "Dance Coach: your camera scores your moves, on-device.";
  try { const b = lastResult && (await resultCard()); const f = b && new File([b], "dance-coach-result.png", { type: "image/png" });
    if (f && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text, url }); return; }
    if (navigator.share) { await navigator.share({ title: "Dance Coach", text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toastMsg("🔗 Link copied!"); } catch { toastMsg(url); }
}
window.dcShare = share; window.dcCardFor = (r) => { lastResult = r; return resultCard(); }; // also used by tests
// ---- Shared AI buddy (web only; TODO native: needs data-safety/privacy update before shipping in the APK) ----
const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const BUDDY_FACTS = 'Dance Coach facts. SCORING: camera tracks your pose on this device (never uploaded) and compares body angles to the coach; Perfect >80%, Great >65%, Good >50%. End of song: 3 stars at 80%+, 2 at 60%+, 1 at 35%+; grade S 90%+, A 80%+, B 65%+, C 50%+, else D. Combo milestones at 10, 25, 50 and 100 beats in a row. DIFFICULTY (Settings): Easy is more forgiving, Normal, Hard is stricter. ROUTINE OF THE DAY: a new 9-move routine every day; dancing it keeps your daily streak; weekly goal is 5 days. COINS (website only, just for fun, no real money): earned from daily streak, first dance of the day, finishing songs, 3 stars, daily/weekly challenge, level-ups, achievements; free chest every 4 hours; spend coins in the Settings shop on coach outfits and stage themes. CONTROLS: Touch: tap Start/Stop, Turn on camera, Record clip; long-press ? for the guide. Keyboard: Space start/pause, Esc back, arrows/Tab move, Enter select, hold H for the controls guide. Controller: A select, B back/pause, Start (Menu/Options/+) start or pause, Select (View/Share/-) settings, hold Select for the controls guide, LB/RB change song, D-pad moves. Steering wheels are ignored. TIPS: prop the phone up, step back so your whole body shows, good lighting.';
function buddyCtx() { try { const sc = playing ? (paused ? "paused" : "dancing") : !$("#settings").hidden ? "settings" : !$("#result").hidden ? "results" : "home";
  window.OppsBuddy?.setContext({ facts: BUDDY_FACTS, context: `Screen: ${sc}. Mode: ${mode}. Song: ${track.name}. Difficulty: ${localStorage.getItem("dc.diff") || "normal"}. Last score: ${lastResult ? lastResult.pct + "% " + lastResult.stars + " stars" : "none yet"}.` }); } catch {} }
// Burst guard: hub may answer 200 {source:'slow'} (or 429 slow_down). Show a friendly line instead of a blank/odd reply.
if (!isNative) { const of = window.fetch.bind(window); window.fetch = async (u, o) => { const r = await of(u, o); const url = String(u && u.url || u);
  if (!url.includes("/ai?site=dancecoach")) return r;
  try { const j = await r.clone().json(); if (j && (j.source === "slow" || j.error === "slow_down" || j.error === "ip_daily_cap" || j.error === "site_daily_cap" || r.status === 429)) {
    return new Response(JSON.stringify({ ...j, reply: j.reply && j.source !== "slow" ? j.reply : (j.reply || (/daily_cap/.test(j.error || "") ? "I've answered lots of questions today! Let's dance, and ask me again tomorrow. 💃" : "Whoa, lots of questions! Give me a few seconds to catch my breath, then ask again. 💃")) }), { status: 200, headers: { "Content-Type": "application/json" } }); } } catch {}
  return r; }; }
if (!isNative) addEventListener("load", () => setTimeout(() => {
  const sc = document.createElement("script"); sc.src = "https://oppsgo.com/ai-buddy.js?v=2"; sc.defer = true;
  Object.assign(sc.dataset, { site: "dancecoach", game: "dancecoach", mode: "kids", position: "bottom-left" });
  sc.onload = () => { buddyCtx(); setInterval(buddyCtx, 5000); }; document.head.append(sc);
}, 1500));
// ---- Smart coach: suggestions from your recent runs (shown, never applied silently) + practice routine ----
const OPEN_TRACKS = () => TRACKS.filter((t) => !trackLocked(t)).map((t) => t.id);
function smartBox() {
  const h = progState().hist || [], sug = mode === "daily" ? null : speedSuggestion(h, runSpd), weak = weakMoves(4), snooze = +localStorage.getItem("dc.smartSnooze") || 0, songs = progState().songs || 0;
  const parts = [];
  if (sug && songs >= snooze) parts.push(`<p>${sug.why === "up" ? `You've aced your last runs. Ready for a challenge? Try the song at <b>${sug.speed}×</b> speed.` : `Those moves are tricky. Practise at <b>${sug.speed}×</b> speed, then speed back up.`}</p><div class="row grow"><button class="b-sky" data-spd="${sug.speed}">${sug.why === "up" ? "⏩" : "⏪"} Use ${sug.speed}× speed</button><button class="b-soft" id="smartNo">Not now</button></div>`);
  if (weak.length >= 3 && mode !== "practice") parts.push(`<p>Your trickiest moves lately: ${weak.map((i) => `<span class="chip">${MOVES[i].name}</span>`).join("")}</p><button class="b-gold" id="smartPractice">🎯 Load practice routine</button>`);
  if (!parts.length) return;
  $("#result").insertAdjacentHTML("beforeend", `<section class="tipsBox" id="smartBox" aria-label="Smart coach"><h3>💡 Smart coach</h3>${parts.join("")}</section>`);
  const box = $("#smartBox");
  box.onclick = (e) => { const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.spd) { localStorage.setItem("dc.speed", b.dataset.spd); const ss = document.getElementById("speedSel"); if (ss) ss.value = b.dataset.spd; b.textContent = `✓ Speed set to ${b.dataset.spd}× (change it in Settings)`; b.disabled = true; }
    if (b.id === "smartNo") { localStorage.setItem("dc.smartSnooze", String(songs + 3)); b.textContent = "OK, I'll ask again later"; b.disabled = true; }
    if (b.id === "smartPractice") { loadPractice(); b.textContent = "✓ Practice routine loaded. Press Start"; b.disabled = true; } };
}
function loadPractice() {
  const weak = weakMoves(4); if (weak.length < 3) return false;
  routine = practicePlan(weak, MOVES.length, today); mode = "practice";
  const fav = favouriteSong(progState().hist, OPEN_TRACKS()); if (fav) { track = TRACKS.find((t) => t.id === fav) || track; $("#track").value = track.id; }
  status(`🎯 Practice routine: your trickiest moves plus two more, to ${track.name}. Turn on the camera, then Start.`); return true;
}
function syncPractice() { const b = document.getElementById("practiceBtn"); if (b) b.hidden = weakMoves(4).length < 3; }
document.getElementById("practiceBtn")?.addEventListener("click", () => { if (!playing) loadPractice(); });
addEventListener("dc-prog", syncPractice); syncPractice();
window.dcSmart = { dailyRoutine: () => dailyRoutine(), speed: () => runSpd };

function stop() {
  const wasPlaying = playing;
  if (paused) { paused = false; document.body.classList.remove("paused"); ac?.resume(); window.speechSynthesis?.resume(); status("Stopped."); }
  playing = false; musicStop(); refVideo?.pause(); $("#startBtn").textContent = "▶ Start"; document.body.classList.remove("dancing");
  if (n > 20) { const pct = Math.round((sum / n) * 100), stars = pct >= 80 ? 3 : pct >= 60 ? 2 : pct >= 35 ? 1 : 0;
    $("#result").hidden = false; const [gr, gc] = GRADE(pct); $("#result").innerHTML = `<div style="font-size:40px"><span class="grade" role="img" aria-label="Grade ${gr}" style="display:inline-block;min-width:1.4em;margin-inline-end:8px;padding:0 6px;border:3px solid ${gc};border-radius:12px;color:${gc};font-weight:900;line-height:1.2">${gr}</span>${"⭐".repeat(stars) || "💪"}</div><b style="font-size:28px">${pct}% match</b>${(() => { const nx = [[50, "C"], [65, "B"], [80, "A"], [90, "S"]].find(([v]) => pct < v); return nx ? `<div class="note" id="nextGrade">⬆️ ${nx[0] - pct}% more for grade ${nx[1]}</div>` : `<div class="note" id="nextGrade">👑 Top grade!</div>`; })()}<div>${perfect} perfect moments${mode === "daily" ? " · daily challenge" : ""}</div><div class="judge" aria-label="Beat results"><span class="j-p">★ Perfect ${judged.Perfect || 0}</span><span class="j-g">◆ Great ${judged.Great || 0}</span><span class="j-o">● Good ${judged.Good || 0}</span><span class="j-m">✕ Miss ${judged.Miss || 0}</span><span class="j-c">Best combo ×${maxCombo}</span></div>${seasonLine() ? `<div class="note" style="margin-top:6px">🎙️ ${seasonLine()}</div>` : ""}<div class="row grow" style="margin-top:10px"><button id="cardBtn" class="b-sky">🖼 Save result card</button><button id="shareBtn" class="b-gold">📣 Share</button></div>${focusHTML()}<button id="challengeBtn" class="b-pink cta-pulse" style="width:100%;margin-top:10px;font-size:20px;font-weight:900">🔥 Challenge a friend: beat my ${gr} · ${pct}%</button><button id="againBtn" class="b-gold" style="width:100%;margin-top:8px;font-size:18px;font-weight:900">🔁 Dance again</button>`;
    lastBoard = finishRun(runKey(), pct); { const cr = coachReport(pct, localStorage.getItem("dc.diff") || "normal"); $("#result").insertAdjacentHTML("beforeend", coachHTML(cr)); const sb = document.getElementById("diffSug"); if (sb) sb.onclick = () => { localStorage.setItem("dc.diff", sb.dataset.d); const ds = document.getElementById("diffSel"); if (ds) ds.value = sb.dataset.d; sb.textContent = "✓ Difficulty set to " + sb.dataset.d; sb.disabled = true; }; }
    { const prev = lastBoard.top.find((r) => r.at !== lastBoard.at); if (prev) { const pb = lastBoard.rank === 1 && pct > prev.pct; $("#result").insertAdjacentHTML("afterbegin", pb ? `<div id="pbBanner" class="pb-hit" role="status" style="font-size:22px;font-weight:900;color:#FFD23F;margin-bottom:6px">🎉 New personal best! +${pct - prev.pct}% over your old ${prev.pct}%</div>` : `<div id="pbBanner" role="status" class="note" style="font-weight:800;margin-bottom:6px">🎯 ${pct >= prev.pct ? "You tied your best" : `${prev.pct - pct}% away from your best (${prev.pct}%)`}. One more go?</div>`); if (pb) { milestoneSound(); haptic("medium"); if (!noFx()) burst(stage.width / 2, stage.height * 0.4); } } }
    $("#result").insertAdjacentHTML("beforeend", boardHTML(lastBoard, mode === "daily" ? "Routine of the Day" : track.name));
    lastResult = { combo: maxCombo, pct, stars, perfect, daily: mode === "daily", song: track.name };
    $("#cardBtn").onclick = () => resultCard().then((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "dance-coach-result.png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
    $("#shareBtn").onclick = () => share(); $("#challengeBtn").onclick = () => share(); $("#againBtn").onclick = () => { if (playing) return; start(); try { stage.scrollIntoView({ block: "center", behavior: noFx() ? "auto" : "smooth" }); } catch {} };
    coins.onSongEnd({ stars, daily: mode === "daily", perfect, streak: streak() });
    if (mode === "daily") { const b = best(); b[today] = Math.max(b[today] || 0, pct); localStorage.setItem("dc.best", JSON.stringify(b)); showDaily(); }
    flushMoves(); const ev = mode === "event" ? eventPlan() : null, evMet = !!ev && pct >= ev.goal; if (ev) $("#result").insertAdjacentHTML("beforeend", `<div class="note">${seasonLabel(ev.sid)} event goal ${ev.goal}%: ${evMet ? "reached! 🎉" : "not yet. Try again any time this season"}</div>`);
    const goalMet = mode === "daily" && pct >= dailyRoutine().goal; if (mode === "daily") $("#result").insertAdjacentHTML("beforeend", `<div class="note">🎯 Daily goal ${dailyRoutine().goal}%: ${goalMet ? "reached! +25 XP" : "not yet. Try again any time today"}</div>`);
    try { const xo = onRun({ pct, stars, perfect, combo: maxCombo, daily: mode === "daily", trackId: refVideo ? "" : track.id, streak: streak(), goalMet, speed: runSpd, eventKey: ev ? ev.key : "", eventMet: evMet }); lastResult.xp = xo.xp; window.dcProgressResult?.(xo, $("#result")); } catch {} if (!refVideo) smartBox(); }
  else if (wasPlaying) status(stream ? "Not enough moves seen to score — step back so your whole body shows, then try again." : "Turn on the camera to get a score.");
  if (rec && rec.state === "recording") rec.stop();
}
$("#startBtn").onclick = () => (playing ? stop() : start());
$("#recBtn").onclick = () => {
  if (rec && rec.state === "recording") { rec.stop(); return; }
  audio(); const vs = stage.captureStream(30), tracks = [...vs.getVideoTracks(), ...recDest.stream.getAudioTracks()];
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"]; const type = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!type) { status("Clip recording isn't supported in this browser."); return; }
  chunks = []; rec = new MediaRecorder(new MediaStream(tracks), { mimeType: type, videoBitsPerSecond: 4e6 });
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => { const blob = new Blob(chunks, { type }), a = $("#dl"); clearTimeout(window.__recCap); window.dispatchEvent(new CustomEvent("dc-clip", { detail: { blob, type, duration: (performance.now() - (window.__recT0 || 0)) / 1000 } })); a.href = URL.createObjectURL(blob); a.download = `dance-coach-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`; a.hidden = false; a.textContent = `⬇ Download clip (${(blob.size / 1e6).toFixed(1)} MB)`; $("#recBtn").textContent = "⏺ Record clip"; status("Clip ready — download it and post to TikTok."); };
  rec.start(500); window.__recT0 = performance.now(); if (localStorage.getItem("dc.share") === "1") window.__recCap = setTimeout(() => { if (rec && rec.state === "recording") rec.stop(); }, 29500); $("#recBtn").textContent = "⏹ Stop recording"; if (!playing) start();
};

function setPaused(on) {
  if (!playing || on === paused) return; paused = on; document.body.classList.toggle("paused", on);
  if (on) { pausedAt = performance.now(); refVideo?.pause(); ac?.suspend(); window.speechSynthesis?.pause(); status("⏸ Paused — press Start/▶ to resume."); $("#startBtn").textContent = "▶ Resume"; }
  else { t0 += performance.now() - pausedAt; if (refVideo) refVideo.play(); ac?.resume(); window.speechSynthesis?.resume(); status("Dancing!"); $("#startBtn").textContent = "■ Stop"; }
}
window.dcPause = setPaused;
const CBM = () => document.documentElement.classList.contains("cb");
const JCOL = (j) => (CBM() ? { Perfect: "#F0E442", Great: "#56B4E9", Good: "#E69F00", Miss: "#D55E00" } : { Perfect: "#FFD23F", Great: "#B8FF00", Good: "#7fd3ff", Miss: "#ff8a8a" })[j];
const JSHAPE = { Perfect: "★", Great: "◆", Good: "●", Miss: "✕" }; // shapes always shown so colour is never the only cue
const WORD = (s) => (s > 0.8 ? [JSHAPE.Perfect + " Perfect!", JCOL("Perfect")] : s > 0.65 ? [JSHAPE.Great + " Great!", JCOL("Great")] : s > 0.5 ? [JSHAPE.Good + " Good", JCOL("Good")] : ["Keep going!", "#fff"]);
const INRES = +(new URLSearchParams(location.search).get("inres") ?? 256) || 0; // measured: 256 px input is ~10-15% faster than full camera frames
let inC = null, inG = null;
function inSrc() { if (!INRES || !cam.videoWidth) return cam; const sc = INRES / Math.max(cam.videoWidth, cam.videoHeight); if (sc >= 1) return cam; inC ??= document.createElement("canvas"); const w = Math.round(cam.videoWidth * sc), h = Math.round(cam.videoHeight * sc); if (inC.width !== w) { inC.width = w; inC.height = h; inG = inC.getContext("2d"); } inG.drawImage(cam, 0, 0, w, h); return inC; }
const RM = matchMedia("(prefers-reduced-motion: reduce)");
let quality = localStorage.getItem("dc.quality") || "auto", fpsE = 60, detE = 0, lastF = 0, parts = [];
if (new URLSearchParams(location.search).get("bench") === "1") addEventListener("load", () => { const o = document.createElement("div"); o.id = "benchHud"; o.style.cssText = "position:fixed;top:calc(8px + var(--st));inset-inline-start:calc(8px + var(--sl));z-index:90;background:rgba(0,0,0,.8);color:#B8FF00;font:12px/1.3 monospace;padding:6px 8px;border-radius:8px;pointer-events:auto"; document.body.append(o);
  setInterval(() => { const p = window.dcPerf; o.innerHTML = `backend: ${p.backend || "(start camera)"}<br>inference: ${p.det.toFixed(1)} ms · score: ${(p.score || 0).toFixed(3)} ms<br>FPS: ${p.fps.toFixed(0)} · quality: ${p.q}<br><a href="bench.html" style="color:#fff">▶ full comparison</a>`; }, 500); });
window.dcPerf = { get fps() { return fpsE; }, get c3() { return want3d() && coach3dReady(); }, get det() { return detE; }, get q() { return quality; }, frames: 0 };
window.dcSetQuality = (q) => { quality = q; localStorage.setItem("dc.quality", q); };
const detGap = () => quality === "low" ? Math.max(110, detE * 4) : quality === "high" ? Math.max(45, detE * 1.5) : (fpsE < 40 || detE > 35 ? Math.max(110, detE * 3) : 66); // keep the UI responsive on slow devices
const glowOK = () => quality === "high" || (quality !== "low" && !(quality === "auto" && fpsE < 40)); // Auto: skip glow passes on slow phones
const partN = () => RM.matches || document.documentElement.classList.contains("reduce") || document.documentElement.classList.contains("noparticles") ? 0 : quality === "low" ? 0 : quality === "high" ? 26 : (fpsE < 40 ? 6 : 14);
const limbM = new Array(8).fill(null), limbSum = new Array(8).fill(0), limbCnt = new Array(8).fill(0);
let firstHit = false;
const LIMB_NAMES = ["left upper arm", "left forearm", "right upper arm", "right forearm", "left thigh", "left lower leg", "right thigh", "right lower leg"];
function burst(x, y) { for (let i = 0, k = partN(); i < k; i++) { const a = Math.random() * 6.283, v = 2 + Math.random() * 5; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 1, c: ["#B8FF00", "#FFD23F", "#ff4fd8", "#7fd3ff"][i % 4] }); } }
function drawParts(g) { if (!parts.length) return; for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= 0.03; g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.fillRect(p.x, p.y, 8, 8); } g.globalAlpha = 1; parts = parts.filter((p) => p.life > 0); }
let lastIdle = 0, moveTxt = "";
const SONG_BEATS = 96; const songLen = (bpm) => (SONG_BEATS * 60) / bpm; // every song has an ending (~48-62 s) so runs have a clear goal
let victoryUntil = 0;
const want3d = () => S.coach3d !== false && quality !== "low" && !((navigator.deviceMemory || 8) < 3) && !((navigator.hardwareConcurrency || 8) <= 2);
const maybe3d = () => { if (want3d()) coach3dLoad(); };
addEventListener("load", () => setTimeout(() => (window.requestIdleCallback || setTimeout)(maybe3d), 2500));
addEventListener("dc-settings", (e) => { if (e.detail === "stage") lastIdle = 0; if (e.detail === "coach3d" || e.detail === "look") { maybe3d(); applyLook(); } });
function frameIssue(L) { if (!L) return "Can't see you. Step into view"; const v = (i) => (L[i]?.visibility ?? 1), y = (i) => L[i]?.y ?? 0;
  const sw = Math.abs((L[11]?.x ?? 0) - (L[12]?.x ?? 0)), cx = ((L[11]?.x ?? 0.5) + (L[12]?.x ?? 0.5) + (L[23]?.x ?? 0.5) + (L[24]?.x ?? 0.5)) / 4;
  if (v(0) < 0.4 || y(0) < 0.01) return "Step back so your head shows";
  if (sw > 0.42) return "Too close. Step back a little";
  if (Math.min(v(27), v(28)) < 0.4 || Math.max(y(27), y(28)) > 0.99) return "Step back so your feet show";
  if (cx < 0.2 || cx > 0.8) return "Move to the middle of the screen";
  return null; }
let frameBad = null, frameBadAt = 0, frameOkAt = 0; window.dcFrame = () => frameBad; window.dcFrameIssue = frameIssue;
function frame(now) {
  requestAnimationFrame(frame);
  if (!playing && !stream && !refVideo && !parts.length && now > victoryUntil) { if (now - lastIdle < 120) return; lastIdle = now; } // idle: ~8 fps, saves battery + main thread
  window.dcPerf.frames++; if (lastF) fpsE = fpsE * 0.95 + (1000 / Math.max(1, now - lastF)) * 0.05; lastF = now;
  const t = playing ? (refVideo ? refVideo.currentTime : ((paused ? pausedAt : now) - t0) / 1000) : 0, bpm = BPM();
  if (playing && !paused && !refVideo && t >= songLen(bpm)) { stop(); return; }
  if (playing && !paused && refVideo && refVideo.ended) { stop(); return; }
  const c = coachAt(t, bpm); let ref = c.pose, refV;
  if (refVideo && refLM && refVideo.readyState >= 2) { const k = Math.round(refVideo.currentTime * 10); let r = refCache.get(k); if (!r) { try { r = poseAngles(refLM.detectForVideo(refVideo, now + 0.5).landmarks?.[0]); } catch {} if (r) refCache.set(k, r); } if (r) { ref = r.a; refV = r.v; } }
  const still = RM.matches || document.documentElement.classList.contains("reduce"), vic = !playing && now < victoryUntil;
  if (vic) { const w = still ? 0 : Math.sin(now / 160); ref = [165 + w * 15, 200 + w * 30, -165 + w * 15, -200 + w * 30, 12, 0, -12, 0]; }
  const bt = playing ? t * (bpm / 60) : now / 600, stStill = still || document.documentElement.classList.contains("calm") || quality === "low" || (quality === "auto" && playing && fpsE < 40), stFx = !document.documentElement.classList.contains("noparticles");
  const c3 = want3d() && coach3dReady() ? coach3dRender(ref, playing ? t * (bpm / 60) : now / 600, playing && !paused ? fpsE : 60, vic ? "victory" : "dance", still) : null;
  drawStage(cg, 300, 300, bt, { still: stStill, fx: stFx }); if (c3) cg.drawImage(c3, 0, 0, 300, 300); else drawCoach(cg, 300, 300, ref, coachCol(), true);
  { const mt = refVideo ? "Following your video" : `${MOVES[c.idx].name} — ${MOVES[c.idx].tip} · next: ${MOVES[c.next].name}`; if (mt !== moveTxt) { moveTxt = mt; $("#move").textContent = mt; } }
  const W = stage.width, H = stage.height;
  g.save(); g.translate(W, 0); g.scale(-1, 1);
  if (stream && cam.readyState >= 2) g.drawImage(cam, 0, 0, W, H); else drawStage(g, W, H, bt, { still: stStill, fx: stFx });
  if (stream && cam.readyState >= 2 && !stStill) drawStage(g, W, H, bt, { overlay: true });
  if (lm && stream && cam.readyState >= 2 && now - lastDet > detGap()) { lastDet = now; const t1 = performance.now(); try { lastPose = lm.detectForVideo(inSrc(), now).landmarks?.[0] || null; } catch {} if (lastPose && window.dcPose) window.dcPose(lastPose, now); detE = detE * 0.8 + (performance.now() - t1) * 0.2; }
  if (playing && !paused && stream && !refVideo) { const iss = frameIssue(lastPose); if (iss) { frameOkAt = 0; frameBadAt ||= now; if (now - frameBadAt > 900) frameBad = iss; } else { frameBadAt = 0; frameOkAt ||= now; if (now - frameOkAt > 400) frameBad = null; } } else { frameBad = null; frameBadAt = frameOkAt = 0; }
  if (playing) ghostDraw(g, t, W, H);
  if (playing && !paused && lastPose && stream) ghostRecord(t, lastPose);
  if (lastPose && stream) { const glow = !noFx() && glowOK() && !document.documentElement.classList.contains("noparticles"); g.lineCap = "round"; g.lineJoin = "round";
    const live = playing && !paused && !refVideo && t >= 0, ua = live ? poseAngles(lastPose) : null, cb = document.documentElement.classList.contains("cb");
    if (ua) for (let k = 0; k < 8; k++) { const m = ua.v[k] < 0.4 ? null : Math.max(0, 1 - Math.abs(wrap(ua.a[k] - ref[k])) / 75); limbM[k] = m == null ? limbM[k] : limbM[k] == null ? m : limbM[k] * 0.75 + m * 0.25; if (m != null) { limbSum[k] += m; limbCnt[k]++; } } else limbM.fill(null);
    const P = i => [lastPose[i].x * W, lastPose[i].y * H], path = list => { g.beginPath(); for (const [i, j] of list) { const p = P(i), q = P(j); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); } };
    const ALL = [...SEGS, [11, 12], [23, 24], [11, 23], [12, 24]]; path(ALL);
    if (glow) { g.strokeStyle = "rgba(255,79,216,.28)"; g.lineWidth = 18; g.stroke(); g.strokeStyle = "rgba(127,211,255,.35)"; g.lineWidth = 10; g.stroke(); } g.strokeStyle = glow ? "#ffd6f5" : "#ff4fd8"; g.lineWidth = glow ? 4 : 6; g.stroke();
    if (ua) { const col = m => m >= 0.7 ? (cb ? "#4FC3FF" : "#B8FF00") : m >= 0.45 ? (cb ? "#FFFFFF" : "#FFD23F") : (cb ? "#FF9F1C" : "#FF4D6D"); const lw = Math.max(6, Math.min(W, H) * 0.014);
      for (let k = 0; k < 8; k++) { const m = limbM[k]; if (m == null) continue; path([SEGS[k]]); g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = lw + 4; g.stroke(); g.strokeStyle = col(m); g.lineWidth = lw; g.stroke(); }
      g.fillStyle = "#fff"; for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) { const p = P(i); g.beginPath(); g.arc(p[0], p[1], lw * 0.45, 0, 6.283); g.fill(); } }
  }
  g.restore();
  g.save(); g.translate(W - 170, 10); drawStage(g, 160, 160, bt, { still: true }); if (c3) g.drawImage(c3, 0, 0, 160, 160); else drawCoach(g, 160, 160, ref, coachCol(), true); g.restore();
  if (playing && !paused && !refVideo && t < 0) { const left = Math.ceil((-t * bpm) / 60); const ph = noFx() ? 0 : ((-t * bpm) / 60) % 1; g.save(); g.textAlign = "center"; g.font = `900 ${Math.round(Math.min(W, H) * (0.28 + ph * 0.08))}px system-ui`; g.fillStyle = left <= 1 ? "#B8FF00" : "#FFD23F"; g.shadowColor = "#000"; g.shadowBlur = 16; g.fillText(left > 3 ? "Ready?" : String(left), W / 2, H / 2 + Math.min(W, H) * 0.1); g.font = "800 28px system-ui"; g.fillStyle = "#fff"; if (stream && !frameBad && lastPose) { g.fillStyle = "#B8FF00"; g.fillText("✓ You're in the frame!", W / 2, H / 2 + Math.min(W, H) * 0.26); } else g.fillText(stream ? (frameBad || "Get in the frame!") : "Get in the frame!", W / 2, H / 2 + Math.min(W, H) * 0.26); g.restore(); }
  if (playing && !paused && frameBad && t >= 0) { g.save(); g.font = `800 ${Math.max(16, Math.round(Math.min(W, H) * 0.04))}px system-ui`; g.textAlign = "center"; const tx = "📷 " + frameBad, tw = g.measureText(tx).width + 28, bh = Math.max(34, Math.round(Math.min(W, H) * 0.07)), by = H * 0.58; g.fillStyle = "rgba(0,0,0,.72)"; g.beginPath(); g.roundRect ? g.roundRect(W / 2 - tw / 2, by - bh / 2, tw, bh, bh / 2) : g.rect(W / 2 - tw / 2, by - bh / 2, tw, bh); g.fill(); g.strokeStyle = "#FFD23F"; g.lineWidth = 2; g.stroke(); g.fillStyle = "#FFD23F"; g.textBaseline = "middle"; g.fillText(tx, W / 2, by + 1); g.restore(); }
  if (playing && !paused && lastPose && stream && (refVideo || t >= 0)) {
    const tS = performance.now(), u = poseAngles(lastPose), s0 = u && similarity(u, ref, refV); window.dcPerf.score = (window.dcPerf.score || 0) * 0.9 + (performance.now() - tS) * 0.1; const _x = 0, dif = localStorage.getItem("dc.diff") || "normal", s = s0 == null ? s0 : Math.min(1, s0 * (dif === "easy" ? 1.12 : dif === "hard" ? 0.92 : 1));
    if (u && !refVideo) { const lag = 30 / bpm; coachAdd(u, ref, refV, t, songLen(bpm), coachAt(t - lag, bpm).pose, coachAt(t + lag, bpm).pose); if (S.liveTips !== false) { const cue = coachLive(u, ref, now); if (cue) status("💡 " + cue); } if (s0 != null && t >= 0) noteMove(c.idx, s0); }
    if (s != null && !refVideo) { const bI = Math.floor((t * bpm) / 60); if (bI !== beatI) { if (beatI >= 0 && beatN2) { const av = beatS / beatN2, j = av > 0.8 ? "Perfect" : av > 0.65 ? "Great" : av > 0.5 ? "Good" : "Miss"; judged[j]++; const warm = j === "Miss" && beatI < 4; combo = j === "Miss" ? (warm ? combo : 0) : combo + 1; maxCombo = Math.max(maxCombo, combo); const mile = j !== "Miss" && MILES.includes(combo); let fix = null; if (j === "Miss") { let lo = 1; limbM.forEach((m, k) => { if (m != null && m < 0.45 && m < lo) { lo = m; fix = LIMB_NAMES[k]; } }); } hit = { j, at: now, combo, mile, warm, fix, first: j !== "Miss" && !firstHit }; if (hit.first) { firstHit = true; if (!mile && !noFx()) burst(stage.width / 2, stage.height * 0.3); } if (mile) { milestoneSound(); haptic("medium"); rumble(0.5, 120); if (!noFx()) burst(stage.width / 2, stage.height * 0.3); } else hitSound(j); } beatI = bI; beatS = beatN2 = 0; } beatS += s; beatN2++; }
    if (s != null) { smooth = smooth == null ? s : smooth * 0.8 + s * 0.2; sum += s; n++; if (s > 0.8) { perfect++; if (now - lastBuzz > 1500) { lastBuzz = now; haptic("light"); rumble(0.3, 80); burst(stage.width / 2, stage.height * 0.35); } } }
  }
  drawParts(g);
  if (playing && !paused && !refVideo && t >= 0 && !noFx() && !document.documentElement.classList.contains("calm")) { const bt = (t * bpm) / 60, ph = bt % 1, a = (1 - ph) * (1 - ph) * 0.8; if (a > 0.03) { g.save(); g.globalAlpha = a; g.lineWidth = 10; g.strokeStyle = ["#ff4fd8", "#7fd3ff", "#B8FF00", "#FFD23F"][Math.floor(bt) % 4]; g.strokeRect(5, 5, W - 10, H - 10); g.restore(); } }
  if (playing && !paused && !refVideo && combo >= 10 && t >= 0) { g.save(); const still = noFx(); g.lineWidth = still ? 6 : 6 + 3 * Math.abs(Math.sin(now / 180)); g.strokeStyle = "#FFD23F"; if (!still && quality !== "low" && !(quality === "auto" && fpsE < 40)) { g.shadowColor = "#FFD23F"; g.shadowBlur = 18; } g.strokeRect(3, 3, W - 6, H - 6); g.shadowBlur = 0; g.font = "900 20px system-ui"; g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillStyle = "#FFD23F"; g.fillText(`🔥 On fire ×${combo}`, 16, 82); g.restore(); }
  if (playing && !paused && hit && now - hit.at < 700) { const k = (now - hit.at) / 700, col = JCOL(hit.j); g.save(); g.textAlign = "center"; g.globalAlpha = 1 - k * k; const sc = noFx() ? 1 : 1 + 0.25 * Math.max(0, 1 - k * 4); g.translate(W / 2, 92); g.scale(sc, sc); g.font = "900 38px system-ui"; g.fillStyle = col; g.shadowColor = "#000"; g.shadowBlur = 8; g.fillText(JSHAPE[hit.j] + " " + (hit.j === "Miss" ? "Miss" : hit.j + "!"), 0, 0); if (hit.mile) { g.font = "900 30px system-ui"; g.fillStyle = "#FFD23F"; g.fillText(`🔥 ${hit.combo} combo!`, 0, 36); } else if (hit.j === "Miss" && hit.fix && !hit.warm) { g.font = "800 22px system-ui"; g.fillStyle = "#fff"; g.fillText(`Fix your ${hit.fix}`, 0, 32); } else if (hit.first) { g.font = "900 26px system-ui"; g.fillStyle = "#B8FF00"; g.fillText("🎉 Nice start! Keep it going", 0, 34); } else if (hit.warm) { g.font = "800 22px system-ui"; g.fillStyle = "#fff"; g.fillText("Warm-up: combo kept", 0, 32); } else if (hit.combo >= 3) { g.font = "800 24px system-ui"; g.fillStyle = "#fff"; g.fillText(`${hit.combo} combo`, 0, 32); } g.restore(); }
  if (playing && paused) { g.font = "900 56px system-ui"; g.textAlign = "center"; g.fillStyle = "#fff"; g.fillText("⏸ Paused", W / 2, H / 2); }
  if (playing) { const [w, col] = WORD(smooth ?? 0); g.font = "900 40px system-ui"; g.textAlign = "center"; g.fillStyle = col; g.shadowColor = "#000"; g.shadowBlur = 8; g.fillText(stream ? w : "Turn on camera to score", W / 2, H - 70); g.shadowBlur = 0;
    if (!refVideo && t > 0) { const pr = Math.min(1, t / songLen(bpm)), gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, "#ff4fd8"); gr.addColorStop(1, "#7fd3ff"); g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, 0, W, 6); g.fillStyle = gr; g.fillRect(0, 0, W * pr, 6); const left = Math.max(0, Math.ceil(songLen(bpm) - t)); g.font = "700 18px system-ui"; g.textAlign = "right"; g.fillStyle = "#fff"; g.fillText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`, W - 180, 32); g.textAlign = "center"; }
    g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(20, H - 40, W - 40, 16); g.fillStyle = col; g.fillRect(20, H - 40, (W - 40) * (smooth ?? 0), 16);
    g.font = "700 20px system-ui"; g.textAlign = "left"; g.fillStyle = "#fff"; { const sp = n > 0 ? Math.round((sum / n) * 100) : 0; g.fillText(`Dance Coach · ${sp}%${n > 0 && stream && !refVideo ? " · " + GRADE(sp)[0] : ""}`, 16, 32); } g.font = "600 16px system-ui"; g.fillStyle = "rgba(255,255,255,.7)"; g.fillText("dancecoach.pages.dev", 16, 56); }
}
requestAnimationFrame(frame);
if ("serviceWorker" in navigator && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register("/sw.js").catch(() => {});

// ---- PC fixes: no key scrolling + scroll lock while the coach view is active ----
const SCROLL_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
const coachActive = () => playing; // lock only while dancing so the clip download + footer stay reachable
const inField = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
window.addEventListener("keydown", (e) => { // keyboard shortcuts when nothing is focused: Space = start/stop, P = pause
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || inField(e.target) || /^(BUTTON|A|SUMMARY)$/.test(e.target?.tagName || "") || document.querySelector(".sheet:not([hidden])")) return;
  if (e.code === "Space") { e.preventDefault(); if (!playing) $("#startBtn")?.click(); else setPaused(!paused); } else if (e.code === "KeyP" && playing) setPaused(!paused); }, true);
window.addEventListener("keydown", (e) => { if (coachActive() && SCROLL_KEYS.has(e.code) && !inField(e.target)) e.preventDefault(); }, { passive: false });
let locked = false;
function syncLock() {
  const on = coachActive(); if (on === locked) return; locked = on;
  for (const el of [document.documentElement, document.body]) { el.style.overflow = on ? "hidden" : ""; el.style.overscrollBehavior = on ? "none" : ""; }
  if (on) window.scrollTo({ top: Math.max(0, $("#startBtn").getBoundingClientRect().top + scrollY - 8) });
}
setInterval(syncLock, 200);

// ---- Gamepad: full controller support lives in gamepad.js ----
initPads({
  isPlaying: () => playing, isPaused: () => paused,
  start: () => { if (!playing) start(); else if (paused) setPaused(false); else setPaused(true); },
  song: (d) => { if (playing) return; let i = TRACKS.indexOf(track); for (let k = 0; k < TRACKS.length; k++) { i = (i + d + TRACKS.length) % TRACKS.length; if (!trackLocked(TRACKS[i])) break; } track = TRACKS[i]; $("#track").value = track.id; status(`Song: ${track.name}`); },
  stop: () => playing && stop(),
});

// ---- Coach host: "Coach Disco Dan" — local, kid-safe lines ----
const HOST = "Coach Disco Dan";
const LINES = {
  start: [
    "Hi, I'm Coach Disco Dan! Let's make the floor jealous!",
    "Warm up those wiggles, superstar!",
    "Why did the dancer bring a ladder? To reach the high notes!",
    "Shoes on, smile on — let's groove!",
    "I asked my dog to dance. He said he has two left paws!",
    "Ready? Your moves called. They want to come out and play!",
    "Let's dance like nobody's watching… except me. I'm cheering!",
    "What's a skeleton's favorite dance? Anything with a little backbone!",
  ],
  streak: [
    "Whoa! Are you a toaster? Because you're on fire!",
    "That move was so smooth, butter called for tips!",
    "Perfect streak! The disco ball is blushing!",
    "You're grooving harder than a cereal box on a trampoline!",
    "Nailed it! Even my mustache is dancing!",
    "Keep it up — the beat wants your autograph!",
    "Why don't dancers get lost? They always follow the steps!",
    "Superstar alert! Somebody call the dance police — no wait, don't, you're amazing!",
    "That was cooler than a penguin in sunglasses!",
  ],
  miss: [
    "Oops! That's a brand-new move. I'll call it the Wobble Waffle!",
    "No worries — even pancakes need a flip or two!",
    "Shake it off like a wet puppy and try again!",
    "Missed one? The beat forgives you. It's very nice.",
    "Why did the banana dance badly? It kept slipping! You're doing better than a banana!",
    "Keep going — every star starts as a twinkle!",
    "Wiggle first, worry never!",
    "Mistakes are just bonus dance moves!",
  ],
  end: [
    "Song's over! Take a bow — you earned it!",
    "What did the music say to you? You rock!",
    "Great dancing! Grab some water — dancers get thirsty, and so do fish!",
    "That was fantastic! My dad jokes can't keep up with you!",
    "High five! Okay, air high five. I'm a cartoon.",
    "Why did the cookie go to the dance party? It wanted to be a smart cookie — like you!",
    "You danced, you laughed, you won! See you tomorrow for the daily challenge!",
  ],
};
let lastSay = 0, lastIdx = {};
const bubble = document.createElement("div");
bubble.id = "host"; bubble.setAttribute("role", "status"); bubble.setAttribute("aria-live", "polite");
bubble.innerHTML = `<b>🕺 ${HOST}</b><span></span>`;
document.body.appendChild(bubble);
const css = document.createElement("style");
css.textContent = `#host{position:fixed;left:calc(16px + var(--sl));right:calc(16px + var(--sr));bottom:calc(20px + var(--sb));max-width:520px;margin:auto;background:#fff;color:#1b1030;border-radius:20px;padding:12px 16px;font-size:17px;box-shadow:0 6px 20px rgba(0,0,0,.4);display:grid;gap:4px;z-index:20;opacity:0;transform:translateY(20px);transition:opacity .3s,transform .3s;pointer-events:none}
#host.show{opacity:1;transform:none}@media (prefers-reduced-motion: reduce){#host{transition:none;transform:none}}html.reduce #host{transition:none;transform:none}`;
document.head.appendChild(css);
let hideT = 0;
function showLine(text) {
  bubble.querySelector("span").textContent = text; bubble.classList.add("show"); clearTimeout(hideT); hideT = setTimeout(() => bubble.classList.remove("show"), 4500);
  if (S.voice && "speechSynthesis" in window && S.voiceVol !== 0) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; u.pitch = 1.1; u.volume = Math.max(0, Math.min(1, (S.voiceVol ?? 100) / 100)); speechSynthesis.speak(u); }
}
function say(kind, force, pct) {
  const nowT = performance.now(); if (S.banter === false && S.smack === false) { bubble.classList.remove("show"); return; } if (!force && nowT - lastSay < 8000) return; lastSay = nowT;
  const b = banterFor(kind, pct, S); // new clean jokes + playful trash talk, each with its own toggle
  if (b && b.from === "smack") return showLine(b.text);
  if (S.banter === false) return; // jokes muted and no trash talk line for this moment
  if (b && Math.random() < 0.5) return showLine(b.text);
  const sl = kind !== "miss" && Math.random() < 0.5 ? seasonLine() : null; if (sl) return showLine(sl);
  const L = LINES[kind] || LINES.end; let i; do { i = Math.floor(Math.random() * L.length); } while (L.length > 1 && i === lastIdx[kind]); lastIdx[kind] = i; showLine(L[i]);
}
window.addEventListener("dc-settings", (e) => { if (e.detail === "voice" && S.voice) say("start", true); });
// hook moments
let wasPlaying = false, goodRun = 0, badRun = 0;
setInterval(() => {
  if (paused) return;
  if (playing && !wasPlaying) { try { window.OppsBuddy?.close(); } catch {} goodRun = badRun = 0; say("start", true); sfx("start", 0.6); haptic("medium"); }
  if (!playing && wasPlaying && n > 20) { victoryUntil = performance.now() + 6000; say("end", true, n ? Math.round((sum / n) * 100) : 0); sfx("cheer", 0.7); setTimeout(() => sfx("end", 0.6), 300); haptic("success"); }
  wasPlaying = playing;
  if (playing && stream && smooth != null) {
    if (smooth > 0.7) { goodRun++; badRun = 0; if (goodRun === 6) { if (!(rec && rec.state === "recording")) toastMsg("🔥 Clip-worthy streak! Tap ⏺ Record clip next time."); say("streak"); sfx("perfect", 0.6); haptic("medium"); if (!RM.matches && quality !== "low") stage.animate([{ transform: "translate(0,0)" }, { transform: "translate(-5px,2px)" }, { transform: "translate(4px,-2px)" }, { transform: "translate(0,0)" }], { duration: 260 }); } }
    else if (smooth < 0.4) { badRun++; goodRun = 0; if (badRun === 6) say("miss"); }
    else { goodRun = Math.max(0, goodRun - 1); badRun = Math.max(0, badRun - 1); }
  }
}, 500);

// Auto-pause when the app goes to the background (saves battery, keeps the score fair)
document.addEventListener("visibilitychange", () => { if (document.hidden && playing && !paused) setPaused(true); });
