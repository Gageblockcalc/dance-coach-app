// Seasonal themes: family-friendly lines, stage palette + decor, outfits, event challenge and an original tune. Season picked by America/New_York date, or chosen in Settings (dc.seasonMode = auto | <season> | off). ?season=<id> overrides (testing).
export const SEASONS = {
  halloween: { label: "🎃 Halloween", lines: [
    "This routine is so smooth, even the pumpkins are getting their groove on!",
    "Why did the pumpkin win the dance-off? It had the best seeds-moves!",
    "Love the costume! Is it 'Dance Superstar'? Because it fits perfectly!",
    "You're so sweet, the candy bowl is jealous!",
    "Trick or treat? I pick a treat: that last move!",
    "Your feet are a full-size candy bar, not a fun-size one!",
    "That spin was so spooky-silly the jack-o'-lanterns grinned wider!",
    "Pumpkin spice and everything nice, and those moves too!",
    "You're the gourd-geous star of this pumpkin patch party!",
    "Don't stop now! The candy corn is cheering for you!",
    "That shimmy was pure caramel apple: sticky-sweet and fun!",
    "Boo-tiful footwork! Okay, that one was a little spooky-silly.",
    "Costume check: sparkly, fun and ready to dance. Ten out of ten!",
  ] },
  thanksgiving: { label: "🦃 Thanksgiving", lines: [
    "I'm thankful for one thing today: that move you just did!",
    "Let's work up an appetite for pie, one step at a time!",
    "That was un-turkey-lievable!",
    "You've got more moves than a parade balloon in the wind!",
    "Gobble up those points, dance champ!",
    "Mashed potatoes and gravy, and you're making those moves look easy!",
    "Your dancing is the cranberry sauce on this feast: it brings it all together!",
    "Stuffing? You're stuffed with talent!",
    "That twirl deserves a second helping!",
    "Pass the pie, the moves, and the high fives!",
    "Feeling grateful for every beat and every step!",
  ] },
  christmas: { label: "🎄 Christmas", lines: [
    "Snow way! That move was perfect!",
    "You're sleigh-ing this routine!",
    "That was cooler than a snowman's sunglasses!",
    "Jingle all the way to the next move!",
    "Your footwork is snow-flaking amazing, no two steps alike!",
    "Hot cocoa break? Nope! Keep that groove going!",
    "You're lighting up this dance floor like a string of twinkly lights!",
    "That spin had more sparkle than tinsel!",
    "Ice ice baby, you've got the moves!",
    "Mittens on, groove on!",
    "Ready, set, snow! Let's go!",
    "You're the gingerbread star of this routine!",
  ] },
  newyear: { label: "🎆 New Year", lines: [
    "New year, new moves, and you just nailed one!",
    "Resolution: dance more. Status: crushing it!",
    "Five, four, three, two, one... GROOVE!",
    "That move deserves confetti!",
    "You're starting the year on the right foot. And the left one!",
    "Pop goes the party popper! Great step!",
    "This year's top hit: your dancing!",
    "Cheers to fresh starts and fancy footwork!",
    "That was so good it needs its own countdown!",
    "Twelve months of dancing, starting right now!",
  ] },
  valentine: { label: "💝 Valentine's", lines: [
    "I heart that move!",
    "You stole my heart and the dance floor!",
    "That routine was sweeter than a box of chocolates!",
    "Roses are red, violets are blue, nobody dances quite like you!",
    "You're my favorite dance partner. Don't tell the disco ball!",
    "Be mine... at the next dance-off!",
    "That was heart-stoppingly fun!",
    "Your moves just got a big hug from the crowd!",
    "Sending you a dance-a-gram: great job!",
    "Friendship bracelets and fancy feet!",
    "You're one in a melon. Wait, wrong holiday... still true!",
  ] },
  fall: { label: "🍂 Fall", lines: [
    "You're falling for these moves, and the leaves are too!",
    "That spin was crisper than an autumn apple!",
    "Leaf it all on the dance floor!",
    "Sweater weather, better dancer!",
    "You raked in the points on that one!",
    "Cozy feet, big beats!",
  ] },
  spring: { label: "🌷 Spring", lines: [
    "Your moves are blooming!",
    "Spring in your step? More like a whole trampoline!",
    "That routine was fresher than a flower garden!",
    "Hop to it, the bunnies are watching!",
    "Sunshine and dance lines!",
    "You just made the tulips do a twirl!",
  ] },
  summer: { label: "☀️ Summer", lines: [
    "Hot moves for a sunny day!",
    "That was cooler than a popsicle!",
    "Surf's up and so is your score!",
    "Beach ball bounce, nailed it!",
    "Sunscreen on, dance mode on!",
    "You're making waves out there!",
  ] },
  july4: { label: "🎇 July 4th", lines: [
    "Those moves were a real firecracker!",
    "Stars, stripes and dance-floor sparkle!",
    "That combo lit up the sky!",
    "Picnic, parade, perfect moves!",
    "You're the grand finale!",
    "Sparkler-bright footwork!",
  ] },
};
function nyParts(d = new Date()) { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d).map((x) => [x.type, +x.value || x.value])); return { y: +p.year, m: +p.month, d: +p.day }; }
export const SEASON_IDS = ["halloween", "fall", "thanksgiving", "christmas", "newyear", "valentine", "spring", "summer", "july4"];
const thanksDay = (y) => 1 + ((4 - new Date(Date.UTC(y, 10, 1)).getUTCDay() + 7) % 7) + 21; // 4th Thursday of November
/** Day-of-year style key for window checks (month*100+day). */
export function seasonFor(date = new Date()) {
  const { y, m, d } = nyParts(date), md = m * 100 + d, tg = 1100 + thanksDay(y);
  if (md >= 1001 && md <= 1101) return "halloween";
  if (md >= 1102 && md <= tg - 7) return "fall";
  if (md >= tg - 6 && md <= tg + 3) return "thanksgiving";
  if (md >= tg + 4 && md <= 1226) return "christmas";
  if (md >= 1227 || md <= 107) return "newyear";
  if (md >= 201 && md <= 214) return "valentine";
  if (md >= 320 && md <= 531) return "spring";
  if (md >= 628 && md <= 705) return "july4";
  if (md >= 601 && md <= 921) return "summer";
  if (md >= 922 && md <= 930) return "fall";
  return "general";
}
const norm = (s) => (s === "winter" ? "christmas" : s);
export function seasonMode() { let v = "auto"; try { v = norm(localStorage.getItem("dc.seasonMode") || "auto"); } catch {} return v === "off" || SEASONS[v] ? v : "auto"; }
export function setSeasonMode(v) { try { localStorage.setItem("dc.seasonMode", v); } catch {} }
/** Active season id, or null when off / no season today. */
export function activeSeason(now = new Date()) {
  let o = null; try { o = norm(new URLSearchParams(location.search).get("season")); } catch {}
  if (o === "general" || o === "off") return null; if (o && SEASONS[o]) return o;
  const m = seasonMode(); if (m === "off") return null; if (m !== "auto") return m;
  const s = seasonFor(now); return SEASONS[s] ? s : null;
}
export function season() { return activeSeason() || "general"; }
export function seasonLine() { const s = SEASONS[activeSeason()]; return s ? s.lines[Math.floor(Math.random() * s.lines.length)] : null; }
/* Light stage palettes (static decor drawn once, no flashing), outfit tints and original synth tunes (pattern data, CC0). */
export const THEMES = {
  halloween: { a: "#2a0f3a", b: "#0a0410", lights: ["#ff8a00", "#7dff6a", "#b07aff"], decor: "halloween", look: { name: "Pumpkin", emoji: "🎃", top: "#ff8a00", bottom: "#2a0f3a", hair: "#7dff6a" }, tune: { name: "Spooky Shuffle", bpm: 104, bass: [0, 3, 6, 3], root: 40, wave: "square", arp: [0, 3, 6, 10, 6, 3, 1, 3] } },
  fall: { a: "#5a2a12", b: "#1a0c06", lights: ["#ff9a3d", "#ffd23f", "#c8553d"], decor: "leaves", look: { name: "Maple", emoji: "🍁", top: "#c8553d", bottom: "#6b3a1e", hair: "#ffb347" }, tune: { name: "Leaf Pile Funk", bpm: 96, bass: [0, 5, 3, 7], root: 43, wave: "triangle", arp: [0, 7, 10, 12, 10, 7, 5, 3] } },
  thanksgiving: { a: "#6a3a14", b: "#1e0f05", lights: ["#ffb347", "#ffd23f", "#e2725b"], decor: "harvest", look: { name: "Harvest", emoji: "🌽", top: "#e2a33b", bottom: "#7a4a1e", hair: "#ffd23f" }, tune: { name: "Gobble Groove", bpm: 100, bass: [0, 0, 5, 7], root: 45, wave: "triangle", arp: [0, 4, 7, 12, 7, 4, 9, 7] } },
  christmas: { a: "#0e3a2a", b: "#04140e", lights: ["#ff4f4f", "#7dffc2", "#ffd23f"], decor: "snow", look: { name: "Elf", emoji: "🎄", top: "#2fa84f", bottom: "#c62828", hair: "#ffffff" }, tune: { name: "Jingle Jam", bpm: 112, bass: [0, 5, 7, 5], root: 48, wave: "square", arp: [12, 12, 12, 7, 12, 12, 12, 9] } },
  newyear: { a: "#151a4a", b: "#05061a", lights: ["#ffd23f", "#c9b6ff", "#9fe8ff"], decor: "confetti", look: { name: "Party Sparkle", emoji: "🥳", top: "#ffd23f", bottom: "#151a4a", hair: "#c9b6ff" }, tune: { name: "Countdown Pop", bpm: 120, bass: [0, 7, 5, 3], root: 45, wave: "sawtooth", arp: [0, 7, 12, 16, 12, 7, 4, 7] } },
  valentine: { a: "#5a1438", b: "#1a0410", lights: ["#ff7aa8", "#ffc2d9", "#ff4f7a"], decor: "hearts", look: { name: "Sweetheart", emoji: "💝", top: "#ff7aa8", bottom: "#c2185b", hair: "#ffc2d9" }, tune: { name: "Heartbeat Hop", bpm: 108, bass: [0, 4, 7, 4], root: 47, wave: "triangle", arp: [0, 4, 7, 11, 7, 4, 12, 7] } },
  spring: { a: "#2a6a5a", b: "#0c241e", lights: ["#ffd6f5", "#b8ff9a", "#ffe08a"], decor: "flowers", look: { name: "Blossom", emoji: "🌸", top: "#ffd6f5", bottom: "#7dc27d", hair: "#ffe08a" }, tune: { name: "Bloom Bounce", bpm: 110, bass: [0, 5, 9, 7], root: 48, wave: "triangle", arp: [0, 4, 7, 9, 12, 9, 7, 4] } },
  summer: { a: "#1a8acb", b: "#0a2a4a", lights: ["#ffe08a", "#58c8ff", "#ff9a5a"], decor: "beach", look: { name: "Beach Day", emoji: "🏖️", top: "#58c8ff", bottom: "#ffe08a", hair: "#ff9a5a" }, tune: { name: "Sunny Splash", bpm: 116, bass: [0, 7, 9, 5], root: 46, wave: "square", arp: [0, 7, 12, 14, 12, 7, 9, 4] } },
  july4: { a: "#13235a", b: "#060a1e", lights: ["#ff4f4f", "#ffffff", "#58a8ff"], decor: "stars", look: { name: "Stars & Stripes", emoji: "🎇", top: "#ff4f4f", bottom: "#2a4aa8", hair: "#ffffff" }, tune: { name: "Firecracker Funk", bpm: 118, bass: [0, 5, 7, 0], root: 43, wave: "sawtooth", arp: [0, 7, 12, 7, 0, 7, 16, 12] } },
};
export const seasonLabel = (s) => (SEASONS[s] ? SEASONS[s].label : "");
/** Event challenge key: once per season per year (New Year counts by the year it ends in). */
export function eventKey(s, now = new Date()) { const { y, m } = nyParts(now); return s + "-" + (s === "newyear" && m === 12 ? y + 1 : y); }
export const EVENT_GOAL = 60;
