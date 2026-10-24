// Progress UI: level button + sheet (level bar, badges, personal bests, invite), XP/level-up toasts. All local.
import { state, progressInfo, BADGES, UNLOCK, MAX_LEVEL, level, onMoveCoins, resetProgress, streakOf, dayKey } from "./progress.js";
import { m2e } from "./m2e.js";
import { sfx, haptic } from "./ui.js";
const $ = (s) => document.querySelector(s), esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const css = document.createElement("style");
css.textContent = `#prog>div{max-width:620px}.pgHead{display:flex;align-items:center;gap:12px}.pgLvl{flex:0 0 64px;height:64px;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:26px;color:#1a0b3a;background:radial-gradient(circle at 30% 25%,#fff6b0,var(--gold))}
.pgBar{height:12px;border-radius:99px;background:#4a3d6e;overflow:hidden;margin:6px 0}.pgBar i{display:block;height:100%;background:linear-gradient(90deg,var(--lime),var(--gold));transition:width .4s}html.reduce .pgBar i{transition:none}
.pgBadges{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0}.pgB{background:var(--card2);border-radius:14px;padding:8px 10px;font-size:14px}.pgB.off{opacity:.45;filter:grayscale(1)}.pgB b{display:block}.pgB span{color:var(--mut);font-size:12px}
.pgList{list-style:none;margin:6px 0;padding:0}.pgList li{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #ffffff14}
#progToast{position:fixed;left:50%;top:calc(var(--st,0px) + 64px);transform:translate(-50%,-20px);z-index:60;background:var(--card);border:2px solid var(--gold);color:var(--fg,#fff);padding:10px 16px;border-radius:16px;font-weight:700;max-width:90vw;text-align:center;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s}
#progToast.show{opacity:1;transform:translate(-50%,0)}html.reduce #progToast{transition:none}.xpLine{margin:6px 0;font-weight:700;color:var(--gold)}`;
document.head.appendChild(css);
const btn = $("#progBtn"), sheet = $("#prog"); if (!btn || !sheet) throw 0;
const toastEl = document.createElement("div"); toastEl.id = "progToast"; toastEl.setAttribute("role", "status"); toastEl.setAttribute("aria-live", "polite"); document.body.appendChild(toastEl);
let q = [], busy = false;
function pump() { if (busy || !q.length) return; busy = true; const m = q.shift(); toastEl.textContent = m; toastEl.classList.add("show"); setTimeout(() => { toastEl.classList.remove("show"); setTimeout(() => { busy = false; pump(); }, 300); }, 2600); }
const toast = (m) => { q.push(m); if (q.length > 4) q.shift(); pump(); };
function refreshBtn() { const p = progressInfo(); btn.textContent = `⭐ Level ${p.level} · ${p.xp} XP`; btn.setAttribute("aria-label", `Level ${p.level}, ${p.xp} experience points. Open progress`); }
const NEXT = [
  [UNLOCK.candy, "🎵 Song: Candy Pop"], [UNLOCK.gold, "👗 Outfit: Gold Star"], [UNLOCK.aurora, "🎪 Stage: Aurora"], [UNLOCK.drive, "🎵 Song: Midnight Drive"],
  [UNLOCK.ember, "👗 Outfit: Ember"], [UNLOCK.sunrise, "🎪 Stage: Sunrise"], [UNLOCK.turbo, "🎵 Song: Turbo Hype"], [UNLOCK.midnight, "👗 Outfit: Midnight"],
].sort((a, b) => a[0] - b[0]);
const SONGS = () => [["pulse", "Neon Pulse"], ["bounce", "Bubble Bounce"], ["groove", "Sunset Groove"], ["glow", "Glow Up"], ["candy", "Candy Pop"], ["drive", "Midnight Drive"], ["turbo", "Turbo Hype"]];
function bests() {
  const rows = []; for (const [id, name] of SONGS()) { try { const b = JSON.parse(localStorage.getItem("dc.pb.song-" + id) || "[]"); if (b[0]) rows.push(`<li><span>${esc(name)}</span><b>${b[0].pct}%</b></li>`); } catch {} }
  return rows.length ? `<ul class="pgList">${rows.join("")}</ul>` : `<p class="note">Finish a song to see your personal bests here.</p>`;
}
function render() {
  const p = progressInfo(), s = state(), up = NEXT.find((n) => n[0] > p.level), got = BADGES.filter((b) => s.badges[b.id]).length;
  let best = {}; try { best = JSON.parse(localStorage.getItem("dc.best") || "{}"); } catch {}
  const st = streakOf(new Set(Object.keys(best)), new Date());
  sheet.firstElementChild.innerHTML = `<h2 tabindex="-1">⭐ Your progress</h2>
  <div class="pgHead"><div class="pgLvl" aria-hidden="true">${p.level}</div><div style="flex:1;min-width:0"><b>Level ${p.level}${p.max ? " (max!)" : ""}</b> · ${p.xp} XP
  <div class="pgBar" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p.pct * 100)}"><i style="width:${Math.round(p.pct * 100)}%"></i></div>
  <div class="note">${p.max ? "You've unlocked everything. Keep dancing!" : `${p.need - p.into} XP to level ${p.level + 1}`}${up ? ` · next unlock at level ${up[0]}: ${up[1]}` : ""}</div></div></div>
  <p class="note">Earn XP from every song, the Daily challenge, a daily streak and badges. Your streak forgives a missed day now and then. 🔥 ${st.streak}-day streak</p>
  <h3>Badges ${got}/${BADGES.length}</h3><div class="pgBadges">${BADGES.map((b) => { const on = !!s.badges[b.id]; return `<div class="pgB${on ? "" : " off"}" role="group" aria-label="${esc(b.name)}: ${esc(b.desc)}. ${on ? "Earned" : "Not yet"}"><b>${b.icon} ${esc(b.name)}</b><span>${esc(b.desc)}</span></div>`; }).join("")}</div>
  <h3>Personal bests</h3>${bests()}
  <div class="row grow" style="margin-top:12px"><button id="pgInvite" class="b-sky">📤 Invite a friend</button><button id="pgClose" class="b-soft">Close</button></div>
  <p id="pgMsg" class="note" role="status"></p><div id="pgAcct"></div><p class="note"><button id="pgReset" class="b-soft" style="font-size:13px;padding:6px 10px">Reset progress</button> Everything here is saved only on this device.</p>`;
}
function open() { render(); window.dcAccountRender?.(); sheet.hidden = false; sheet.querySelector("h2")?.focus(); }
function close() { sheet.hidden = true; btn.focus(); }
btn.onclick = open;
sheet.addEventListener("click", async (e) => {
  if (e.target === sheet) return close();
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "pgClose") return close();
  if (b.id === "pgInvite") {
    const url = "https://dancecoach.pages.dev/?ref=invite", text = "Come dance with me! Dance Coach scores your moves with your camera, all on your device.", m = $("#pgMsg");
    try { if (navigator.share) { await navigator.share({ title: "Dance Coach", text, url }); m.textContent = "Thanks for sharing! 💃"; return; } } catch (er) { if (er && er.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text + " " + url); m.textContent = "Invite link copied. Paste it to a friend! 💃"; } catch { m.textContent = "Share this link: " + url; }
    return;
  }
  if (b.id === "pgReset") { if (b.dataset.sure) { resetProgress(); render(); } else { b.dataset.sure = "1"; b.textContent = "Tap again to reset"; } }
});
addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) close(); });
// XP / badge / level-up announcements. Called from the song-end hook with the result element.
window.dcProgressResult = (o, resEl) => {
  refreshBtn(); const p = progressInfo();
  if (resEl) resEl.insertAdjacentHTML("beforeend", `<div class="xpLine" role="status">+${o.xp} XP · Level ${p.level}${o.levelUp ? " 🎉 Level up!" : ""}${o.badges.length ? " · " + o.badges.map((b) => b.icon + " " + esc(b.name)).join(", ") : ""}</div>`);
  if (o.levelUp) { toast(`🎉 Level ${o.levelUp}! ${(NEXT.filter((n) => n[0] === o.levelUp).map((n) => "Unlocked " + n[1].slice(3)).join(", ")) || "Keep going!"}`); sfx("cheer", 0.7); haptic("success"); }
  o.badges.forEach((b) => toast(`${b.icon} Badge: ${b.name}`));
};
// Move to Earn: 2 XP per Move coin earned today (the Move to Earn caps bound it).
let lastCoins = -1;
addEventListener("dc-m2e", (e) => {
  if (e.detail !== "coins") return;
  try { const s = m2e.state(), o = onMoveCoins(s.d.coins, s.day || dayKey()); if (o.xp) { refreshBtn(); if (o.levelUp) toast(`🎉 Level ${o.levelUp}!`); o.badges.forEach((b) => toast(`${b.icon} Badge: ${b.name}`)); } } catch {}
});
addEventListener("dc-prog", refreshBtn);
refreshBtn();
