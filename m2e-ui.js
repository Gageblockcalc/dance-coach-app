// Move to Earn UI (opt-in): settings toggle shows the button; sensor permission only from the Start tap. All data local.
import { m2e, RULES } from "./m2e.js";
import { createExerciseCounter } from "./m2e-pose.js";
import { SILLY } from "./coach3d.js";
import { S, sfx, haptic } from "./ui.js";
const $ = (s) => document.querySelector(s), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const css = document.createElement("style");
css.textContent = `html.tv #m2eBtn,html.tv #m2eRow,html.tv [data-k=m2e]{display:none!important}
#m2e>div{max-width:620px}.m2eStats{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.m2eStats .chip{font-size:14px}
.m2eCard{background:var(--card2);border-radius:18px;padding:12px;margin:10px 0}.m2eCard h3{margin:0 0 6px;font-size:17px}.m2eCard p{margin:4px 0}
.m2eMsg{min-height:1.4em;color:var(--mut)}.m2eBar{height:10px;border-radius:99px;background:#4a3d6e;overflow:hidden;margin:6px 0}.m2eBar i{display:block;height:100%;background:linear-gradient(90deg,var(--lime),var(--gold));width:0}
.m2eArt{display:flex;gap:12px;align-items:center}.m2eArt svg{flex:0 0 112px;width:112px;height:112px}.m2eArt>div{flex:1;min-width:0}
.potato .pb{transform-origin:60px 96px}.potato.slump .pb{transform:rotate(-10deg) scaleY(.88)}
.potato .shut,.potato .flat{display:none}.potato.slump .shut,.potato.slump .flat{display:inline}.potato.slump .open,.potato.slump .happy{display:none}
.potato .armL{transform-origin:40px 72px;transform:rotate(-70deg)}.potato .armR{transform-origin:80px 72px;transform:rotate(70deg)}.potato.slump .armL{transform:rotate(25deg)}.potato.slump .armR{transform:rotate(-25deg)}
.potato:not(.slump) .pb{animation:m2eBob .5s ease-in-out infinite alternate}@keyframes m2eBob{from{transform:translateY(0) rotate(-5deg)}to{transform:translateY(-8px) rotate(5deg)}}
.chicken .egg{opacity:0;transform:translateY(-14px)}.chicken.laid .egg{opacity:1;transform:none;animation:m2ePop .5s ease-out}@keyframes m2ePop{from{transform:translateY(-30px) scale(.4);opacity:0}to{transform:none;opacity:1}}
.chicken.laid .cb{animation:m2eWob .4s}@keyframes m2eWob{25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}.chicken .cb{transform-origin:60px 90px}
.m2eSpark{display:inline-block;animation:m2eFly 1s ease-out forwards}html.noparticles .m2eSpark,html.reduce .m2eSpark{display:none}@keyframes m2eFly{from{transform:translateY(0);opacity:1}to{transform:translateY(-26px);opacity:0}}
#m2eHud{position:fixed;left:calc(10px + var(--sl,0px));right:calc(10px + var(--sr,0px));bottom:calc(10px + var(--sb,0px));max-width:520px;margin:auto;z-index:60;background:#2b1d4f;border:2px solid var(--gold);border-radius:18px;padding:8px 12px;display:flex;gap:10px;align-items:center;box-shadow:0 6px 24px #0008}
#m2eHud span{flex:1;font-weight:700}#m2eHud button{min-height:44px;font-size:15px;padding:0 14px}
.m2eWear{display:flex;align-items:center;gap:8px;padding:6px 0}.m2eWear i{flex:0 0 26px;height:26px;border-radius:50%;border:2px solid #fff4}.m2eWear span{flex:1;min-width:0}.m2eWear button{min-height:44px;font-size:15px;padding:0 12px}
.m2eAct{display:flex;gap:8px;flex-wrap:wrap}.m2eAct button{flex:1 1 150px}`;
document.head.append(css);

