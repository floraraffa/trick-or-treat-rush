# Trick or Treat Rush: project context

Halloween entry for the **Lenslist Halloween Challenge**, built as a **Snap Web Lens** on the Cruise Rush base
(PlayCanvas 2 + Vite + `@snap/web-lens-api`). The phone plays the Spectacles Lens's campaign too: PLAY opens the
8 nights of 90 s (see NIGHTS below; main.js `showNights` / `playNight`, `saveData.camp = { night, nights: {n: {best,
stars}} }`, the `nights` screen, results stars + NEXT NIGHT, a `#btnBoo` from the boo night, reflexes and the
sniffing light (`sniff`) in main.js, smell's reach in candy.js; the board gets the sum of every night's best; the
levels' 3-minute rounds stay for the Specs WebXR version and tests/play.mjs's full round). The levels' rounds:
players' Bitmojis roam a gothic-storybook haunted village for 180 s,
knock on doors (trick or treat), collect candy, dodge monsters (a ghost and five creatures drawn by the team; keep
going one way and you run on your own; or scare them off with a gem, or turn ghost); the last minute is Monster
Madness. Levels: easy, medium, hard (the first hard tuning was too easy; hard is now meant to be really hard: 4 ghosts
at 4.8 m/s that aim ahead, quick creatures, scarce help). All five creatures walk the village on every level (one per
zombie route); levels differ in speed, keenness, how long a grab slows you (3/4/5 s) and help.
Most candy wins. A trick at a door lets a swarm out of the house (6/7/8 ghosts and creatures by level, `swarm` in
DIFFICULTY: they fan out of the door, then chase the knocker for `trickLife` s) and one time in five also steals all
your candy (`TRICK_ROB`); there is no web trick any more; the giant gem makes you ×5 (it only bumps into walls and towers). There is no giant ghost (removed) and no sprint button (replaced by AUTORUN). Every gem and power-up
lasts 20 s: gems giant / thief / ghost, power-ups candy storm (`rain`: a thundercloud over its player's head, rising
and growing with a giant, with lightning, thunder and rain; the candy, 7–12 a second by level, drops out of its belly)
/ shield / magnet (16 m) / double. How much help a night hands out (street
candy, orbs, gems, scare loot, storm rate) is per level in `DIFFICULTY[level].help`.
The team talks in Spanish (and French); code, comments and commits are in English.

## Platform rules (Snap Web Lenses)

- Static build zipped with `index.html` at the root, relative paths, build ≤ 8 MB unzipped (`npm run pack` keeps it
  under 7.2e6 bytes), `index.html` ≤ 1 MB. Uploaded at my-lenses.snapchat.com; every upload is reviewed again.
- **No network at runtime** (CSP blocks fetch/WebSocket/WebRTC). The API offers only `bitmoji` (the current user's
  avatar; `participant` is reserved and rejected), `leaderboards` (`submitScore`, `show()`), `storage`. Always check
  `isSupported`; outside Snapchat a desktop stub answers (`snapchat.isStub`).
- So live multiplayer between phones is impossible today. The game is built host-authoritative anyway: in Snapchat
  the session is one player (`LoopbackTransport`); `?room=NAME` links real game instances in one desktop browser
  (`BroadcastTransport`) for 2–4 players. Never add fake/bot "players".
- Respect `env(safe-area-inset-*)` (test `?inset=120`), scale motion by frame time, pause on `visibilitychange`.

## Code map

