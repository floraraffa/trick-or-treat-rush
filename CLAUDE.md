# Trick or Treat Rush: project context

Halloween entry for the **Lenslist Halloween Challenge**, built as a **Snap Web Lens** on the Cruise Rush base
(PlayCanvas 2 + Vite + `@snap/web-lens-api`). Players' Bitmojis roam a gothic-storybook haunted village for 180 s,
knock on doors (trick or treat), collect candy, dodge monsters (a ghost and five creatures drawn by the team; keep
going one way and you run on your own; or scare them off with a gem, or turn ghost); the last minute is Monster
Madness. Levels: easy, medium, hard (the first hard tuning was too easy; hard is now meant to be really hard: 4 ghosts
at 4.8 m/s that aim ahead, quick creatures, scarce help). All five creatures walk the village on every level (one per
zombie route); levels differ in speed, keenness, how long a grab slows you (3/4/5 s) and help.
Most candy wins. A trick at a door lets a swarm out of the house (6/7/8 ghosts and creatures by level, `swarm` in
DIFFICULTY: they fan out of the door, then chase the knocker for `trickLife` s) and one time in five also steals all
your candy (`TRICK_ROB`); there is no web trick any more; the giant gem makes you ×5 (it only bumps into walls and towers). There is no giant ghost (removed) and no sprint button (replaced by AUTORUN). Every gem and power-up
lasts 20 s: gems giant / thief / ghost, power-ups candy storm (`rain`: a thundercloud with lightning, thunder and rain
that pours candy, 7–12 a second by level) / shield / magnet (16 m) / double. How much help a night hands out (street
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
  `src/game/config.js` every rule number (DIFFICULTY per level, GEMS, POWERUPS, AUTORUN). Candy rain pieces are candy with
  `spot: -1`, a `land` time and a `gone` time; they don't count towards the street candy. `src/net/session.js` room, host election, routing; `transport.js`.
- Fog: `src/world/heightfog.js` replaces PlayCanvas's `fogPS` chunk globally (height + drifting-noise density, paler
  mist colour low down; tf_* uniforms set each frame by `village.update`), plus lamp halos. No mist sheets or sprites.
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
  candy/orbs/gems (storm candy falls in), power-up auras (`effects.js`: also the storm's cloud and lightning, a fresh
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
  panel, so the buttons hide on desktop (`?board` shows them). `src/audio.js` synthesised sound + music box.
- `src/poses.js` → `npm run clips` → `public/assets/clips.glb` (idle, walk, run, knock, hit, cheer, sad).
- `src/lib/` snap wrapper, `bitmoji-anim.js` (MIT, vendored; added `setSpeed`), meshopt GLB unpacker.

## Commands

`npm run dev`, `npm run build`, `npm run pack`, `npm run clips`, `npm test` (authority rules),
`npm run test:e2e` (solo night + 3-instance room in headless Chromium; slow with software WebGL),
`node tests/showcase.mjs <dir>` (README screenshots), `dev/viewer.html?view=cx,cy,cz,tx,ty,tz` (scene viewer).

## Status

- Verified in headless Chromium only. Pending on a phone inside Snapchat (after review): real Bitmoji + portrait,
  leaderboard, storage, performance, safe areas.
- Store assets in `art/store/`: `icon.png` (512×512, `tools/make-icon.mjs`: the cat creature's head from its drawing
  over a Halloween moon, circle-safe) and `preview-en.mp4` (9 s, 720×1280, 30 fps, silent, `tools/make-preview.mjs`
  with the dev server running: the real game in five shots on a virtual clock that advances 1/30 s per captured frame,
  game timers and CSS animations included, so it is smooth however slowly software WebGL renders).
