# Data safety — draft answers (verified against code, Oct 15 2026)

**Does your app collect or share any required user data types?** No.

Verification:
- Android app loads everything from bundled assets (`https://localhost` Capacitor origin). The pose model and MediaPipe wasm are bundled in `vendor/` (app.js lines 6–7). The only `fetch()` calls load bundled sound files (ui.js) and the service worker caches same-origin files. No analytics, ads SDKs, crash reporters, or accounts.
- Camera frames are processed in memory by MediaPipe on the device and never sent anywhere.
- Settings, scores, streak, language, rewards live in localStorage on the device only.
- Notifications: @capacitor/local-notifications, scheduled on device. No FCM/push server.
- Clips: created with MediaRecorder on device; leave only if the user saves/shares.
- External links (TekJeep, GageBlockCalc, Buy Me a Coffee, GitHub, mailto feedback) open only when tapped; the app sends nothing itself.
- Permissions: CAMERA, POST_NOTIFICATIONS, VIBRATE, INTERNET (INTERNET is Capacitor default; used only if the user taps an outside link).

Form answers:
- Data collected: none. Data shared: none.
- Is data encrypted in transit? N/A (nothing transmitted) — answer "Yes" is not required when nothing is collected.
- Can users request deletion? N/A; uninstall/clear data removes all local data.
- Account creation: No.
- Independent security review: No.
- Families policy: not targeting children as primary audience (see content-rating.md); suitable for all ages.
