// Dance Coach — on-device pose scoring (MediaPipe). Camera frames never leave the device.
import { sfx, haptic, S, setAudio } from "./ui.js";
import { initPads, rumble } from "./gamepad.js";
import { initI18n } from "./i18n.js";
import { coins } from "./coins.js";
import { seasonLine } from "./seasons.js";
import { initShop, coachColor } from "./shop.js";
import { initControls, showControls } from "./controls.js";
initI18n();
coins.onOpen();
initControls(); window.dcShowControls = showControls; initShop();
{ const ds = document.getElementById("diffSel"); if (ds) { ds.value = localStorage.getItem("dc.diff") || "normal"; ds.onchange = () => localStorage.setItem("dc.diff", ds.value); } }
{ const qs = document.getElementById("qualSel"); if (qs) { qs.value = localStorage.getItem("dc.quality") || "auto"; qs.onchange = () => window.dcSetQuality(qs.value); } }
for (const e of document.querySelectorAll(".ver")) e.textContent = window.DC_VERSION || "";
import { MOVES, poseAngles, similarity, drawCoach, wrap, SEGS } from "./moves.js";
const TV = "0.10.14";
const CDN = new URL("./vendor", location.href).href.replace(/\/$/, ""); // bundled locally (works offline + in the Android app)
const MODEL = new URL("./vendor/pose_landmarker_lite.task", location.href).href;
const $ = (s) => document.querySelector(s);

// ---- original synthesized tracks (made in-browser with Web Audio; CC0, see CREDITS.md) ----
const TRACKS = [
  { id: "pulse", name: "Neon Pulse", bpm: 100, bass: [0, 0, 7, 5], root: 45, wave: "sawtooth" },
  { id: "bounce", name: "Bubble Bounce", bpm: 112, bass: [0, 3, 5, 7], root: 48, wave: "square" },
  { id: "groove", name: "Sunset Groove", bpm: 92, bass: [0, 5, 3, 10], root: 43, wave: "triangle" },
];
let ac = null, master = null, recDest = null, seqTimer = null, nextBeatT = 0, beatN = 0, track = TRACKS[0];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function audio() {
  if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); recDest = ac.createMediaStreamDestination(); master.connect(recDest); }
  return ac;
}
setAudio(() => (audio(), { ac, out: master }));
function blip(t, f, dur, type, vol) { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02); }
function kick(t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g).connect(master); o.start(t); o.stop(t + 0.22); }
function hat(t, vol) { const b = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; f.type = "highpass"; f.frequency.value = 7000; g.gain.value = vol; s.connect(f).connect(g).connect(master); s.start(t); }
function schedule() {
  const spb = 60 / track.bpm;
  while (nextBeatT < ac.currentTime + 0.2) {
    const t = nextBeatT, bar = Math.floor(beatN / 4) % 4, b = beatN % 4;
    kick(t); hat(t + spb / 2, 0.25); if (b % 2) hat(t, 0.15);
    const n = track.root + track.bass[bar]; blip(t, hz(n), spb * 0.45, track.wave, 0.18); blip(t + spb / 2, hz(n + 12), spb * 0.3, track.wave, 0.08);
    if (b === 0) [0, 4, 7].forEach((iv) => blip(t, hz(n + 24 + iv), spb * 1.8, "sine", 0.05));
    nextBeatT += spb; beatN++;
  }
}
function musicStart() { audio(); ac.resume(); beatN = 0; nextBeatT = ac.currentTime + 0.1; clearInterval(seqTimer); seqTimer = setInterval(schedule, 50); schedule(); return nextBeatT; }
function musicStop() { clearInterval(seqTimer); seqTimer = null; }

// ---- daily challenge: date-seeded routine + track ----
const today = new Date().toISOString().slice(0, 10);
function rng(seed) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
function dailyRoutine() { const r = rng(today); const order = MOVES.map((_, i) => i).slice(1).sort(() => r() - 0.5).slice(0, 8); return { routine: [0, ...order], track: TRACKS[Math.floor(r() * TRACKS.length)] }; }
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
  try { return await m.PoseLandmarker.createFromOptions(fs, o("GPU")); } catch { return await m.PoseLandmarker.createFromOptions(fs, o("CPU")); }
}

