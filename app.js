// Dance Coach — on-device pose scoring (MediaPipe). Camera frames never leave the device.
import { MOVES, poseAngles, similarity, drawCoach, wrap, SEGS } from "./moves.js";
const TV = "0.10.14";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TV}`;
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
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

// ---- MediaPipe (loaded on demand from jsDelivr, module script, no eval) ----
let mpP = null;
const loadMP = () => (mpP ??= import(`${CDN}/vision_bundle.mjs`).then(async (m) => ({ m, fs: await m.FilesetResolver.forVisionTasks(`${CDN}/wasm`) })).catch((e) => { mpP = null; throw e; }));
async function landmarker() {
  const { m, fs } = await loadMP();
  const o = (d) => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: "VIDEO", numPoses: 1 });
  try { return await m.PoseLandmarker.createFromOptions(fs, o("GPU")); } catch { return await m.PoseLandmarker.createFromOptions(fs, o("CPU")); }
}

// ---- state ----
let stream = null, lm = null, refLM = null, playing = false, t0 = 0, sum = 0, n = 0, perfect = 0, smooth = null, lastDet = 0, lastPose = null;
let rec = null, chunks = [], refVideo = null, refCache = new Map();
const cam = $("#cam"), stage = $("#stage"), g = stage.getContext("2d"), coach = $("#coach"), cg = coach.getContext("2d");
const status = (s) => ($("#status").textContent = s);
function fillTracks() { const sel = $("#track"); sel.innerHTML = TRACKS.map((t) => `<option value="${t.id}">${t.name} · ${t.bpm} BPM</option>`).join(""); sel.value = track.id; }
fillTracks();
$("#track").onchange = (e) => (track = TRACKS.find((t) => t.id === e.target.value));
const best = () => JSON.parse(localStorage.getItem("dc.best") || "{}");
function showDaily() { const d = dailyRoutine(), b = best()[today]; $("#daily").innerHTML = `<b>Daily challenge ${today}</b> · ${d.track.name} · ${d.routine.length} moves: ${d.routine.slice(1).map((i) => MOVES[i].name).join(", ")}${b ? ` · your best today: <b>${b}%</b>` : ""} · streak: <b>${streak()}</b>🔥`; }
function streak() { const b = best(); let s = 0, d = new Date(); for (;;) { const k = d.toISOString().slice(0, 10); if (b[k] == null) break; s++; d.setUTCDate(d.getUTCDate() - 1); } return s; }
showDaily();
$("#dailyBtn").onclick = () => { const d = dailyRoutine(); routine = d.routine; track = d.track; $("#track").value = track.id; mode = "daily"; status("Daily challenge loaded. Turn on camera, then Start."); };
$("#freeBtn").onclick = () => { routine = FULL; mode = "free"; status("Free dance: full routine."); };

$("#camBtn").onclick = async () => {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; $("#camBtn").textContent = "📷 Turn on camera"; return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    cam.srcObject = stream; await cam.play(); $("#camBtn").textContent = "Camera off"; status("Loading pose tracker (on this device)…");
    lm ??= await landmarker(); status("Ready! Pick a track and press Start.");
  } catch (e) { status(stream ? "Pose tracker couldn't load: " + e.message : "Camera blocked — allow it in browser settings."); }
};
$("#fileIn").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return; refVideo = document.createElement("video"); refVideo.src = URL.createObjectURL(f); refVideo.muted = false; refVideo.playsInline = true; refCache.clear();
  status("Reference video loaded — moves are read from it on your device."); try { refLM ??= await landmarker(); } catch { status("Pose tracker couldn't load."); }
};

function start() {
  sum = n = perfect = 0; smooth = null; playing = true; $("#result").hidden = true;
  if (refVideo) { refVideo.currentTime = 0; refVideo.play(); t0 = performance.now(); } else { const at = musicStart(); t0 = performance.now() + (at - ac.currentTime) * 1000; }
  $("#startBtn").textContent = "■ Stop";
}
function stop() {
  playing = false; musicStop(); refVideo?.pause(); $("#startBtn").textContent = "▶ Start";
  if (n > 20) { const pct = Math.round((sum / n) * 100), stars = pct >= 80 ? 3 : pct >= 60 ? 2 : pct >= 35 ? 1 : 0;
    $("#result").hidden = false; $("#result").innerHTML = `<div style="font-size:40px">${"⭐".repeat(stars) || "💪"}</div><b style="font-size:28px">${pct}% match</b><div>${perfect} perfect moments${mode === "daily" ? " · daily challenge" : ""}</div>`;
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

const WORD = (s) => (s > 0.8 ? ["Perfect!", "#FFD23F"] : s > 0.65 ? ["Great!", "#B8FF00"] : s > 0.5 ? ["Good", "#7fd3ff"] : ["Keep going!", "#fff"]);
function frame(now) {
  requestAnimationFrame(frame);
  const t = playing ? (refVideo ? refVideo.currentTime : (now - t0) / 1000) : 0, bpm = track.bpm;
  const c = coachAt(t, bpm); let ref = c.pose, refV;
  if (refVideo && refLM && refVideo.readyState >= 2) { const k = Math.round(refVideo.currentTime * 10); let r = refCache.get(k); if (!r) { try { r = poseAngles(refLM.detectForVideo(refVideo, now + 0.5).landmarks?.[0]); } catch {} if (r) refCache.set(k, r); } if (r) { ref = r.a; refV = r.v; } }
  cg.fillStyle = "#1b1030"; cg.fillRect(0, 0, 300, 300); drawCoach(cg, 300, 300, ref, "#B8FF00", true);
  $("#move").textContent = refVideo ? "Following your video" : `${MOVES[c.idx].name} — ${MOVES[c.idx].tip} · next: ${MOVES[c.next].name}`;
  const W = stage.width, H = stage.height;
  g.save(); g.translate(W, 0); g.scale(-1, 1);
  if (stream && cam.readyState >= 2) g.drawImage(cam, 0, 0, W, H); else { g.fillStyle = "#120a22"; g.fillRect(0, 0, W, H); }
  if (lm && stream && cam.readyState >= 2 && now - lastDet > 66) { lastDet = now; try { lastPose = lm.detectForVideo(cam, now).landmarks?.[0] || null; } catch {} }
  if (lastPose && stream) { g.strokeStyle = "#ff4fd8"; g.lineWidth = 6; g.lineCap = "round"; for (const [i, j] of [...SEGS, [11, 12], [23, 24], [11, 23], [12, 24]]) { const p = lastPose[i], q = lastPose[j]; g.beginPath(); g.moveTo(p.x * W, p.y * H); g.lineTo(q.x * W, q.y * H); g.stroke(); } }
  g.restore();
  g.save(); g.translate(W - 170, 10); g.fillStyle = "#1b1030"; g.fillRect(0, 0, 160, 160); drawCoach(g, 160, 160, ref, "#B8FF00", true); g.restore();
  if (playing && lastPose && stream) {
    const u = poseAngles(lastPose), s = u && similarity(u, ref, refV);
    if (s != null) { smooth = smooth == null ? s : smooth * 0.8 + s * 0.2; sum += s; n++; if (s > 0.8) perfect++; }
  }
  if (playing) { const [w, col] = WORD(smooth ?? 0); g.font = "900 40px system-ui"; g.textAlign = "center"; g.fillStyle = col; g.shadowColor = "#000"; g.shadowBlur = 8; g.fillText(stream ? w : "Turn on camera to score", W / 2, H - 70); g.shadowBlur = 0;
    g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(20, H - 40, W - 40, 16); g.fillStyle = col; g.fillRect(20, H - 40, (W - 40) * (smooth ?? 0), 16);
    g.font = "700 20px system-ui"; g.textAlign = "left"; g.fillStyle = "#fff"; g.fillText(`Dance Coach · ${n > 0 ? Math.round((sum / n) * 100) : 0}%`, 16, 32); }
}
requestAnimationFrame(frame);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

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

// ---- Gamepad: ignore steering wheels; A/Start toggles play ----
const WHEEL_RE = /moza|wheel|racing|g29|g920|t300|fanatec|logitech g/i;
export function safePad(p) {
  if (!p || !p.connected || WHEEL_RE.test(p.id)) return false;
  if (p.mapping !== "standard" && p.axes.length <= 2) return false; // single steering axis (+pedal) → wheel-like
  return true;
}
const padPrev = new Map();
function pollPads() {
  requestAnimationFrame(pollPads);
  if (!navigator.getGamepads) return;
  for (const p of navigator.getGamepads()) {
    if (!safePad(p)) continue;
    const down = !!(p.buttons[0]?.pressed || p.buttons[9]?.pressed), was = padPrev.get(p.index);
    if (down && !was) $("#startBtn").click();
    padPrev.set(p.index, down);
  }
}
requestAnimationFrame(pollPads);

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
css.textContent = `#host{position:fixed;left:12px;right:12px;bottom:16px;max-width:520px;margin:auto;background:#fff;color:#1b1030;border-radius:20px;padding:12px 16px;font-size:17px;box-shadow:0 6px 20px rgba(0,0,0,.4);display:grid;gap:4px;z-index:20;opacity:0;transform:translateY(20px);transition:opacity .3s,transform .3s;pointer-events:none}
#host.show{opacity:1;transform:none}@media (prefers-reduced-motion: reduce){#host{transition:none;transform:none}}`;
document.head.appendChild(css);
let hideT = 0, voiceOn = localStorage.getItem("dc.voice") === "1";
function say(kind, force) {
  const nowT = performance.now(); if (!force && nowT - lastSay < 8000) return; lastSay = nowT;
  const L = LINES[kind]; let i; do { i = Math.floor(Math.random() * L.length); } while (L.length > 1 && i === lastIdx[kind]); lastIdx[kind] = i;
  bubble.querySelector("span").textContent = L[i]; bubble.classList.add("show"); clearTimeout(hideT); hideT = setTimeout(() => bubble.classList.remove("show"), 4500);
  if (voiceOn && "speechSynthesis" in window) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(L[i]); u.rate = 1.05; u.pitch = 1.1; speechSynthesis.speak(u); }
}
const vb = document.createElement("button"); vb.id = "voiceBtn"; vb.style.background = "#eee";
const vLabel = () => (vb.textContent = voiceOn ? "🔊 Coach voice: on" : "🔇 Coach voice: off");
vLabel(); vb.onclick = () => { voiceOn = !voiceOn; localStorage.setItem("dc.voice", voiceOn ? "1" : "0"); vLabel(); if (!voiceOn) speechSynthesis?.cancel(); else say("start", true); };
$("#startBtn").parentElement.appendChild(vb);
// hook moments
let wasPlaying = false, goodRun = 0, badRun = 0;
setInterval(() => {
  if (playing && !wasPlaying) { goodRun = badRun = 0; say("start", true); }
  if (!playing && wasPlaying && n > 20) say("end", true);
  wasPlaying = playing;
  if (playing && stream && smooth != null) {
    if (smooth > 0.7) { goodRun++; badRun = 0; if (goodRun === 6) say("streak"); }
    else if (smooth < 0.4) { badRun++; goodRun = 0; if (badRun === 6) say("miss"); }
    else { goodRun = Math.max(0, goodRun - 1); badRun = Math.max(0, badRun - 1); }
  }
}, 500);
