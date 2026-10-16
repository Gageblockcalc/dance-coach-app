# Closed test (required for new personal developer accounts)
Rule: before you can apply for production, at least **12 testers** must be **opted in** to a closed test **for 14 days in a row**. Opt-outs reset the count, so recruit ~15–20.

## Steps (Nick, in Play Console)
1. Finish identity verification (pending).
2. Create app: name "Dance Coach: Move & Score", default language English (US), App, Free. Accept declarations.
3. Setup > App integrity: keep **Play App Signing** on (Google holds the app signing key; your upload key is /home/box/secure/dancecoach-upload.jks — back it up).
4. App content: privacy policy URL https://dancecoach.pages.dev/privacy.html; ads = No; app access = all features available without login; content rating (content-rating.md); target audience; data safety (data-safety.md); government/financial/health declarations = No (Health: it's general fitness, no health data).
5. Store listing: paste listing.md; upload icon-512.png, feature-graphic-1024x500.png, 2–8 phone screenshots.
6. Testing > Closed testing > Create track > Testers: create an email list (Google account emails of testers) or use a Google Group.
7. Create release > upload /workspace/play/dance-coach-release.aab > notes "First test build" > review > roll out to closed testing.
8. Copy the opt-in link and send it with the message below.
9. Wait 14 days with ≥12 opted in, collect feedback, ship fixes as new versionCodes.
10. Dashboard > Apply for production; answer the questions about testing.

## Invite message (Nick sends himself)
> Hey! I made a free dance game called Dance Coach — your phone camera scores your moves (nothing gets uploaded). Google needs testers before it can go public. Could you:
> 1) open this link on your Android phone with your Google account: <OPT-IN LINK>
> 2) tap "Become a tester", then install from Play
> 3) keep it installed for at least 14 days (open it a few times!)
> Feedback to tekjeep@gmail.com is super welcome. Thanks! — Nick

## Checklist
- [ ] Identity verified
- [ ] Keystore + password backed up off the box (password manager + USB)
- [ ] App content forms done
- [ ] Listing + graphics uploaded
- [ ] AAB uploaded to closed track, rolled out
- [ ] ≥12 testers opted in (target 15–20) — date started: ____
- [ ] Day 14 reached without dropping below 12
- [ ] Applied for production