// ---- state ----
let stream = null, lm = null, refLM = null, playing = false, t0 = 0, sum = 0, n = 0, perfect = 0, smooth = null, lastDet = 0, lastPose = null;
let paused = false, pausedAt = 0;
let lastBuzz = 0, rec = null, chunks = [], refVideo = null, refCache = new Map();
const cam = $("#cam"), stage = $("#stage"), g = stage.getContext("2d"), coach = $("#coach"), cg = coach.getContext("2d");
const status = (s) => ($("#status").textContent = s);
function fillTracks() { const sel = $("#track"); sel.innerHTML = TRACKS.map((t) => `<option value="${t.id}">${t.name} · ${t.bpm} BPM</option>`).join(""); sel.value = track.id; }
fillTracks();
$("#track").onchange = (e) => (track = TRACKS.find((t) => t.id === e.target.value));
const best = () => JSON.parse(localStorage.getItem("dc.best") || "{}");
function weekCount() { const b = best(), d = new Date(); let c = 0; for (let i = 0; i < 7; i++) { const k = new Date(d - i * 864e5).toISOString().slice(0, 10); if (b[k] != null) c++; } return c; }
function untilTomorrow() { const n = new Date(), m = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1)); const mins = Math.max(0, Math.round((m - n) / 6e4)); return `${Math.floor(mins / 60)}h ${mins % 60}m`; }
setInterval(() => { const e = document.getElementById("dcCount"); if (e) e.textContent = untilTomorrow(); }, 60000);
function showDaily() { const d = dailyRoutine(), b = best()[today], st = streak(), wk = weekCount(); $("#daily").innerHTML = `<b class="big">🏆 Routine of the Day</b><div>${d.track.name} · ${d.routine.length} moves · 🔥 ${st}-day streak${b ? ` · best today <b>${b}%</b>` : ""}</div><div class="note" style="color:var(--mut)">${b ? "✅ Done for today! Come back tomorrow for a new routine" : st ? "Dance today to keep your streak alive" : "Start a streak today"} · new routine in <b id="dcCount">${untilTomorrow()}</b> · weekly goal ${Math.min(wk, 5)}/5 ${wk >= 5 ? "🎉" : ""}</div><div style="margin-top:6px">${d.routine.slice(1).map((i) => `<span class="chip">${MOVES[i].name}</span>`).join("")}</div>`; }
function streak() { const b = best(); let s = 0, d = new Date(); for (;;) { const k = d.toISOString().slice(0, 10); if (b[k] == null) break; s++; d.setUTCDate(d.getUTCDate() - 1); } return s; }
showDaily();
$("#dailyBtn").onclick = () => { const d = dailyRoutine(); routine = d.routine; track = d.track; $("#track").value = track.id; mode = "daily"; status("Daily challenge loaded. Turn on camera, then Start."); };
$("#freeBtn").onclick = () => { routine = FULL; mode = "free"; status("Free dance: full routine."); };

$("#camBtn").onclick = async () => {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; $("#camBtn").textContent = "📷 Turn on camera"; return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    cam.srcObject = stream; await cam.play(); $("#camBtn").textContent = "Camera off"; status("Loading pose tracker (on this device)… " + (seasonLine() || "Stretch those dancing feet!"));
    lm ??= await landmarker(); status("Ready! Pick a track and press Start.");
  } catch (e) { status(stream ? "Pose tracker couldn't load: " + e.message : (window.Capacitor?.isNativePlatform?.() ? "Camera blocked — allow it in Android Settings › Apps › Dance Coach › Permissions." : "Camera blocked — allow it in your browser's site settings.")); }
};
$("#fileIn").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return; refVideo = document.createElement("video"); refVideo.src = URL.createObjectURL(f); refVideo.muted = false; refVideo.playsInline = true; refCache.clear();
  status("Reference video loaded — moves are read from it on your device."); status("Reading your video… " + (seasonLine() || "")); try { refLM ??= await landmarker(); } catch { status("Pose tracker couldn't load."); }
};

