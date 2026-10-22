# Credits
- Music: "Neon Pulse", "Bubble Bounce", "Sunset Groove", "Glow Up" are original patterns synthesized live in the app (Web Audio API). No samples. Released CC0.
- Hit sounds, count-in cue and drums are synthesized live too (original, CC0).
- Pose tracking: MediaPipe Tasks Vision 0.10.14 (Apache-2.0), bundled in `/vendor` (from npm @mediapipe/tasks-vision); Pose Landmarker Lite model (Apache-2.0) from Google MediaPipe models.
- Coach routine and scoring adapted from OPPS Dance Coach (Nick Duncan, original moves).

## Sound effects (`/sfx`, each in .ogg plus a converted .mp3 fallback)

| File | Original | Source | License |
|---|---|---|---|
| click1 | Kenney Interface Sounds `click_001.ogg` | https://kenney.nl/assets/interface-sounds | CC0 1.0 |
| click2 | Kenney Interface Sounds `click_002.ogg` | https://kenney.nl/assets/interface-sounds | CC0 1.0 |
| click3 | Kenney Interface Sounds `click_003.ogg` | https://kenney.nl/assets/interface-sounds | CC0 1.0 |
| click4 | Kenney Interface Sounds `click_004.ogg` | https://kenney.nl/assets/interface-sounds | CC0 1.0 |
| perfect1 | Kenney Interface Sounds `confirmation_001.ogg` | https://kenney.nl/assets/interface-sounds | CC0 1.0 |
| perfect2 | Kenney Interface Sounds `confirmation_002.ogg` | https://kenney.nl/assets/interface-sounds | CC0 1.0 |
| perfect3 | Kenney Interface Sounds `confirmation_003.ogg` | https://kenney.nl/assets/interface-sounds | CC0 1.0 |
| start1 | Kenney Music Jingles `jingles_HIT01.ogg` | https://kenney.nl/assets/music-jingles | CC0 1.0 |
| start2 | Kenney Music Jingles `jingles_HIT05.ogg` | https://kenney.nl/assets/music-jingles | CC0 1.0 |
| start3 | Kenney Music Jingles `jingles_HIT09.ogg` | https://kenney.nl/assets/music-jingles | CC0 1.0 |
| end1 | Kenney Music Jingles `jingles_SAX02.ogg` | https://kenney.nl/assets/music-jingles | CC0 1.0 |
| end2 | Kenney Music Jingles `jingles_SAX05.ogg` | https://kenney.nl/assets/music-jingles | CC0 1.0 |
| end3 | Kenney Music Jingles `jingles_SAX08.ogg` | https://kenney.nl/assets/music-jingles | CC0 1.0 |
| cheer1 | Freesound "AF Crowd Cheer Natural Ending by mglennsound" (trimmed to 4 s, mono) | https://freesound.org/people/mglennsound/sounds/678541/ | CC0 1.0 |
| cheer2 | Freesound "AF Crowd Cheer Clapping Natural Ending by mglennsound" (trimmed to 4 s, mono) | https://freesound.org/people/mglennsound/sounds/678543/ | CC0 1.0 |
| cheer3 | Freesound "cheering and clapping crowd 2 by AlaskaRobotics" (trimmed to 4 s, mono) | https://freesound.org/people/AlaskaRobotics/sounds/221567/ | CC0 1.0 |
| cheer4 | Freesound "small crowd cheering by HowardV" (trimmed to 4 s, mono) | https://freesound.org/people/HowardV/sounds/264377/ | CC0 1.0 |

CC0 = https://creativecommons.org/publicdomain/zero/1.0/ . Attribution is not required but given with thanks to Kenney and the Freesound authors.

## 3D coach
| Asset | Source | License |
|---|---|---|
| Coach avatar `vendor/vrm/coach.vrm` | pixiv Inc. "VRM1_Constraint_Twist_Sample" (three-vrm sample model, textures compressed) | VRM Public License 1.0 (https://vrm.dev/licenses/1.0/): redistribution and modification allowed, commercial use allowed, credit not required |
| `vendor/vrm/vrm-bundle.mjs` | three.js r169 + @pixiv/three-vrm 3.5.5 | MIT |
| Dance and victory motion | Procedural, driven by the game's own choreography | Original |
