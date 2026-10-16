// Seasonal, family-friendly dance puns. Picks a season by America/New_York date; ?season=halloween|thanksgiving|winter|newyear|valentine|general overrides (testing).
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
  winter: { label: "❄️ Winter holidays", lines: [
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
};
function nyParts(d = new Date()) { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(d).map((x) => [x.type, +x.value || x.value])); return { y: +p.year, m: +p.month, d: +p.day }; }
export function seasonFor(date = new Date()) {
  const { y, m, d } = nyParts(date);
  if (m === 10) return "halloween";
  if (m === 11) { const first = new Date(Date.UTC(y, 10, 1)).getUTCDay(); const thu = 1 + ((4 - first + 7) % 7) + 21; return d <= thu + 3 ? "thanksgiving" : "general"; }
  if (m === 12) return "winter";
  if (m === 1 && d <= 7) return "newyear";
  if (m === 2 && d <= 14) return "valentine";
  return "general";
}
export function season() { const o = new URLSearchParams(location.search).get("season"); if (o && (SEASONS[o] || o === "general")) return o; return seasonFor(); }
export function seasonLine() { const s = SEASONS[season()]; return s ? s.lines[Math.floor(Math.random() * s.lines.length)] : null; }
