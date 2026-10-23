// Thin adapter between Dance Coach and the shared Move to Earn detector (move-to-earn.js, v1.0.0, MIT).
// move-to-earn.js is a VENDORED, UNMODIFIED copy of /workspace/shared/move-to-earn/move-to-earn.js. To update it, copy the file over; do not edit it here.
// Contract used by m2e.js:
//   createSource({ onSteps(n), onShake() }) -> { start(): Promise<{ok, reason?}>, stop() }
// reason: "no-sensor" (no motion events arrive: desktop/TV), "denied" (user said no / not allowed), "unsupported".
// Two detectors share one sensor listener, one counts estimated steps, one counts shakes. Raw samples never leave this file; only counts go on.
import { createDetector, startMotionSensor } from "./move-to-earn.js";

export function createSource({ onSteps, onShake }) {
  let walk = null, shake = null, stopWalk = null, feed = null;
  return {
    async start() {
      this.stop();
      walk = createDetector({ mode: "walk" }); shake = createDetector({ mode: "shake" });
      walk.on("step", () => onSteps(1)); shake.on("shake", () => onShake());
      const r = await startMotionSensor(walk); // must run inside the tap: asks iOS for permission
      if (!r.ok) { walk = shake = null; return { ok: false, reason: r.reason === "nosensor" ? "no-sensor" : r.reason === "unsupported" ? "unsupported" : "denied" }; }
      stopWalk = r.stop;
      const d = shake;
      feed = (e) => { const a = e.accelerationIncludingGravity && e.accelerationIncludingGravity.x != null ? e.accelerationIncludingGravity : e.acceleration; if (a && a.x != null && a.y != null && a.z != null) d.push({ t: performance.now(), x: a.x, y: a.y, z: a.z }); };
      addEventListener("devicemotion", feed);
      return { ok: true };
    },
    stop() {
      if (feed) removeEventListener("devicemotion", feed); feed = null;
      if (stopWalk) stopWalk(); stopWalk = null; walk = shake = null;
    },
  };
}
