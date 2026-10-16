const $ = (s) => document.querySelector(s), base = location.origin, cam = $("#cam"), cv = $("#cv"), g = cv.getContext("2d");
const DUR = +(new URLSearchParams(location.search).get("dur") || 6000);
const caps = { webgpu: !!navigator.gpu, simd: WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11])), threads: typeof SharedArrayBuffer !== "undefined" && self.crossOriginIsolated, offscreen: typeof OffscreenCanvas !== "undefined" };
$("#caps").textContent = `WebGPU ${caps.webgpu ? "✅" : "❌"} · WASM SIMD ${caps.simd ? "✅" : "❌"} · WASM threads ${caps.threads ? "✅" : "❌ (needs cross-origin isolation)"} · OffscreenCanvas ${caps.offscreen ? "✅" : "❌"}`;
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; };
const loadScript = (src) => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
let mpMod = null, mpFs = null;
async function mp(delegate, inres) {
  mpMod ??= await import(base + "/vendor/vision_bundle.mjs"); mpFs ??= await mpMod.FilesetResolver.forVisionTasks(base + "/vendor/wasm");
  const lm = await mpMod.PoseLandmarker.createFromOptions(mpFs, { baseOptions: { modelAssetPath: base + "/vendor/pose_landmarker_lite.task", delegate }, runningMode: "VIDEO", numPoses: 1 });
  let sc = null, sg = null;
  return { name: `MediaPipe ${delegate}${inres ? " @" + inres + "px" : ""}`, backend: delegate === "GPU" ? "WebGL (GPU delegate)" : "WASM (XNNPACK)", detect: (ts) => { let src = cam; if (inres) { const k = inres / Math.max(cam.videoWidth, cam.videoHeight); sc ??= Object.assign(document.createElement("canvas"), { width: Math.round(cam.videoWidth * k), height: Math.round(cam.videoHeight * k) }); sg ??= sc.getContext("2d"); sg.drawImage(cam, 0, 0, sc.width, sc.height); src = sc; } return (lm.detectForVideo(src, ts).landmarks?.[0]?.length || 0) > 0; }, close: () => lm.close() };
}
async function tf(backend) {
  await loadScript("bench/tf/tf.min.js");
  if (backend === "wasm") { await loadScript("bench/tf/tf-backend-wasm.min.js"); window.tf.wasm.setWasmPaths(base + "/bench/tf/"); }
  if (backend === "webgpu") { if (!caps.webgpu) throw new Error("WebGPU unavailable"); await loadScript("bench/tf/tf-backend-webgpu.min.js"); }
  await loadScript("bench/tf/pose-detection.min.js");
  await window.tf.setBackend(backend); await window.tf.ready();
  const pd = window.poseDetection, det = await pd.createDetector(pd.SupportedModels.MoveNet, { modelType: pd.movenet.modelType.SINGLEPOSE_LIGHTNING, modelUrl: base + "/bench/movenet/model.json" });
  return { name: `TF.js MoveNet ${backend}`, backend: window.tf.getBackend(), detectAsync: async () => ((await det.estimatePoses(cam))[0]?.keypoints?.length || 0) > 0, close: () => det.dispose() };
}
async function worker(delegate) {
  const w = new Worker(base + "/bench/worker.js", { type: "module" });
  await new Promise((res, rej) => { w.onmessage = (e) => (e.data.ready ? res() : rej(new Error(e.data.error))); w.postMessage({ init: 1, base, delegate }); });
  let pending = null;
  return { name: `MediaPipe ${delegate} in Worker`, backend: delegate === "GPU" ? "WebGL in worker" : "WASM in worker", worker: true,
    detectAsync: async (ts) => { const bmp = await createImageBitmap(cam); return new Promise((res) => { w.onmessage = (e) => res(e.data); w.postMessage({ frame: bmp, ts }, [bmp]); }); }, close: () => w.terminate() };
}
// Runs `eng` for DUR ms. Sync engines block the frame; async/worker engines run concurrently with rAF drawing.
async function run(eng) {
  const ms = [], frames = []; let found = 0, n = 0, busy = false, stop = false, last = performance.now(), ts = 0;
  const draw = (now) => { frames.push(now - last); last = now; g.drawImage(cam, 0, 0, cv.width, cv.height);
    if (eng.detect) { const t = performance.now(); if (eng.detect(++ts * 33)) found++; ms.push(performance.now() - t); n++; }
    else if (!busy) { busy = true; const t = performance.now(); eng.detectAsync(++ts * 33).then((r) => { const okk = typeof r === "object" ? r.n > 0 : r; if (okk) found++; ms.push(typeof r === "object" && r.ms != null ? r.ms : performance.now() - t); n++; busy = false; }).catch(() => (busy = false)); }
    if (!stop) requestAnimationFrame(draw); };
  for (let i = 0; i < 5; i++) { try { eng.detect ? eng.detect(++ts * 33) : await eng.detectAsync(++ts * 33); } catch {} } // warm-up
  await new Promise((res) => { requestAnimationFrame(draw); setTimeout(() => { stop = true; res(); }, DUR); });
  const fps = frames.length / (DUR / 1000);
  return { ms: med(ms), fps, found: n ? Math.round((found / n) * 100) : 0, n };
}
function scoringBench() { // plain-JS scoring cost (angles + similarity) with synthetic landmarks
  const lm = Array.from({ length: 33 }, (_, i) => ({ x: Math.random(), y: Math.random(), visibility: 0.9 })), SEGS = [[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28]];
  const t = performance.now(); let acc = 0; for (let k = 0; k < 20000; k++) { for (const [i, j] of SEGS) acc += Math.atan2(lm[j].x - lm[i].x, lm[j].y - lm[i].y); } return ((performance.now() - t) / 20000).toFixed(4);
}
const OPTS = [["mp-cpu", () => mp("CPU")], ["mp-gpu", () => mp("GPU")], ["mp-cpu-256", () => mp("CPU", 256)], ["mp-worker-cpu", () => worker("CPU")], ["mp-worker-gpu", () => worker("GPU")], ["tf-wasm", () => tf("wasm")], ["tf-webgl", () => tf("webgl")], ["tf-webgpu", () => tf("webgpu")]];
window.dcBenchResults = [];
$("#go").onclick = async () => {
  $("#go").disabled = true; $("#tb").innerHTML = "";
  try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }); cam.srcObject = s; await cam.play(); } catch (e) { $("#st").textContent = "Camera needed: " + e.message; $("#go").disabled = false; return; }
  const only = new URLSearchParams(location.search).get("only"); const list = only ? OPTS.filter(([k]) => only.split(",").includes(k)) : OPTS;
  for (const [key, mk] of list) {
    $("#st").textContent = "Running " + key + "…"; const row = document.createElement("tr"); $("#tb").append(row); const t0 = performance.now(); let eng;
    try { eng = await mk(); const init = ((performance.now() - t0) / 1000).toFixed(1); const r = await run(eng); eng.close?.();
      const res = { key, name: eng.name, backend: eng.backend, init: +init, ms: +r.ms.toFixed(1), fps: +r.fps.toFixed(1), found: r.found, n: r.n }; window.dcBenchResults.push(res);
      row.innerHTML = `<td>${res.name}</td><td>${res.backend}</td><td>${init}</td><td>${res.ms}</td><td>${res.fps}</td><td>${res.found}%</td>`;
    } catch (e) { window.dcBenchResults.push({ key, error: String(e.message || e).slice(0, 80) }); row.innerHTML = `<td>${key}</td><td colspan="5">skipped: ${String(e.message || e).slice(0, 80)}</td>`; }
  }
  window.dcBenchResults.push({ key: "js-scoring", msPerFrame: +scoringBench() });
  const ok = window.dcBenchResults.filter((r) => r.fps); ok.sort((a, b) => b.fps - a.fps || a.ms - b.ms);
  $("#best").textContent = ok[0] ? `Smoothest on this device: ${ok[0].name} (${ok[0].fps} FPS, ${ok[0].ms} ms/inference).` : "";
  $("#json").textContent = JSON.stringify({ ua: navigator.userAgent, caps, results: window.dcBenchResults }, null, 1);
  cam.srcObject.getTracks().forEach((t) => t.stop()); $("#st").textContent = "Done."; $("#go").disabled = false; window.dcBenchDone = true;
};
