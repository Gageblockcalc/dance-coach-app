// MediaPipe pose in a Web Worker (CPU/wasm or GPU via OffscreenCanvas when available).
let lm = null;
self.onmessage = async (e) => {
  const d = e.data;
  if (d.init) {
    try {
      const m = await import(d.base + "/vendor/vision_bundle.mjs");
      const fs = await m.FilesetResolver.forVisionTasks(d.base + "/vendor/wasm");
      const o = { baseOptions: { modelAssetPath: d.base + "/vendor/pose_landmarker_lite.task", delegate: d.delegate }, runningMode: "VIDEO", numPoses: 1 };
      if (d.delegate === "GPU") o.canvas = new OffscreenCanvas(1, 1);
      lm = await m.PoseLandmarker.createFromOptions(fs, o); self.postMessage({ ready: true });
    } catch (err) { self.postMessage({ error: String(err).slice(0, 120) }); }
    return;
  }
  if (d.frame && lm) { const t = performance.now(); let n = 0; try { n = lm.detectForVideo(d.frame, d.ts).landmarks?.[0]?.length || 0; } catch {} d.frame.close(); self.postMessage({ ms: performance.now() - t, n }); }
};