const sheet = $("#m2e"), btn = $("#m2eBtn"); if (!sheet || !btn) throw new Error("m2e markup missing");
const POTATO = ["Zzz… couch potato mode. Move to wake me up!", "I haven't moved since the last snack. Tap Start and walk!", "Is it nap time already? Take a few steps!"];
const DANCE = ["Whoa, I'm DANCING! Spud-tacular!", "Look at me go! Mashed-potato dance!", "You moved! I'm so proud I could fry!"];
const CLUCK = ["Cluck! A golden egg!", "BAWK! Shiny egg incoming!", "Egg-cellent squatting!"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let sensorMsg = "", chalMsg = "", wardMsg = "", resetArm = 0, sensorBusy = false, sess = { kind: null, reps: 0 };
const wear = (id) => { localStorage.setItem("dc.look", id); window.dispatchEvent(new CustomEvent("dc-settings", { detail: "look" })); };
const potatoSvg = `<svg class="potato" viewBox="0 0 120 120" aria-hidden="true"><rect x="6" y="84" width="108" height="30" rx="14" fill="#7a3d6e"/><rect x="2" y="66" width="20" height="48" rx="10" fill="#93508a"/><rect x="98" y="66" width="20" height="48" rx="10" fill="#93508a"/><g class="pb"><line class="armL" x1="40" y1="72" x2="14" y2="72" stroke="#b98d55" stroke-width="7" stroke-linecap="round"/><line class="armR" x1="80" y1="72" x2="106" y2="72" stroke="#b98d55" stroke-width="7" stroke-linecap="round"/><ellipse cx="60" cy="68" rx="30" ry="34" fill="#d1a566"/><circle cx="48" cy="74" r="2" fill="#a67c43"/><circle cx="72" cy="60" r="2" fill="#a67c43"/><g class="open"><circle cx="50" cy="58" r="4.5" fill="#222"/><circle cx="70" cy="58" r="4.5" fill="#222"/></g><g class="shut" stroke="#222" stroke-width="3" stroke-linecap="round"><line x1="44" y1="60" x2="55" y2="60"/><line x1="65" y1="60" x2="76" y2="60"/></g><path class="happy" d="M48 74 Q60 90 72 74 Z" fill="#7a2a2a"/><line class="flat" x1="52" y1="78" x2="68" y2="78" stroke="#7a2a2a" stroke-width="3" stroke-linecap="round"/></g></svg>`;
const chickenSvg = `<svg class="chicken" viewBox="0 0 120 120" aria-hidden="true"><g class="cb"><ellipse cx="58" cy="70" rx="30" ry="26" fill="#ffd93b"/><circle cx="86" cy="42" r="15" fill="#ffd93b"/><path d="M84 28 q4-12 10-4 q4-8 6 2 z" fill="#e63946"/><path d="M99 44 l14 5 l-14 5 z" fill="#ff8c1a"/><circle cx="90" cy="40" r="2.6" fill="#222"/><path d="M80 56 q6 14 -6 16" fill="#e63946" opacity=".9"/><line x1="48" y1="94" x2="48" y2="110" stroke="#ff8c1a" stroke-width="5" stroke-linecap="round"/><line x1="68" y1="94" x2="68" y2="110" stroke="#ff8c1a" stroke-width="5" stroke-linecap="round"/></g><ellipse class="egg" cx="30" cy="106" rx="10" ry="13" fill="#ffc400" stroke="#fff3a0" stroke-width="2"/></svg>`;

function render() {
  const s = m2e.state(), d = s.d, run = m2e.running();
  const idle = m2e.idleMs() > 15000, owned = new Set(s.owned);
  const crateP = Math.min(100, (s.crateSteps / RULES.stepsPerCrate) * 100);
  sheet.querySelector("div").innerHTML = `
  <div class="row" style="justify-content:space-between"><h2 tabindex="-1">🏃 Move to Earn</h2><button class="icon" id="m2eClose" aria-label="Close Move to Earn">✕</button></div>
  <p class="note">Optional and off by default. Walk, shake your phone or squat in front of the camera to earn <b>Move coins</b>, then spend them on silly coach outfits (cosmetics only). Everything stays on this device: no location, no accounts, nothing uploaded. Counting only happens while the app is open. Turning the feature off keeps your coins; the Reset button erases them.</p>
  <div class="m2eStats" aria-live="polite"><span class="chip">⚡ <b>${s.coins}</b> Move coins</span><span class="chip">Today ${d.coins}/${RULES.dayCap} coins</span><span class="chip">👟 ${d.steps} steps</span><span class="chip">📦 ${s.crates} crate${s.crates === 1 ? "" : "s"}</span></div>
  <div class="m2eCard"><div class="m2eArt">${potatoSvg}<div><h3>🥔 Couch Potato</h3><p id="m2ePotatoTxt" aria-live="polite"></p></div></div></div>
  <div class="m2eCard"><h3>👟 Steps &amp; shakes (phone)</h3>
   <p>Keep your phone in a pocket and walk, or give it a good shake. A mystery crate drops every ${RULES.stepsPerCrate} steps.</p>
   <div class="m2eBar" role="img" aria-label="Steps to next crate"><i style="width:${crateP}%"></i></div><p class="note">${s.crateSteps}/${RULES.stepsPerCrate} steps to the next crate (max ${RULES.maxCratesPerDay} a day)</p>
   <div class="m2eAct">${run ? `<button id="m2eStop" class="b-soft">⏹ Stop counting</button>` : `<button id="m2eStart" class="b-gold" ${sensorBusy ? "disabled" : ""}>${sensorBusy ? "Starting…" : "▶ Start counting steps & shakes"}</button>`}</div>
   <p class="m2eMsg" role="status" aria-live="polite">${esc(run ? "✅ Counting! Walk or shake away." : sensorMsg)}</p></div>
  <div class="m2eCard"><h3>📷 Camera challenges</h3><div class="m2eArt">${chickenSvg}<div><p>Squat in front of the camera: every ${RULES.repsPerEgg} squats the rubber chicken lays a golden egg (+${RULES.eggCoins} coins). Works on computers too!</p></div></div>
   <p class="note">Squat progress ${s.d.pend.reps}/${RULES.repsPerEgg} · eggs today ${d.eggs}/${RULES.cap.eggs / RULES.eggCoins} · jumping jacks ${d.pend.jacks}/${RULES.jackPerReward}</p>
   <div class="m2eAct"><button id="m2eSquat" class="b-gold">🐔 Squat challenge</button><button id="m2eJack" class="b-sky">🤸 Jumping jacks</button></div>
   <p class="m2eMsg" role="status" aria-live="polite">${esc(chalMsg)}</p></div>
  <div class="m2eCard"><h3>👗 Silly outfits</h3><div class="m2eAct"><button id="m2eCrate" class="b-pink" ${s.crates < 1 ? "disabled" : ""}>📦 Open mystery crate (${s.crates})</button></div>
   ${SILLY.map((l) => { const has = owned.has(l.id), on = localStorage.getItem("dc.look") === l.id && has; return `<div class="m2eWear"><i style="background:${l.top}"></i><span>${l.emoji} ${l.name}</span>${has ? `<button class="b-soft" data-wear="${l.id}" ${on ? "disabled" : ""}>${on ? "✓ On" : "Wear"}</button>` : `<button class="b-gold" data-buy="${l.id}" ${s.coins < l.price ? 'aria-disabled="true"' : ""}>⚡ ${l.price}</button>`}</div>`; }).join("")}
   <p class="m2eMsg" role="status" aria-live="polite">${esc(wardMsg)}</p></div>
  <div class="row"><button id="m2eReset" class="link">${resetArm ? "Tap again to erase everything" : "🗑 Reset Move to Earn data"}</button></div>`;
  potatoTick();
}
function potatoTick() {
  const sv = sheet.querySelector("svg.potato"), tx = $("#m2ePotatoTxt"); if (!sv) return;
  const idle = m2e.idleMs() > 15000; sv.classList.toggle("slump", idle);
  const k = idle ? (m2e.running() ? 0 : 1) : -1; if (tx && tx.dataset.k !== String(k)) { tx.dataset.k = k; tx.textContent = idle ? pick(POTATO) : pick(DANCE); }
}
setInterval(() => { if (!sheet.hidden) potatoTick(); updateHud(); }, 1000);

// ---- camera challenges ----
let counter = null, hud = null, posed = false;
function mkCounter() { return (counter ??= createExerciseCounter((kind) => { sess.reps++; const before = m2e.state().d.eggs; m2e.onReps(kind, 1); if (kind === "squat" && m2e.state().d.eggs > before) laid(); updateHud(); })); }
function laid() { sfx("cheer", 0.7); haptic("success"); chalMsg = pick(CLUCK) + ` +${RULES.eggCoins} ⚡`; if (hud) { hud.querySelector("span").dataset.egg = Date.now(); } if (!sheet.hidden) { render(); sheet.querySelector(".chicken")?.classList.add("laid"); } }
function updateHud() {
  if (!hud) return; const s = m2e.state(), k = counter?.kind(); if (!k) return;
  const sq = k === "squat", p = sq ? s.d.pend.reps + "/" + RULES.repsPerEgg : s.d.pend.jacks + "/" + RULES.jackPerReward;
  const fresh = hud.querySelector("span").dataset.egg && Date.now() - hud.querySelector("span").dataset.egg < 2500;
  hud.querySelector("span").textContent = !posed ? "Show your whole body to the camera…" : fresh ? `🥚✨ Golden egg! +${RULES.eggCoins} ⚡` : sq ? `🐔 Squats ${p} · eggs ${s.d.eggs}/${RULES.cap.eggs / RULES.eggCoins} · ⚡ ${s.coins}` : `🤸 Jacks ${p} · ⚡ ${s.coins}`;
}
function endChallenge() { counter?.set(null); hud?.remove(); hud = null; posed = false; window.dcPose = null; sess.kind = null; }
async function startChallenge(kind) {
  endChallenge(); mkCounter().set(kind); sess = { kind, reps: 0 }; sheet.hidden = true;
  hud = document.createElement("div"); hud.id = "m2eHud"; hud.setAttribute("role", "status"); hud.innerHTML = `<span aria-live="polite"></span><button class="b-soft" id="m2eDone">Done</button>`; document.body.append(hud);
  hud.querySelector("#m2eDone").onclick = () => { endChallenge(); open(); };
  window.dcPose = (L, now) => { if (!posed) { posed = true; } counter.feed(L, now); };
  updateHud();
  const cam = $("#camBtn"); if (cam && /Turn on/i.test(cam.textContent)) cam.click();
  setTimeout(() => { if (hud && !posed) { hud.querySelector("span").textContent = "No camera pose yet. Is the camera allowed and your whole body in view?"; } }, 15000);
}
// ---- sensor ----
async function startSensor() {
  sensorBusy = true; sensorMsg = ""; render();
  const r = await m2e.start(); sensorBusy = false;
  sensorMsg = r.ok ? "" : r.reason === "denied" ? "Motion access wasn't allowed, or this device has no motion sensor (computers and TVs don't). On a phone, allow motion in your settings and tap Start again, or try the camera challenges below." : r.reason === "unsupported" ? "This device can't read motion sensors. Try the camera challenges below." : "No motion sensor found here (normal on computers and TVs). Try the camera challenges below. Squats work great!";
  render();
}
// ---- events ----
function open() { render(); sheet.hidden = false; sheet.querySelector("h2")?.focus(); }
function close() { sheet.hidden = true; btn.focus(); }
btn.onclick = open;
sheet.addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "m2eClose") return close();
  if (b.id === "m2eStart") return startSensor();
  if (b.id === "m2eStop") { m2e.stop(); sensorMsg = "Stopped. Tap Start whenever you want to count again."; return render(); }
  if (b.id === "m2eSquat") return startChallenge("squat");
  if (b.id === "m2eJack") return startChallenge("jack");
  if (b.id === "m2eCrate") { const r = m2e.openCrate(SILLY.map((l) => l.id)); if (r.id) { const l = SILLY.find((x) => x.id === r.id); wear(r.id); wardMsg = `📦 ${l.emoji} ${l.name}! It's on your coach now.`; sfx("cheer", 0.7); haptic("success"); } else if (r.coins) wardMsg = `📦 You own every silly outfit! +${r.coins} ⚡ instead.`; return render(); }
  if (b.dataset.wear) { wear(b.dataset.wear); wardMsg = "Looking silly!"; return render(); }
  if (b.dataset.buy) { const l = SILLY.find((x) => x.id === b.dataset.buy); if (m2e.buy(l.id, l.price)) { wear(l.id); wardMsg = `${l.emoji} ${l.name} unlocked!`; sfx("cheer", 0.6); } else wardMsg = `Not enough Move coins yet: ${l.name} costs ${l.price}.`; return render(); }
  if (b.id === "m2eReset") { if (!resetArm) { resetArm = 1; setTimeout(() => { resetArm = 0; if (!sheet.hidden) render(); }, 4000); return render(); } resetArm = 0; m2e.stop(); endChallenge(); if (SILLY.some((l) => l.id === localStorage.getItem("dc.look"))) wear("classic"); m2e.reset(); wardMsg = chalMsg = sensorMsg = ""; render(); const m = sheet.querySelector(".m2eStats"); if (m) m.insertAdjacentHTML("afterend", `<p class="m2eMsg" role="status">Erased. Fresh start!</p>`); }
});
addEventListener("dc-m2e", () => {
  if (!sheet.hidden) { const f = document.activeElement, id = f && sheet.contains(f) ? (f.id ? "#" + f.id : f.dataset.wear ? `[data-wear="${f.dataset.wear}"]` : f.dataset.buy ? `[data-buy="${f.dataset.buy}"]` : "") : ""; render(); if (id) sheet.querySelector(id)?.focus(); }
  updateHud();
});
function applyOn() { const on = S.m2e === true; btn.hidden = !on; if (!on) { m2e.stop(); endChallenge(); sheet.hidden = true; } }
addEventListener("dc-settings", (e) => { if (e.detail === "m2e") applyOn(); });
applyOn();
window.dcM2e = { open }; // used by tests/hooks
