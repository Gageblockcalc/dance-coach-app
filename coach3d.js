import { isOwned } from "./m2e.js";
import { UNLOCK, level } from "./progress.js";
/* 3D coach avatar (VRM, MToon toon shading). Lazy-loaded; falls back to the 2D coach. */
const BASE_LOOKS = [
  { id: "classic", name: "Classic", top: "#ffffff", bottom: "#ffffff", hair: "#ffffff" },
  { id: "neon", name: "Neon", top: "#b8ff00", bottom: "#7a5cff", hair: "#ff9cf0" },
  { id: "sunset", name: "Sunset", top: "#ff8a3d", bottom: "#ff4f7a", hair: "#ffd23f" },
  { id: "ocean", name: "Ocean", top: "#58c8ff", bottom: "#2a5cff", hair: "#9fe8ff" },
  { id: "mint", name: "Mint", top: "#7dffc2", bottom: "#2fb38a", hair: "#e8fff4" },
];
/* Silly outfits for Move to Earn: original colour tints only, unlocked with Move coins or from mystery crates. */
export const SILLY = [
  { id: "banana", name: "Banana Suit", emoji: "🍌", price: 30, silly: true, top: "#ffe135", bottom: "#ffd400", hair: "#8b5a2b" },
  { id: "duck", name: "Rubber Duck", emoji: "🦆", price: 30, silly: true, top: "#fff04d", bottom: "#ff9d00", hair: "#fff04d" },
  { id: "pickle", name: "Pickle Pal", emoji: "🥒", price: 40, silly: true, top: "#5fbf3a", bottom: "#2e7d32", hair: "#1b5e20" },
  { id: "hotdog", name: "Hot Dog", emoji: "🌭", price: 40, silly: true, top: "#e8743b", bottom: "#ffd36e", hair: "#c0392b" },
  { id: "cone", name: "Traffic Cone", emoji: "🔶", price: 40, silly: true, top: "#ff6a00", bottom: "#ffffff", hair: "#ff6a00" },
  { id: "marsh", name: "Marshmallow Unicorn", emoji: "🦄", price: 50, silly: true, top: "#ffd6f5", bottom: "#c9b6ff", hair: "#7fffd4" },
  { id: "disco", name: "Disco Ball", emoji: "🪩", price: 60, silly: true, top: "#d9d9ff", bottom: "#9aa0ff", hair: "#ffffff" },
  { id: "potato", name: "Couch Potato", emoji: "🥔", price: 60, silly: true, top: "#c8a26b", bottom: "#8a6a3b", hair: "#5c4326" },
];
/* Level rewards: original colour tints, unlocked by playing (XP levels). */
export const LEVEL_LOOKS = [
  { id: "gold", name: "Gold Star", lvl: UNLOCK.gold, top: "#ffd23f", bottom: "#ff9d00", hair: "#fff2b0" },
  { id: "ember", name: "Ember", lvl: UNLOCK.ember, top: "#ff6a3d", bottom: "#8a1c3a", hair: "#ffd23f" },
  { id: "midnight", name: "Midnight", lvl: UNLOCK.midnight, top: "#3a2a8a", bottom: "#0d1240", hair: "#9fe8ff" },
];
export const LOOKS = BASE_LOOKS.concat(LEVEL_LOOKS, SILLY);
export const lookLocked = (l) => (l.silly && !isOwned(l.id)) || (!!l.lvl && level() < l.lvl);
export const getLook = () => { const l = LOOKS.find((x) => x.id === localStorage.getItem("dc.look")) || LOOKS[0]; return lookLocked(l) ? LOOKS[0] : l; };
let T, R, scene, camera, vrm, clock, state = "off", failed = false, lowRun = 0, blinkT = 2, blinkK = 0, mats = [];
const SIZE = 300;
export const coach3dReady = () => state === "ready" && !failed;
export const coach3dState = () => ({ state, failed, lowRun });
export const coach3dCanvas = () => R && R.domElement;
export function coach3dDisable() { failed = true; }
export async function coach3dLoad() {
  if (state !== "off" || failed) return; state = "loading";
  try {
    T = await import("./vendor/vrm/vrm-bundle.mjs");
    const c = document.createElement("canvas"); c.width = c.height = SIZE;
    R = new T.WebGLRenderer({ canvas: c, alpha: true, antialias: false, powerPreference: "low-power" });
    R.setPixelRatio(1); R.setSize(SIZE, SIZE, false); R.outputColorSpace = T.SRGBColorSpace;
    scene = new T.Scene(); camera = new T.PerspectiveCamera(28, 1, 0.1, 20); camera.position.set(0, 0.9, 3.9); camera.lookAt(0, 0.88, 0);
    const d = new T.DirectionalLight(0xffffff, 2.2); d.position.set(1, 2, 3); scene.add(d, new T.AmbientLight(0xffffff, 0.6));
    const loader = new T.GLTFLoader(); loader.register((p) => new T.VRMLoaderPlugin(p));
    const g = await loader.loadAsync("vendor/vrm/coach.vrm");
    vrm = g.userData.vrm; T.VRMUtils.removeUnnecessaryVertices(g.scene); T.VRMUtils.combineSkeletons?.(g.scene);
    vrm.scene.traverse((o) => { o.frustumCulled = false; if (o.material) for (const m of [].concat(o.material)) { if (m.color) mats.push({ m, base: m.color.clone(), n: m.name || "" }); } });
    scene.add(vrm.scene); clock = new T.Clock(); applyLook(); state = "ready";
  } catch (e) { failed = true; state = "off"; console.warn("3D coach unavailable, using 2D", e && e.message); }
}
export function applyLook(l = getLook()) {
  if (!T) return;
  for (const { m, base, n } of mats) { const k = /Tops/.test(n) ? l.top : /Bottoms/.test(n) ? l.bottom : /HAIR/.test(n) ? l.hair : null; m.color.copy(base); if (k) m.color.multiply(new T.Color(k)); }
}
/* pose = 8 screen angles (deg, 0 = down) as used by drawCoach(mirror=true) */
const MAP = [["rightUpperArm", -1, 0], ["rightLowerArm", -1, 0], ["leftUpperArm", 1, 0], ["leftLowerArm", 1, 0], ["rightUpperLeg", 0, -1], ["rightLowerLeg", 0, -1], ["leftUpperLeg", 0, -1], ["leftLowerLeg", 0, -1]];
const qs = [];
export function coach3dRender(pose, beat = 0, fps = 60, mode = "dance", still = false) {
  if (!coach3dReady()) return null;
  // auto quality: sustained low fps -> permanent 2D fallback for this session
  if (fps < 40) { if (++lowRun > 90) { failed = true; return null; } } else lowRun = Math.max(0, lowRun - 2);
  const dt = Math.min(0.05, clock.getDelta()), h = vrm.humanoid, t = clock.elapsedTime;
  const up = new T.Vector3(), rest = new T.Vector3(), q = new T.Quaternion(), inv = new T.Quaternion();
  for (let i = 0; i < 8; i++) {
    const [bone, rx, ry] = MAP[i], node = h.getNormalizedBoneNode(bone); if (!node) continue;
    const a = (pose[i] * Math.PI) / 180; up.set(-Math.sin(a), -Math.cos(a), 0.05).normalize(); rest.set(rx, ry, 0);
    q.setFromUnitVectors(rest, up); qs[i] = (qs[i] || new T.Quaternion()).copy(q);
    if (i % 2) { inv.copy(qs[i - 1]).invert(); q.premultiply(inv); }
    node.quaternion.slerp(q, still ? 1 : 0.5);
  }
  const ph = beat * Math.PI, hips = h.getNormalizedBoneNode("hips"), sp = h.getNormalizedBoneNode("spine"), hd = h.getNormalizedBoneNode("head");
  const bounce = still ? 0 : mode === "victory" ? Math.abs(Math.sin(t * 6)) * 0.08 : Math.abs(Math.sin(ph)) * 0.035;
  if (hips) { hips.userData.y0 ??= hips.position.y; hips.position.y = hips.userData.y0 + bounce; hips.rotation.y = still ? 0 : mode === "victory" ? Math.sin(t * 3) * 0.35 : Math.sin(ph / 2) * 0.12; }
  if (sp) sp.rotation.x = Math.sin(t * 1.6) * 0.02; // breathing
  if (hd) hd.rotation.z = still ? 0 : Math.sin(ph / 2) * 0.08;
  const ex = vrm.expressionManager; if (ex) { blinkT -= dt; if (blinkT < 0) { blinkK = 0.15; blinkT = 2 + Math.random() * 3; } blinkK = Math.max(0, blinkK - dt); ex.setValue("blink", blinkK > 0 ? 1 : 0); ex.setValue("happy", mode === "victory" ? 1 : 0.3); }
  vrm.update(still ? 0 : dt); R.render(scene, camera); return R.domElement;
}