function start() {
  paused = false; document.body.classList.remove("paused");
  sum = n = perfect = 0; smooth = null; playing = true; $("#result").hidden = true;
  if (refVideo) { refVideo.currentTime = 0; refVideo.play(); t0 = performance.now(); } else { const at = musicStart(); t0 = performance.now() + (at - ac.currentTime) * 1000; }
  $("#startBtn").textContent = "■ Stop"; document.body.classList.add("dancing");
}
let lastResult = null;
function toastMsg(t) { const e = document.getElementById("padToast"); if (!e) return; e.textContent = t; e.classList.add("show"); clearTimeout(toastMsg.t); toastMsg.t = setTimeout(() => e.classList.remove("show"), 2600); }
async function resultCard() {
  if (!lastResult) return null; const c = document.createElement("canvas"); c.width = 1080; c.height = 1350; const x = c.getContext("2d"), r = lastResult;
  const gr = x.createLinearGradient(0, 0, 1080, 1350); gr.addColorStop(0, "#3a1670"); gr.addColorStop(1, "#120a22"); x.fillStyle = gr; x.fillRect(0, 0, 1080, 1350);
  x.textAlign = "center"; x.fillStyle = "#B8FF00"; x.font = "900 84px system-ui"; x.fillText("💃 Dance Coach", 540, 170);
  x.font = "120px system-ui"; x.fillText("⭐".repeat(r.stars) || "💪", 540, 420);
  x.fillStyle = "#fff"; x.font = "900 200px system-ui"; x.fillText(r.pct + "%", 540, 680);
  x.font = "700 52px system-ui"; x.fillStyle = "#FFD23F"; x.fillText(`${r.perfect} perfect moments`, 540, 790);
  x.fillStyle = "#cfc6e6"; x.font = "500 44px system-ui"; x.fillText(r.daily ? "Routine of the Day" : r.song, 540, 870); x.fillText(new Date().toLocaleDateString(), 540, 940);
  try { const cv = document.getElementById("coach"); x.drawImage(cv, 390, 980, 300, 300); } catch {}
  x.fillStyle = "#fff"; x.font = "700 40px system-ui"; x.fillText("Can you beat me? dancecoach.pages.dev", 540, 1310);
  return new Promise((res) => c.toBlob(res, "image/png"));
}
async function share() {
  const url = "https://dancecoach.pages.dev/?ref=share", text = lastResult ? `I scored ${lastResult.pct}% on Dance Coach! Can you beat me?` : "Dance Coach: your camera scores your moves, on-device.";
  try { const b = lastResult && (await resultCard()); const f = b && new File([b], "dance-coach-result.png", { type: "image/png" });
    if (f && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text, url }); return; }
    if (navigator.share) { await navigator.share({ title: "Dance Coach", text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toastMsg("🔗 Link copied!"); } catch { toastMsg(url); }
}
window.dcShare = share; window.dcCardFor = (r) => { lastResult = r; return resultCard(); }; // also used by tests
function stop() {
  if (paused) { paused = false; document.body.classList.remove("paused"); ac?.resume(); window.speechSynthesis?.resume(); status("Stopped."); }
  playing = false; musicStop(); refVideo?.pause(); $("#startBtn").textContent = "▶ Start"; document.body.classList.remove("dancing");
  if (n > 20) { const pct = Math.round((sum / n) * 100), stars = pct >= 80 ? 3 : pct >= 60 ? 2 : pct >= 35 ? 1 : 0;
    $("#result").hidden = false; $("#result").innerHTML = `<div style="font-size:40px">${"⭐".repeat(stars) || "💪"}</div><b style="font-size:28px">${pct}% match</b><div>${perfect} perfect moments${mode === "daily" ? " · daily challenge" : ""}</div>${seasonLine() ? `<div class="note" style="margin-top:6px">🎙️ ${seasonLine()}</div>` : ""}<div class="row grow" style="margin-top:10px"><button id="cardBtn" class="b-sky">🖼 Save result card</button><button id="shareBtn" class="b-gold">📣 Share</button></div>`;
    lastResult = { pct, stars, perfect, daily: mode === "daily", song: track.name };
    $("#cardBtn").onclick = () => resultCard().then((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "dance-coach-result.png"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
    $("#shareBtn").onclick = () => share();
    coins.onSongEnd({ stars, daily: mode === "daily", perfect, streak: streak() });
    if (mode === "daily") { const b = best(); b[today] = Math.max(b[today] || 0, pct); localStorage.setItem("dc.best", JSON.stringify(b)); showDaily(); } }
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
  rec.onstop = () => { const blob = new Blob(chunks, { type }), a = $("#dl"); a.href = URL.createObjectURL(blob); a.download = `dance-coach-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`; a.hidden = false; a.textContent = `⬇ Download clip (${(blob.size / 1e6).toFixed(1)} MB)`; $("#recBtn").textContent = "⏺ Record clip"; status("Clip ready — download it and post to TikTok."); };
  rec.start(500); $("#recBtn").textContent = "⏹ Stop recording"; if (!playing) start();
};

function setPaused(on) {
  if (!playing || on === paused) return; paused = on; document.body.classList.toggle("paused", on);
  if (on) { pausedAt = performance.now(); refVideo?.pause(); ac?.suspend(); window.speechSynthesis?.pause(); status("⏸ Paused — press Start/▶ to resume."); $("#startBtn").textContent = "▶ Resume"; }
  else { t0 += performance.now() - pausedAt; if (refVideo) refVideo.play(); ac?.resume(); window.speechSynthesis?.resume(); status("Dancing!"); $("#startBtn").textContent = "■ Stop"; }
}
window.dcPause = setPaused;
const WORD = (s) => (s > 0.8 ? ["Perfect!", "#FFD23F"] : s > 0.65 ? ["Great!", "#B8FF00"] : s > 0.5 ? ["Good", "#7fd3ff"] : ["Keep going!", "#fff"]);
const RM = matchMedia("(prefers-reduced-motion: reduce)");
let quality = localStorage.getItem("dc.quality") || "auto", fpsE = 60, detE = 0, lastF = 0, parts = [];
window.dcPerf = { get fps() { return fpsE; }, get det() { return detE; }, get q() { return quality; }, frames: 0 };
window.dcSetQuality = (q) => { quality = q; localStorage.setItem("dc.quality", q); };
const detGap = () => quality === "low" ? Math.max(110, detE * 4) : quality === "high" ? Math.max(45, detE * 1.5) : (fpsE < 40 || detE > 35 ? Math.max(110, detE * 3) : 66); // keep the UI responsive on slow devices
const partN = () => RM.matches ? 0 : quality === "low" ? 0 : quality === "high" ? 26 : (fpsE < 40 ? 6 : 14);
function burst(x, y) { for (let i = 0, k = partN(); i < k; i++) { const a = Math.random() * 6.283, v = 2 + Math.random() * 5; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 1, c: ["#B8FF00", "#FFD23F", "#ff4fd8", "#7fd3ff"][i % 4] }); } }
function drawParts(g) { if (!parts.length) return; for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= 0.03; g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.fillRect(p.x, p.y, 8, 8); } g.globalAlpha = 1; parts = parts.filter((p) => p.life > 0); }
let lastIdle = 0, moveTxt = "";
function frame(now) {
  requestAnimationFrame(frame);
  if (!playing && !stream && !refVideo && !parts.length) { if (now - lastIdle < 120) return; lastIdle = now; } // idle: ~8 fps, saves battery + main thread
  window.dcPerf.frames++; if (lastF) fpsE = fpsE * 0.95 + (1000 / Math.max(1, now - lastF)) * 0.05; lastF = now;
  const t = playing ? (refVideo ? refVideo.currentTime : ((paused ? pausedAt : now) - t0) / 1000) : 0, bpm = track.bpm;
  const c = coachAt(t, bpm); let ref = c.pose, refV;
  if (refVideo && refLM && refVideo.readyState >= 2) { const k = Math.round(refVideo.currentTime * 10); let r = refCache.get(k); if (!r) { try { r = poseAngles(refLM.detectForVideo(refVideo, now + 0.5).landmarks?.[0]); } catch {} if (r) refCache.set(k, r); } if (r) { ref = r.a; refV = r.v; } }
  cg.fillStyle = "#1b1030"; cg.fillRect(0, 0, 300, 300); drawCoach(cg, 300, 300, ref, coachColor(), true);
  { const mt = refVideo ? "Following your video" : `${MOVES[c.idx].name} — ${MOVES[c.idx].tip} · next: ${MOVES[c.next].name}`; if (mt !== moveTxt) { moveTxt = mt; $("#move").textContent = mt; } }
  const W = stage.width, H = stage.height;
  g.save(); g.translate(W, 0); g.scale(-1, 1);
  if (stream && cam.readyState >= 2) g.drawImage(cam, 0, 0, W, H); else { g.fillStyle = "#120a22"; g.fillRect(0, 0, W, H); }
  if (lm && stream && cam.readyState >= 2 && now - lastDet > detGap()) { lastDet = now; const t1 = performance.now(); try { lastPose = lm.detectForVideo(cam, now).landmarks?.[0] || null; } catch {} detE = detE * 0.8 + (performance.now() - t1) * 0.2; }
  if (lastPose && stream) { g.strokeStyle = "#ff4fd8"; g.lineWidth = 6; g.lineCap = "round"; for (const [i, j] of [...SEGS, [11, 12], [23, 24], [11, 23], [12, 24]]) { const p = lastPose[i], q = lastPose[j]; g.beginPath(); g.moveTo(p.x * W, p.y * H); g.lineTo(q.x * W, q.y * H); g.stroke(); } }
  g.restore();
  g.save(); g.translate(W - 170, 10); g.fillStyle = "#1b1030"; g.fillRect(0, 0, 160, 160); drawCoach(g, 160, 160, ref, coachColor(), true); g.restore();
  if (playing && !paused && lastPose && stream) {
    const u = poseAngles(lastPose), s0 = u && similarity(u, ref, refV), dif = localStorage.getItem("dc.diff") || "normal", s = s0 == null ? s0 : Math.min(1, s0 * (dif === "easy" ? 1.12 : dif === "hard" ? 0.92 : 1));
    if (s != null) { smooth = smooth == null ? s : smooth * 0.8 + s * 0.2; sum += s; n++; if (s > 0.8) { perfect++; if (now - lastBuzz > 1500) { lastBuzz = now; haptic("light"); rumble(0.3, 80); burst(stage.width / 2, stage.height * 0.35); } } }
  }
  drawParts(g);
  if (playing && paused) { g.font = "900 56px system-ui"; g.textAlign = "center"; g.fillStyle = "#fff"; g.fillText("⏸ Paused", W / 2, H / 2); }
  if (playing) { const [w, col] = WORD(smooth ?? 0); g.font = "900 40px system-ui"; g.textAlign = "center"; g.fillStyle = col; g.shadowColor = "#000"; g.shadowBlur = 8; g.fillText(stream ? w : "Turn on camera to score", W / 2, H - 70); g.shadowBlur = 0;
    g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(20, H - 40, W - 40, 16); g.fillStyle = col; g.fillRect(20, H - 40, (W - 40) * (smooth ?? 0), 16);
    g.font = "700 20px system-ui"; g.textAlign = "left"; g.fillStyle = "#fff"; g.fillText(`Dance Coach · ${n > 0 ? Math.round((sum / n) * 100) : 0}%`, 16, 32); g.font = "600 16px system-ui"; g.fillStyle = "rgba(255,255,255,.7)"; g.fillText("dancecoach.pages.dev", 16, 56); }
}
requestAnimationFrame(frame);
if ("serviceWorker" in navigator && !window.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register("/sw.js").catch(() => {});

// ---- PC fixes: no key scrolling + scroll lock while the coach view is active ----
const SCROLL_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
const coachActive = () => playing; // lock only while dancing so the clip download + footer stay reachable
const inField = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
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
  song: (d) => { if (playing) return; const i = (TRACKS.indexOf(track) + d + TRACKS.length) % TRACKS.length; track = TRACKS[i]; $("#track").value = track.id; status(`Song: ${track.name}`); },
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
function say(kind, force) {
  const nowT = performance.now(); if (!force && nowT - lastSay < 8000) return; lastSay = nowT;
  const sl = kind !== "miss" && Math.random() < 0.5 ? seasonLine() : null;
  if (sl) { bubble.querySelector("span").textContent = sl; bubble.classList.add("show"); clearTimeout(hideT); hideT = setTimeout(() => bubble.classList.remove("show"), 4500); if (S.voice && "speechSynthesis" in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(sl); u.rate = 1.05; u.pitch = 1.1; speechSynthesis.speak(u); } return; }
  const L = LINES[kind]; let i; do { i = Math.floor(Math.random() * L.length); } while (L.length > 1 && i === lastIdx[kind]); lastIdx[kind] = i;
  bubble.querySelector("span").textContent = L[i]; bubble.classList.add("show"); clearTimeout(hideT); hideT = setTimeout(() => bubble.classList.remove("show"), 4500);
  if (S.voice && "speechSynthesis" in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(L[i]); u.rate = 1.05; u.pitch = 1.1; speechSynthesis.speak(u); }
}
window.addEventListener("dc-settings", (e) => { if (e.detail === "voice" && S.voice) say("start", true); });
// hook moments
let wasPlaying = false, goodRun = 0, badRun = 0;
setInterval(() => {
  if (paused) return;
  if (playing && !wasPlaying) { goodRun = badRun = 0; say("start", true); sfx("start", 0.6); haptic("medium"); }
  if (!playing && wasPlaying && n > 20) { say("end", true); sfx("cheer", 0.7); setTimeout(() => sfx("end", 0.6), 300); haptic("success"); }
  wasPlaying = playing;
  if (playing && stream && smooth != null) {
    if (smooth > 0.7) { goodRun++; badRun = 0; if (goodRun === 6) { if (!(rec && rec.state === "recording")) toastMsg("🔥 Clip-worthy streak! Tap ⏺ Record clip next time."); say("streak"); sfx("perfect", 0.6); haptic("medium"); if (!RM.matches && quality !== "low") stage.animate([{ transform: "translate(0,0)" }, { transform: "translate(-5px,2px)" }, { transform: "translate(4px,-2px)" }, { transform: "translate(0,0)" }], { duration: 260 }); } }
    else if (smooth < 0.4) { badRun++; goodRun = 0; if (badRun === 6) say("miss"); }
    else { goodRun = Math.max(0, goodRun - 1); badRun = Math.max(0, badRun - 1); }
  }
}, 500);
