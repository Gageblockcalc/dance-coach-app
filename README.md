Dance Coach PWA. Static; deploy: npx wrangler pages deploy . --project-name dancecoach

## Android app (Capacitor 7, native)
- Web assets in `dist/` (built by `npm run build`) are bundled into the APK — no remote URL, works offline. MediaPipe wasm + pose model are bundled in `vendor/`.
- Native plugins: Haptics, LocalNotifications (daily reminder, opt-in), SplashScreen, StatusBar; CAMERA permission for on-device getUserMedia.
- Build: JDK 21 + Android SDK 35, then `npm ci && npm run android` → `android/app/build/outputs/apk/debug/app-debug.apk` (debug-signed).
- Web deploy: `npm run deploy` (deploys `dist/` to Cloudflare Pages project `dancecoach`).
- Store assets: `store-assets/` (512 icon, 1024x500 feature graphic, 1080x1920 screenshots).
