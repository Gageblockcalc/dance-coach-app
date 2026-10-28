// Coach Disco Dan banter: local, clean, family-friendly lines. Jokes/commentary and playful trash talk are separate pools
// so each can be muted on its own. Teasing is aimed at the coach, the disco ball or the beat, never at a real person.
export const JOKES = {
  win: [
    "Huge score! The disco ball just did a happy spin!",
    "That's a winner's wiggle! Take a victory lap around the living room!",
    "If dancing were a sport, you'd need a bigger trophy shelf!",
    "Moves like that should come with a drumroll!",
    "Coach Dan is doing a tiny happy dance on the inside. And the outside!",
    "Boom! The beat wants to be your fan club president!",
    "Those moves just made the disco ball blush with glitter!",
    "Encore! Encore! Even the couch is clapping!",
  ],
  ok: [
    "Solid groove! A little more sparkle and you're a superstar!",
    "Nice one! The disco ball gives you a thumbs up (it doesn't have thumbs, but it means it).",
    "Good dancing! Warm-ups are just encore practice!",
    "Smooth! Even my mustache nodded along.",
  ],
  tryagain: [
    "Every legend has a warm-up round. Go again?",
    "That was just the sound check! The real show is next.",
    "Dancing is like pizza: even the not-perfect ones are pretty great. Try another slice?",
    "Shake it out and have another go, the beat will wait!",
    "Practice makes groovy! One more spin?",
  ],
  combo: [
    "Combo! The beat can't catch you!",
    "Look at that chain of perfect moves, like a conga line of awesome!",
    "Combo power! Somebody call the confetti cannon!",
    "Combo! Your feet are on autopilot to Awesome Town!",
  ],
  streakDays: [
    "Another day, another dance! Your streak is looking toasty!",
    "Dancing every day? Your sneakers must be famous by now!",
    "Streak alive! The calendar is doing a happy dance!",
  ],
};
// Playful teasing (clean). Targets: the coach, the disco ball, the beat, "the floor". Never a real person, never appearance.
export const SMACK = {
  miss: [
    "Was that a new move? The floor wasn't ready for it!",
    "My disco ball tilted its head. It's confused in a fun way!",
    "Careful, I can hear the beat laughing. It's laughing WITH you, I promise!",
    "That wobble almost beat my wobble. Almost!",
    "The beat zigged, you zagged. Next time let's zig together!",
    "Ooh, spicy! The beat and you are not on speaking terms right now.",
  ],
  win: [
    "Not bad! I'd say you're nearly as good as me. Nearly. The mustache is hard to beat!",
    "Okay okay, you win this round! Rematch? I've been practicing my robot arms.",
    "That score is so high my calculator needs a nap!",
    "You dance better than my cartoon knees. Low bar, high five!",
  ],
  lose: [
    "Tough one! Even the disco ball has off days. Rematch?",
    "Round two? I promise the beat will go easy on you. Maybe.",
    "My high score is safe... for now! Come back and take it!",
    "That one was a wobbly pancake. Flip it and try again!",
  ],
  streak: [
    "Show-off! Fine, you're on fire. I'll go find a fire extinguisher.",
    "Hot streak! The beat is sweating, and it doesn't even have a forehead.",
    "Careful, at this rate I'll have to hire a bigger trophy room.",
    "Whoa, slow down! My disco ball is getting dizzy just watching!",
  ],
  start: [
    "Think you can beat your best? The disco ball is betting on you!",
    "Let's see what you've got, superstar. No pressure. Okay, a little pressure!",
    "Lace up those dancing shoes, the disco ball is warming up its sparkle!",
    "Ready? I've stretched my mustache and everything!",
  ],
};
const lastI = {};
export function pickFrom(arr, key) { if (!arr || !arr.length) return null; let i; do { i = Math.floor(Math.random() * arr.length); } while (arr.length > 1 && i === lastI[key]); lastI[key] = i; return arr[i]; }
/** kind: start|streak|miss|end|combo|streakDays, pct: score for end. Returns {text, from} or null when everything is muted. */
export function banterFor(kind, pct, S) {
  const jokes = S.banter !== false, smack = S.smack !== false;
  if (!jokes && !smack) return null;
  let pj = [], ps = [];
  if (kind === "end") { const w = pct >= 80 ? "win" : pct >= 60 ? "ok" : "tryagain"; pj = JOKES[w]; ps = SMACK[pct >= 80 ? "win" : pct >= 60 ? "win" : "lose"]; if (pct >= 60 && pct < 80) ps = SMACK.win.slice(0, 2); }
  else if (kind === "miss") { ps = SMACK.miss; }
  else if (kind === "streak") { pj = JOKES.combo; ps = SMACK.streak; }
  else if (kind === "start") { ps = SMACK.start; }
  else if (kind === "combo") { pj = JOKES.combo; }
  else if (kind === "streakDays") { pj = JOKES.streakDays; }
  const useSmack = smack && ps.length && (!jokes || Math.random() < 0.4);
  if (useSmack) return { text: pickFrom(ps, "s" + kind), from: "smack" };
  if (jokes && pj.length) return { text: pickFrom(pj, "j" + kind), from: "joke" };
  return null; // e.g. miss with trash talk off: the caller falls back to the classic pool only if banter is on
}