- `src/game/authority.js` the only place that decides shared state (clock, RNG, level, houses 70/20/10 + 15 s cooldown,
  candy, scores, power-ups, gems, monster AI incl. flee/scare/loot, madness, ranking); emits numbered events + 10 Hz snapshots.
  `src/game/view.js` each device's mirror (`playerOf(ev)`: `by` for house/candy/orb events, `id` otherwise).
  `src/game/config.js` every rule number (DIFFICULTY per level, GEMS, POWERUPS, AUTORUN; and the Spectacles Lens's
  campaign: NIGHTS (8 nights of NIGHT_SECONDS = 90 s, the madness their last NIGHT_MADNESS = 30 s, each a `base`
  level + changes, `rob`, `stars` thresholds),
  SKILLS (one learnt per night, kept: knock, powers, boo, gems, dodge, smell, sneak; the eighth night is `final`,
  nothing new; running on its own is not a skill, it works from the first night: the team's call; `skillsOf(n)`,
  SKILL numbers), `nightRules(n)`, `starsFor(n, score)`). `authority.start(roster, level, { night, candyMul })`:
  with a night its rules, length and skills (no orbs before `powers`, a jackpot pays candy then; no gems before
  `gems`; intent `boo` frightens monsters within 7 m (`m.fright`); `sneaking()` halves detection at a walk; smell
  ×2 candy reach); without, the phone's levels exactly as before (180 s, LEVEL_SKILLS). The view carries
  `seconds`, `night`, `skills`, `boo(id)`; the player controller `dodge(dx, dz)`.
  Stars are easy on purpose since the first playtest on the glasses: one for any candy, two and three rising
  gently (70 / 150 on the first night); `tools/calibrate-nights.mjs` (a capable and a casual simulated player)
  asked far too much. Candy rain pieces are candy with
  `spot: -1`, a `land` time and a `gone` time; they don't count towards the street candy. `src/net/session.js` room, host election, routing; `transport.js`.
- Fog: `src/world/heightfog.js` replaces PlayCanvas's `fogPS` chunk globally (height + drifting-noise density, paler
  mist colour low down; tf_* uniforms set each frame by `village.update`), plus lamp halos. No mist sheets or sprites.
