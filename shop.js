// Cosmetics shop + free chest (web only; hidden in the Android app so it stays network-free).
import { coins } from "./coins.js";
export const ITEMS = [
  { id: "outfit-lime", kind: "outfit", size: "free", name: "Classic Lime", color: "#B8FF00" },
  { id: "outfit-gold", kind: "outfit", size: "small", name: "Gold Glitter", color: "#FFD23F" },
  { id: "outfit-pink", kind: "outfit", size: "small", name: "Bubblegum", color: "#ff4fd8" },
  { id: "outfit-sky", kind: "outfit", size: "small", name: "Ice Skater", color: "#7fd3ff" },
  { id: "outfit-white", kind: "outfit", size: "small", name: "Disco White", color: "#ffffff" },
  { id: "theme-night", kind: "theme", size: "free", name: "Night Club", bg: "#120a22" },
  { id: "theme-sunset", kind: "theme", size: "large", name: "Sunset Stage", bg: "#3a1426" },
  { id: "theme-ocean", kind: "theme", size: "large", name: "Ocean Stage", bg: "#08243a" },
];
const owned = () => { try { return new Set(JSON.parse(localStorage.getItem("dc.owned") || "[]")); } catch { return new Set(); } };
const save = (o) => localStorage.setItem("dc.owned", JSON.stringify([...o]));
const eq = () => ({ outfit: localStorage.getItem("dc.outfit") || "outfit-lime", theme: localStorage.getItem("dc.theme") || "theme-night" });
export const coachColor = () => (ITEMS.find((i) => i.id === eq().outfit) || ITEMS[0]).color;
function applyTheme() { const t = ITEMS.find((i) => i.id === eq().theme); if (t) { document.documentElement.style.setProperty("--bg", t.bg); document.body.style.background = t.bg; } }
const fmt = (ms) => { const m = Math.ceil(ms / 6e4); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
export function initShop() {
  applyTheme();
  const box = document.getElementById("shop"); if (!box) return;
  if (coins.native) { box.hidden = true; return; }
  box.hidden = false;
  const msg = (t) => { box.querySelector(".shopMsg").textContent = t; };
  function render() {
    const o = owned(), e = eq();
    box.querySelector(".shopList").innerHTML = ITEMS.map((i) => {
      const has = i.size === "free" || o.has(i.id), on = e[i.kind] === i.id;
      const sw = i.kind === "outfit" ? `<i style="background:${i.color}"></i>` : `<i style="background:${i.bg}"></i>`;
      const btn = has ? `<button class="b-soft" data-use="${i.id}" ${on ? "disabled" : ""}>${on ? "✓ On" : "Use"}</button>` : `<button class="b-gold" data-buy="${i.id}">🪙 ${i.size === "small" ? "Buy" : "Buy theme"}</button>`;
      return `<div class="shopItem">${sw}<span>${i.name}<small>${i.kind === "outfit" ? "Coach outfit" : "Stage theme"}</small></span>${btn}</div>`;
    }).join("");
    const left = coins.chestLeft(), cb = box.querySelector("#chestBtn");
    cb.disabled = left > 0; cb.textContent = left > 0 ? `🎁 Next chest in ${fmt(left)}` : "🎁 Open free chest";
  }
  box.addEventListener("click", async (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.id === "chestBtn") { b.disabled = true; const r = await coins.chest();
      if (r && r.ok && !r.skipped && r.awarded) msg(`🎉 +${r.awarded} coins!`); else if (r && (r.skipped || r.status === 429 || /cool|cap/i.test(r.reason || r.error || ""))) { localStorage.setItem("dc.chestAt", Date.now()); msg("The chest is cooling down. Come back later!"); } else msg("Chest unavailable right now — try again later.");
      render(); return; }
    if (b.dataset.use) { const i = ITEMS.find((x) => x.id === b.dataset.use); localStorage.setItem(i.kind === "outfit" ? "dc.outfit" : "dc.theme", i.id); applyTheme(); render(); msg(`${i.name} on!`); return; }
    if (b.dataset.buy) { const i = ITEMS.find((x) => x.id === b.dataset.buy); b.disabled = true;
      const r = await (i.size === "small" ? coins.buyCosmeticSmall(i.id) : coins.buyCosmeticLarge(i.id));
      if (r && r.ok) { const o = owned(); o.add(i.id); save(o); localStorage.setItem(i.kind === "outfit" ? "dc.outfit" : "dc.theme", i.id); applyTheme(); msg(`Unlocked ${i.name}!`); }
      else if (r && r.status === 402) msg("Not enough coins yet — dance a few songs and try again! 💃");
      else msg("Shop unavailable right now — try again later.");
      render(); }
  });
  render(); setInterval(() => { if (!box.closest("[hidden]")) render(); }, 30000);
}
