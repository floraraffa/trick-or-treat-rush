# Trick or Treat Rush: project context

Halloween entry for the **Lenslist Halloween Challenge**, built as a **Snap Web Lens** on the Cruise Rush base
(PlayCanvas 2 + Vite + `@snap/web-lens-api`). Players' Bitmojis roam a gothic-storybook haunted village for 180 s,
knock on doors (trick or treat), collect candy, dodge monsters (a ghost and four creatures drawn by the team; keep
going one way and you run on your own; or scare them off with a gem, or turn ghost); the last minute is Monster
Madness. Levels: easy, medium, hard (the first hard tuning was too easy; hard is now meant to be really hard: 4 ghosts
at 4.8 m/s that aim ahead, 3 creatures, scarce help).
Most candy wins. A trick at a door steals all your candy one time in five (`TRICK_ROB`); the giant gem makes you ×7. There is no giant ghost (removed) and no sprint button (replaced by AUTORUN). Every gem and power-up
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
- Monsters: the ghost, and four creatures from the team's drawings (`src/actors/creatures.js`: `art/creatures/*.jpg` →
  `npm run creatures` → `public/assets/monsters/*.webp`) in the role of the authority's 'zombie' kind (same rules). Each
  is a 3D paper-theatre puppet: parts are drawing cut-outs puffed into pillows/rods/balls, the drawing projected
  straight onto their fronts (outlines are in drawing pixels), plain colour behind; `animateCreature` walks them.
  Which creature a monster is comes from its id + the round (same on every device). Dev: `dev/viewer.html?creatures`.
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
- `src/ui/ui.js` + `index.html` screens and HUD; `src/ui/i18n.js` en/es/fr. `src/audio.js` synthesised sound + music box.
- `src/poses.js` → `npm run clips` → `public/assets/clips.glb` (idle, walk, run, knock, hit, cheer, sad).
- `src/lib/` snap wrapper, `bitmoji-anim.js` (MIT, vendored; added `setSpeed`), meshopt GLB unpacker.

## Commands

`npm run dev`, `npm run build`, `npm run pack`, `npm run clips`, `npm test` (authority rules),
`npm run test:e2e` (solo night + 3-instance room in headless Chromium; slow with software WebGL),
`node tests/showcase.mjs <dir>` (README screenshots), `dev/viewer.html?view=cx,cy,cz,tx,ty,tz` (scene viewer).

## Status

- Verified in headless Chromium only. Pending on a phone inside Snapchat (after review): real Bitmoji + portrait,
  leaderboard, storage, performance, safe areas. Team still owes the icon and the preview video.
