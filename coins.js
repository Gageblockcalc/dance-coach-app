// Hub coin ledger adapter (site "dancecoach"). Web only: the Android app stays network-free (data safety: no data collected).
// Never blocks play: any error (CORS, unknown_event before registration, offline) just shows the balance as unavailable.
const HUB = "https://nick-sites-hub.tekjeep.workers.dev", SITE = "dancecoach";
const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
let guest = localStorage.getItem("hub_guest");
const el = () => document.getElementById("coins");
function show(b) { const e = el(); if (!e) return; e.hidden = b == null; e.textContent = b == null ? "🪙 –" : "🪙 " + b; e.title = b == null ? "Coins unavailable right now" : "Coins"; }
async function call(path, body) {
  if (native) return null;
  try {
    const r = await fetch(`${HUB}/coins/${path}?site=${SITE}`, { method: body ? "POST" : "GET", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(guest ? { "X-Hub-Guest": guest } : {}) }, body: body ? JSON.stringify({ ...body, guest }) : undefined });
    const j = await r.json().catch(() => ({}));
    if (j.guest && j.guest !== guest) { guest = j.guest; localStorage.setItem("hub_guest", guest); }
    if (j.ok && typeof j.balance === "number") { show(j.balance); return j; }
    if (path === "balance") show(null);
    return { ok: false, status: r.status, error: j.error || "error", ...j };
  } catch { if (path === "balance") show(null); return null; }
}
const day = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
function isoWeek(d = new Date()) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + "-W" + String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, "0"); }
export const coins = {
  // free_chest: once per 4h window (server caps it too). buy_cosmetic_*: spend for cosmetics (UI not built yet).
  native,
  async chest() { const r = await this.award("free_chest", "chest-" + Date.now().toString(36)); if (r && r.ok && !r.skipped) localStorage.setItem("dc.chestAt", Date.now()); return r; },
  chestLeft() { return Math.max(0, +(localStorage.getItem("dc.chestAt") || 0) + 144e5 - Date.now()); },
  balance: () => call("balance"),
  award: (event, key) => call("award", { event, idempotency_key: key }),
  spend: (event, key) => call("spend", { event, idempotency_key: key }),
  /** Server-priced cosmetics — always POST /coins/spend (never award). */
  buyCosmeticSmall(itemId) { return this.spend("buy_cosmetic_small", "cos-s-" + String(itemId || "x").slice(0, 40)); },
  buyCosmeticLarge(itemId) { return this.spend("buy_cosmetic_large", "cos-l-" + String(itemId || "x").slice(0, 40)); },
  // Hooks used by app.js
  onOpen() { if (native) return; this.balance().then(() => this.award("daily_streak", "streak-" + day())); },
  onSongEnd({ stars, daily, perfect, streak = 0 }) {
    if (native) return; const id = Date.now().toString(36);
    this.award("first_dance_day", "first-" + day());
    this.award("song_complete", "song-" + id);
    if (stars >= 3) this.award("song_3star", "s3-" + id);
    if (daily) { this.award("daily_challenge", "daily-" + day()); this.award("weekly_challenge", "weekly-" + isoWeek()); }
    this.award("achievement_first_dance", "ach-first-dance");
    if (perfect >= 10) this.award("achievement_perfect_10", "ach-perfect-10");
    if (streak >= 7) this.award("achievement_streak_7", "ach-streak-7");
    const songs = +(localStorage.getItem("dc.songs") || 0) + 1; localStorage.setItem("dc.songs", songs);
    if (songs % 10 === 0) this.award("level_up", "level-up-" + songs / 10);
  },
};