- Neighbourhoods: each night of the campaign is played in its own neighbourhood, Burton-style crooked houses dressed
  as `NIGHT_THEMES` (`src/world/themes.js`: italy, france, newyork, buenosaires, modeltown (the striped, neon-signed
  model town in an attic; the trademark name is never used), northpole (aurora, snowfall), transylvania, moon (the
  Earth in the sky)); `themeOfNight(n)` (a room plays the host's night, so its neighbourhood); classic for the levels' rounds. A theme is data merged over `CLASSIC` (sky,
  fog calm/mad, ambient, moonlight, lamp colour, ground/streets/plaza materials and colours, `house` style flags,
  trees, woods, lamp, landmark, skyline); `src/world/hoods.js` builds the pieces (trees, lamps, landmarks with the
  clock where it has hands, skylines, roofs, balconies, extras, craters, snowfall). The plan (layout.js) never
  changes, so neither do the rules or collisions. Code only (painted canvases `earth`, `aurora` in textures.js): no
  file, ~50 KB of code. main.js `useTheme` rebuilds the village (old root destroyed) on the nights screen (the picked
  night's, behind the panel) and at a round's start; `hoods.<id>` names in i18n, shown on the nights screen, the
  lobby and the 3-2-1. Every hood is about as heavy as the classic village or lighter (triangles: moon 67k … transylvania
  131k, classic 129k; mesh instances 48–73, classic 63) and
  builds in ~0.2 s in headless Chromium. Spectacles and Quest still use the classic village.
- `src/world/layout.js` the village plan as pure data (houses, streets, props, colliders, candy/orb spots, patrols,
  spawns), shared by renderer, collisions and authority. `village.js` assembles it (batched by material), `houses.js`
  crooked houses with hinged doors, `props.js`, `sky.js`, `shapes.js` (tube, lathe, roofs, extrude), `collide.js`.
- Monsters: the ghost, and five creatures from the team's T-pose drawings (`src/actors/creatures.js`: `art/creatures/*`
  → `npm run creatures` → `public/assets/monsters/*.webp` + traced `creature-shapes.js`) in the role of the authority's
  'zombie' kind (same rules): catgirl, goggles, lips, catman, longneck. Each is a solid 3D paper-theatre puppet: blob
  parts (heads, round bodies, the ball) are height grids over their true outline, inflated as a union of spheres, rim
  points snapped onto the outline; limbs/necks/gowns/slim bodies are shells over traced profiles (gaps inside a limb
  become a dark groove). The texture is an atlas: the cut-out drawing (fronts) + at half size to its right each part's
  back (quilted from a swatch, `back` in the tool's config, blended into the drawing's colours at the edges). The tool
  also stops the checkerboard fill at thin white lines (`thin`: the cat's whiskers) and finds enclosed checkerboard
  pockets (two flat tones). Meshes are built once per creature and shared by every copy (`geometry()`); arms hang from
  shoulder pivots (swing + hang); `animateCreature` walks, chases (arms reach forward) and flees (arms flail).
  Monster ids are per kind: z1..z5 are the five patrols, so creature = CREATURES[(n - 1 + round) % 5] gives all five
  every round (same on every device). Dev: `dev/creatures.html?name=<creature>` (studio, several sides at once).
- `src/actors/costumes.js` witch hat / pumpkin / horns (head units) and the vampire cape (`capeParts(fit)`, fitted to the
  back `measure()` reads off the Bitmoji's outfit meshes; the collar doesn't swing), split by material (velvet, satin,
  gold, horn, rind, glow). `src/ui/vampire.js` the vampire face drawn for the costume picker.
- `src/actors/` avatar (own Bitmoji via API, default Bitmoji for others, stand-in, costumes on joints; `setGhost`
  swaps in see-through copies of its own materials), player controller (auto-run, ghosts skip colliders), monsters,
  candy/orbs/gems (storm candy drops from the cloud's belly: `cloudOver`), power-up auras (`effects.js`: also the
  storm's cloud (`CLOUD`: over the head, reaching ahead so its belly shows under the HUD, ×`cloudSize(k)` over a giant,
  lifted clear of a camera under it, unfogged) and lightning, a fresh
  fractal channel per strike as camera-facing ribbons with `flashAt(t)` flickers and a ground light; strikes call back
  main.js for the screen flash and thunder, and main feeds `auras.flashAt` to `village.setLightning` every frame; plus
  the rain streaks round the camera).
  `src/camera.js` third/first person (local only).
- Textures: `src/textures.js` loads `public/assets/tex/<name>.webp` + `_n` normal maps made by `npm run textures`
  (`tools/fetch-textures.mjs`, Poly Haven CC0, needs network; in Claude's cloud containers run it with
  `NODE_USE_ENV_PROXY=1`). Credits in `CREDITS.md`.
- `src/ui/ui.js` + `index.html` screens and HUD; `src/ui/i18n.js` en/es/fr/de (`LANGS`): the player picks one in the menu
  with SVG flags (`flags.js`: US, AR, FR, DE, the variety each text is written in; saved as `saveData.lang`, else the
  phone's language; `?lang=de` to test); every new string needs all four (`npm test` checks). How to play is
  `tutorial.js`: eight picture cards with one line each (`tut.<id>`: move, look, knock, candy, monsters, powers, storm, win), shown before the first solo night
  (`saveData.tutorial`) and from HOW TO PLAY. Leaderboard: one Snapchat board per Lens; `submitScore` every night,
  `show()` (Snapchat's panel, friends with their Bitmojis) after each solo night and from the gold 🏆 buttons (menu,
  results); our own results show only the player's 2D Bitmoji and the `bestScore` Snapchat returns; the stub has no
  panel, so the buttons hide on desktop (`?board` shows them). `src/audio.js` synthesised sound + music box (and the
  Bitmoji's cries, the only audio files).
- `src/poses.js` → `npm run clips` → `public/assets/clips.glb` (idle, walk, run, knock, hit, cheer, sad).
- `src/lib/` snap wrapper, `bitmoji-anim.js` (MIT, vendored; added `setSpeed`), meshopt GLB unpacker.
- Snap Specs version (WebXR, the glasses' browser; the Lens is untouched): `specs.html` + `src/specs/main.js`, same
  game code, built by `npm run build:specs` (`vite.specs.config.js` → `dist-specs/index.html`; needs an https host).
  A table-top miniature: the camera hangs from a rig scaled `S` = 24, which follows the Bitmoji; only a round board
  (`BOARD.radius` 0.45 m) is drawn: `village.setBoard` → `tf_clip` in `heightfog.js` discards past the edge (lamp
  halos and candy off the board are disabled), a glowing torus rim marks it. `hands.js`: pinch-drag = joystick in
  the player's space, quick pinch = action (knock / use, play again), still pinch 2 s = hold (back to the menu).
  `panels.js`: canvas cards on the UI layer, hung from `face`, which tags along with the gaze (small FOV). No Snapchat
  API there: default Bitmoji, bests in localStorage, one player. Brighter (`scene.exposure`, ambient ×1.35) because
  see-through displays add light (black is clear). Dev: `specs.html?emulate` (IWER, dev only; `&fov=33`,
  `&emulate=stereo`), `?scale`, `?bright`; test `tests/specs.mjs`.

- Lens Studio 5.15 version for Spectacles (2024): its own repo `trick-or-treat-rush-spectacles` (the .esproj project).
  `npm run lens -- <that folder>` (`tools/lens-studio/export.mjs`) fills its Assets/: the shared modules converted to
  TypeScript (`Scripts/Generated`, `// @ts-nocheck`, `performance.now` → `getTime`), and via `dev/lens-export.html`
  (`src/dev/lens-export.js`, headless Chromium) GLBs made with PlayCanvas's GltfExporter (village cut to a 39 m board,
  vertex-clustering decimation, tiling baked into UVs, no normal maps, COLOR_0 marked normalized, a `unit-marker` node
  at 1 m to read the import's unit; lamp `halo-<i>` spots and warm ground pools), `fx.glb` (mist sheets with a tiled
  noise texture, lamp glow card, glow pools per candy/orb/gem, gem beams, aura rings, target/cursor), the default
  Bitmoji rigged (`bitmoji-default.glb`, the Lens's fallback), Bitmoji clips as per-joint local rotations recorded on
  the default Bitmoji (`clips.ts`; Snap's rig: the clips turn the `…_JNT_SSC` scale-compensation nodes, so those
  must be recorded), sounds rendered offline to WAV (`renderOffline`, `musicPhrase` in audio.js), fonts → TTF
  (fontTools). Lens texts: `lens.*` in i18n. Small hooks for it: `createCandy().models`, `ghostParts()` in monsters.js.
  The Lens itself: gaze + pinch (pinch a spot = walk there, a house = go and knock, yourself = power-up, hold =
  steer), pieces ×1.7 and candy ×1.5 on the table; checked by `tools/check` there (tsc + a Node simulation).
  Its night, from fx.glb: four mist sheets + red-violet `mist-mad-*` twins, moon/moon-mad/halo and stars (cards
  turned to the eyes), wisps, bats (`wing-l/r` hinges flapped), the storm's cloud + `bolt-0..2` (flickered by
  the game's `flashAt`, lights flash, thunder), moonlight tint, `night.wav` (the ambience under everything: `src/dev/night-ambience.js`, drawn sample by
  sample on a ring so it loops; barely there: `hush` (the faintest air, two crickets far off, now and then a far
  owl; about 20 dB under the first crickets) by default (`AMBIENCE`), or `soft` / `far` / `chimes` / `marsh`; it
  replaced a wind the team didn't like, then close crickets, then `soft`, both still too much; bats were tried in
  `hush` and dropped: the team didn't like them). First person (VIEW in its menu): the
  village life-size, the eyes at the Bitmoji's (body hidden), real steps move it by the player's pace rules,
  look at your feet + pinch = power-up; back to the table for the results. `--only=fx,sounds` re-exports just
  those steps; `--rules` only the scripts and fonts.
  Round 4: the Lens's panels are the web menu's: `src/dev/lens-ui.js` lays them out (cm; also exported as
  `Generated/lensUi.ts`), `dev/lens-ui.html` draws every plate look (off / on / hover) with index.html's own CSS,
  export.mjs photographs them (Playwright, transparent) into `ui.glb` (a quad per plate, glTF UVs top-left).
  Realism: `tools/fetch-textures.mjs --lens` → `tools/lens-studio/tex/` (2048 px ground and streets, 1024 the rest,
  normal maps; never in public/: the phone Lens's 8 MB), the export keeps normal maps and export.mjs squeezes
  every GLB's images in Node (mozjpeg for opaque, palette PNG for see-through) to fit Spectacles' 25 MB.
  Hands: the Lens project carries SIK 0.17.2 (its scene objects cut from Snap's Essentials sample, hands as
  occluders) and points with SIK's hand rays; pieces ×2.2. Copies from fx.glb go into the board's frame
  (`this.world`), never under a node inside another model (a model's root is ×100 in Lens Studio).
  Round 5: panels move by their `grip` bar (pinch it and the panel hangs on the ray; panels then open at that
  `dock`), open a little over the eyes; a `wrist` panel rides beside a palm turned to the eyes (SIK HandInputData:
  isFacingCamera, palm, index tip; touched by the other hand's fingertip or pointed at); first person walks while a
  pinch is held, the way the hand points (walk pace, auto-run gathers); night light as the web game's (moon 1.2,
  env map exposure 0.5, MOONLIGHT = MOON_CALM) and the mist a dark violet-grey (it is unlit).
  Round 6: see-through fx never write depth and draw in a fixed order (`glowOrder`: ground glows 10, mist 11–14,
  rings 15, cards 16, beams 17, bolts 18, pointer 90: a depth-writing glow card cut square holes in the mist); the
  ghost is solid in the Lens; monsters ×3.5 on the table. Walking: table = point (no pinch, after 0.3 s still) and
  it goes, a pinch (any length) goes there and the destination follows the hand while held; first person = pinches
  with alternate hands are steps, arm swings walk (wrists against each other), hold + point; both = the phone's
  screen as a joystick (SIK's mobile controller sends touches as the Lens's Touch events; a mouse drag in the
  Preview). TAP 0.5 s.
  Round 7: monsters on the table a little taller than the Bitmoji (ghost ×2.2 = PIECE, creatures ×1.87; measured
  model heights in TrickOrTreat.ts); the storm cloud over the Bitmoji's head (table: ×1.5, standing back from the
  eyes just enough to leave the head in sight; first person: ahead, its belly 1 m over the eyes), the storm's candy
  from its belly, bolts stretched to it; costumes in the menu (`costume` plates drawn with the web's round buttons;
  export step `costumes`: costumes.glb, each `costume-<id>` = its joint's frame without scale holding the costume as
  the web fits it on the default Bitmoji, + `Generated/costumes.ts` COSTUME_FIT joint names; Avatar.wear hangs it on
  that joint at the Bitmoji's size); panels open at PANEL_AT (menu 110 cm ahead, 24 cm over the eyes, ×0.8) tipped
  to face the eyes (`faceEyes`); the board starts at 1:80 (sizes S/M/L = 100/80/60, `save.scale` free); both hands
  pinching hold the board (move, turn, part/close = bigger/smaller, round their middle; pinch point = thumb/index
  midpoint); on the table no mist sheets (`fog-puff-*`/`fog-mad-*` cards drifting, turned to the eyes) and the stars
  round the room (`ROOM_SKY` 4.2 m on the eyes; the board's own in first person); the village glb gets `WET`
  roughness and normal scale 1.4 (`tidyGlb` finish) and the scene's env map is the Lens repo's NightSky.hdr
  (`tools/make-night-sky.py`, half the template's daytime light, blue).
  Round 8: the campaign. PLAY opens the `nights` panel (8 `night` tiles: number written over, `lock` look and
  padlock until the night before has been played (however it went), 3 `star` plates each; the picked night's skill, `goal` stars and
  best); the HUD clock counts 1:30 (first 5:00, then shortened); the night's skill is announced after GO and its line is the first hint; boo =
  point at yourself and pinch with no power-up held (HUD says ready / countdown; a gold ring rushes out); dodge
  (reflexes) leaps clear of a chaser within 2.3 m by the authority's latest positions; smell shows a golden
  `ray-dot` light ahead towards the best candy; results light up to 3 `bigstar` plates one by one, then NEXT
  NIGHT / AGAIN / MENU; `save.nights[n] = { best, stars }`, `save.night`. Panel plates that aren't buttons but
  have looks (`star`, `bigstar`) are `Panel.plates` + `setLook`. Timers set by a timer now survive (`later`).
  Then the monsters on the table went to about 1.5× the Bitmoji (ghost ×2.7, creatures ×2.5): ×3.5 was too big,
  the round 7 sizes (×2.2 / ×1.87) too small.
  After the first playtest: the board moves only in MOVE THE TABLE (`startTwo` only in state `place`: both hands
  pinching shrank it mid-night); NEXT NIGHT shows whenever there is a next one, with or without stars.
  Doors that didn't open: at a ready door a pinch knocks first (on the door, the house or the Bitmoji on its step:
  the power-up and the boo no longer take it), and the pointer finds houses by the ray (`houseRay`: a cylinder per
  house up to halfway up its roof, `aimHouse`), not only where it meets the ground (behind a tall house, or far
  past a door straight ahead in first person).
  The Bitmoji's cries (Lens repo: `Assets/Audio/voice-*.wav`, `tools/cut-voices.py`): cut from the voices of a
  Lenslist video (Demucs parts them from the games' sounds); `Sound.cry` on its own channel, one at a time:
  spotted → "oh no" / "Nooo" (6 s apart), grabbed → "AAAH" / scream, a trick's swarm → scream, robbed → "Nooo",
  boo → "Boo!". The phone game has them too: `npm run voices` makes `public/assets/voice/*.mp3` (~30 KB)
  from the Lens repo's WAVs; audio.js `loadVoices` / `cry(names, gap)` (decoded once the audio unlocks), the same
  moments in main.js's onEvent; `tests/play.mjs` checks them. Used with Lenslist's permission (the team has it).
  Growing into a giant (a giant gem) says "Boo!" too, in both. The storm cloud is tied to the top of the head as
  drawn (web: `avatar.headTop()` from the head joint and the worn hat's bounds, `auras.update(…, head)`, ahead a
  fixed 3.5 m, not ×the giant's size; Lens: `Avatar.headTop()` from the rig's head joint + HEAD_TOP / HAT_TOP,
  over the head, rising instead of standing back so the eyes still see the head): a giant's stood far off before.

- Meta Quest version (Unity 6000.0.66f2+, Meta XR Core 207, Platform 201 (the Avatars SDK 40.0.1's samples don't compile
  with Platform 203+), Avatars SDK 40.0.1 (EOF), OpenXR, glTFast, Built-in pipeline): its own repo
  `trick-or-treat-rush-quest`. `npm run quest -- <that folder> [--rules]` (`tools/quest/export.mjs`): `rules-cs.mjs`
  generates C# data (config incl. ready-made NIGHT_RULES, the layout's houses/colliders/spots/patrols, lens-ui panels),
  `texts-cs.mjs` the texts (Quest-only strings: `quest.*`), `trace.mjs` 13 reference rounds (scripted players, a test
  harness only) that its hand-ported C# authority must replay line for line (`tools/check` there: dotnet), assets from
  a scratch `npm run lens` (models, WAVs, fonts) + the phone's voice mp3s, `clips-fbx.mjs` + `blender/clips.py` the poses
  as a Humanoid FBX on our own skeleton (Mixamo names; the Snap in-between joints dropped). The player is their own
  Meta Avatar (SampleAvatarEntity + OvrAvatarAnimationBehavior custom-only, our moves on Meta's Humanoid rig). There a
  `tools/check/unity/compile.py` compiles every script against Unity 6's real assemblies and the packages' real sources
  (player + editor). A rules change here needs the C# port changed there too (the reference rounds catch it).

## Commands

`npm run dev`, `npm run build`, `npm run pack`, `npm run clips`, `npm test` (authority rules),
`npm run test:e2e` (solo night + 3-instance room + Specs in an emulated headset, headless Chromium; slow with software
WebGL), `npm run build:specs`,
`npm run lens -- <Lens Studio project>`, `npm run quest -- <Unity project> [--rules]`, `node tests/showcase.mjs <dir>` (README screenshots), `dev/viewer.html?view=cx,cy,cz,tx,ty,tz` (scene viewer).

## Status

- Verified in headless Chromium only. Pending on a phone inside Snapchat (after review): real Bitmoji + portrait,
  leaderboard, storage, performance, safe areas. Specs version: verified only in the IWER emulator; pending on real
  Specs (pinch as WebXR select on their hands, panel size, brightness, board placement, performance) and a host.
- Store assets in `art/store/`: `icon.png` (512×512, `tools/make-icon.mjs`: the cat creature's head from its drawing
  over a Halloween moon, circle-safe) and `preview-en.mp4` (9 s, 720×1280, 30 fps, silent, `tools/make-preview.mjs`
  with the dev server running: the real game in five shots on a virtual clock that advances 1/30 s per captured frame,
  game timers and CSS animations included, so it is smooth however slowly software WebGL renders).
