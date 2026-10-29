# motorino — technical guide

How to use the engine in a game, how to test with it, how to change it and
how to release it. How it works inside is in
[ARCHITECTURE.md](ARCHITECTURE.md).

## Requirements

| What | Version | Why |
| --- | --- | --- |
| Browser | any current Chrome, Firefox, Safari, Edge | ES modules, Canvas 2D, `OffscreenCanvas` when present, Gamepad API, AudioWorklet for sound |
| Node | 18 or later (CI: 22, 24, 26) | `node --test`, the icon tool |
| Python 3 | any | only for `npm run demo` (`tools/serve.py`) |

No package to install, nothing to build.

## Adding motorino to a game

### As a git submodule (no build step)

```bash
git submodule add https://github.com/MindContact/motorino lib/motorino
git -C lib/motorino checkout v0.1.0
git add .gitmodules lib/motorino
git commit -m "chore: motorino v0.1.0"
```

```js
// src/main.js
import { setupScreen, startLoop, Input } from '../lib/motorino/src/index.js';
```

Anyone cloning the game needs the submodules:
`git clone --recurse-submodules …`, or `git submodule update --init` in an
existing clone. Without them the game fails on its first import.

### From npm

```bash
npm install motorino
```

```js
import { setupScreen, startLoop, Input } from 'motorino';
```

A bundler resolves the bare name. Without one, map it in the page:

```html
<script type="importmap">
{ "imports": { "motorino": "./node_modules/motorino/src/index.js" } }
</script>
```

## A minimal game

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; height: 100%; background: #000; }
  body { display: flex; align-items: center; justify-content: center; }
  canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
</style>
<canvas id="screen"></canvas>
<script type="module" src="src/main.js"></script>
</html>
```

```js
// src/main.js
import {
  setupScreen, startLoop, Input, Camera, parseMap, TileMap, TILE, Body, screenMove,
  bake, drawSprite, drawText,
} from '../lib/motorino/src/index.js';

const ctx = setupScreen(document.getElementById('screen'));
const input = new Input();

const LEVEL = parseMap([
  '####################',
  '#                  #',
  '#        ===       #',
  '#  P               #',
  '####################',
], { ' ': {}, '#': { tile: 1 }, '=': { tile: 2 }, P: { spawn: 'start' } });
const map = new TileMap(LEVEL, { solid: [1], oneWay: [2], edges: { left: 1, right: 1, top: 1, bottom: 1 } });

const start = LEVEL.spawns.find((s) => s.kind === 'start');
const hero = new Body(start.x * TILE + 3, start.y * TILE + 2, 10, 14);
const HERO = bake(['.##.', '#..#', '####', '#..#'], { '#': '#ffd34a' });
const cam = new Camera();
cam.bounds = { x: 0, y: 0, w: map.pixelW, h: map.pixelH };

startLoop({
  update() {
    input.update();
    hero.step(map, {
      move: screenMove(hero, (d) => input.down(d)),
      jump: input.pressed('jump'),
      jumpHeld: input.down('jump'),
      drop: input.down('down'),
    });
    cam.follow(hero.cx, hero.cy);
  },
  draw() {
    const v = cam.view();
    ctx.fillStyle = '#0b0f1a';
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#5f7ea8';
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      if (map.get(x, y)) ctx.fillRect(x * TILE - v.x, y * TILE - v.y, TILE, map.get(x, y) === 2 ? 3 : TILE);
    }
    const f = hero.feet;
    drawSprite(ctx, HERO, f.x - v.x, f.y - v.y, { flip: hero.facing < 0, turn: hero.turn });
    drawText(ctx, 'ARROWS + SPACE', 160, 4, { align: 'center' });
  },
});
```

The order inside `update()` matters: `input.update()` first, then the
simulation, then the camera. Drawing reads state and never changes it.

## Recipes

### Game states

```js
const machine = new StateMachine(game, {
  title: {
    update(m) { if (input.confirm()) m.go('play', { level: 0 }); },
    draw(m, ctx) { drawText(ctx, 'PRESS START', 160, 90, { align: 'center' }); },
  },
  play: {
    enter(m, { level }) { m.game.load(level); },
    update(m) { if (input.pressed('pause')) m.go('pause'); /* … */ },
  },
  pause: { /* … */ },
});
machine.go('title');
// in the loop: machine.update(); machine.draw(ctx);
```

`machine.time` counts the updates since the last `go`: use it for blinking
text and timed transitions instead of a clock.

### Gravity that changes (magnetic boots)

```js
// In update, after step(): in the air, any surface touched becomes the floor
// (this is what examples/demo.js does).
if (!hero.ground) {
  for (const side of ['up', 'down', 'left', 'right']) {
    if (side !== hero.gravity && hero.touch[side]) {
      hero.setGravity(side, map);
      break;
    }
  }
}
```

`hero.touching(map, side)` tells which tile codes are against a side; check
it to allow the flip only on magnetic surfaces. Draw with `turn: hero.turn`
so the sprite stands on the new floor.

### A dialogue

```js
const SCRIPTS = { it: parseScript(SCRIPT_IT), en: parseScript(SCRIPT_EN) };
const progress = new Progress(store.load().progress);
progress.onChange = () => store.save({ progress });
const box = new DialogBox({
  speakers: (id) => ({ eco: { name: 'ECO', color: '#6ad0ff' } })[id],
  onType: () => audio.sfx('blip'),
});

// When the player presses action near a terminal:
const thing = nearest(hero.cx, hero.cy, things, 12);
if (thing && input.pressed('action')) {
  box.open(new Dialog(SCRIPTS[lang], thing.node, progress, { onCall: (n) => game.call(n) }));
}
// In update: while (box.active) the player does not move.
if (box.active) box.update(input);
// In draw, last:
box.draw(ctx, machine.time);
```

### Inventory and archive

```js
const menu = new ListMenu({ title: 'INVENTORY', empty: 'Nothing yet.' });
menu.open(progress.items.map((id) => ({ id, name: ITEMS[id].name, desc: ITEMS[id].desc, icon: ITEMS[id].icon })));
const r = menu.update(input);   // an entry, 'close' or null
```

### Asking before something irreversible

```js
const ask = new ConfirmBox();
ask.open('Start a new game? The saved one is lost.', { yes: 'YES', no: 'NO' });
// update: const a = ask.update(input); if (a === 'yes') newGame();
```

The cursor starts on **no** on purpose.

### Sound with sidicio

```js
import { createSidicioNode, compileSong } from '../lib/sidicio/src/index.js';

const settings = { music: 7, sfx: 8, muted: false, model: 6581 };
const audio = new Audio(settings, { createNode: createSidicioNode, songs: { title: compileSong(TITLE, INSTRUMENTS) }, sfx: SFX });
audio.start();                       // plays now where allowed
input.onFirstGesture = () => audio.start();   // and at the first key or tap
watchFocus({ lost: () => machine.go('pause'), hidden: () => audio.suspend(), shown: () => audio.resume() });
audio.play('title');
```

After changing `settings`, call `audio.applySettings()`.

### Full screen

```js
input.onPress = (action) => { if (action === 'fullscreen') toggleFullscreen(); };
```

Calling it from `update()` does not work: the browser allows full screen
only inside the key or tap event.

### Touch buttons

```html
<div id="touch">
  <button data-action="left">◀</button>
  <button data-action="right">▶</button>
  <button data-action="jump">A</button>
  <button data-action="action">B</button>
</div>
```

`Input` binds every `[data-action]` under `#touch`, adds the class `on`
while a button is held, and adds `touch` to `<body>` at the first touch, so
the CSS can hide the buttons on desktop: `body:not(.touch) #touch { display: none; }`.

### Installable and offline

1. `sw.js` at the game's root: `importScripts('lib/motorino/pwa/sw.js');`
   (with npm: `node_modules/motorino/pwa/sw.js`).
2. `manifest.webmanifest` with name, colours, `display: "fullscreen"` or
   `"standalone"`, and the icons; `<link rel="manifest" href="manifest.webmanifest">`.
3. The icons: an `src/icon.js` exporting
   `ICON = { rows, palette, background }`, then
   `node lib/motorino/tools/icon.mjs src/icon.js icons/`.
4. `registerServiceWorker()` at start.

The service worker is network first, so during development a reload always
gets the latest files; nothing to bump on release.

## Testing a game with motorino

The world modules run in Node, so the levels of a game can be tested like
code. The pattern used by the games built on motorino:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMap, TileMap, TILE, Body, FakeInput } from '../lib/motorino/src/index.js';

test('the first level can be finished', () => {
  const input = new FakeInput();
  const world = new World(LEVELS[0], input);    // the game's own simulation
  for (const frame of REPLAY_LEVEL_1) {          // recorded actions per update
    input.set(frame);
    world.update();
  }
  assert.ok(world.won);
});
```

Keep the simulation deterministic and these tests stay meaningful:

* No `Math.random` in the simulation: use a seeded generator stored in the
  world; pass it to `Camera.view(rand)` if shake must replay.
* No wall clock: count updates.
* Particles and sounds are effects, not state: a solver may stub them.

A **replay** is the list of action sets per update; a **solver** searches
inputs with `FakeInput` until it finishes the level. Both break when the
physics changes, which is the point: they are how a change to `physics.js`
is caught before a player finds an unreachable ledge.

## Working on motorino

```bash
npm test          # node --test test/*.test.mjs
npm run demo      # http://localhost:8140/examples/
```

| Test file | Covers |
| --- | --- |
| `test/physics.test.mjs` | maps, falling, jump height (53 px), the four gravities, walls, velocity kept on a flip, one-way floors, ceiling hits, `touching` |
| `test/dialog.test.mjs` | script parsing and errors, conditions and effects, branches, the archive, translation shapes, `Progress` JSON, `nearest` |
| `test/font.test.mjs` | wrapping, Italian accents |
| `test/ui.test.mjs` | `ConfirmBox` |
| `test/pwa.test.mjs` | the icon tool's PNG |
| `test/readme.test.mjs` | `README.md` and `README.it.md` have the same shape |

The demo (`examples/`) is one room that uses almost every module: magnetic
boots, a terminal with a dialogue, a fuse, a door, the inventory. It is
exposed as `window.demo` in the console. The demo server (`tools/serve.py`)
sends `Cache-Control: no-store`, otherwise Chrome keeps the old modules on a
plain reload.

### Rules for changes

* **Every module starts with a comment** that says what it does, its units
  and formats, and the non-obvious choices. A change that alters one of
  those updates the comment in the same commit, and these documents too.
* **Code, identifiers and comments in English.**
* **Physics changes are breaking changes** for the games: a different jump
  height can make a level impossible. After touching `physics.js`, run the
  tests here and the replays and solvers of every game that uses motorino;
  update `DEFAULT_TUNING` only on purpose, with the measured numbers in the
  tests.
* **No dependencies**, and no Web API in the modules that the simulation
  uses (`tilemap.js`, `physics.js`, `dialog.js`, `progress.js`,
  `interact.js`), so they keep running in Node.
* **Content formats** (maps, sprites, scripts) only grow: a new command or
  legend field is fine, a changed meaning is a major version.
* The two READMEs say the same things: change both in the same commit
  (`test/readme.test.mjs` checks their shape).

### Versioning

Semantic versioning, from 0.1.0. Until 1.0 a minor version may break the
API; the release notes say how. A change of physics tuning, of a content
format or of an exported name is a breaking change.

## Releasing

1. Bump `version` in `package.json` and commit.
2. `git tag vX.Y.Z && git push origin main vX.Y.Z`.
3. The `release` workflow (`.github/workflows/release.yml`) checks that the
   tag matches `package.json`, runs the tests and **stages** the version on
   npm through trusted publishing (OIDC: no token in the repository).
4. A maintainer approves it on npmjs.com, *Staged Packages* tab, with 2FA.
   Until then nothing is public.

`ci.yml` runs the tests on every push to `main` and every pull request, on
Node 22, 24 and 26.

The npm package contains `src/`, `pwa/`, `tools/icon.mjs`, the READMEs and
the licence (about 26 kB packed); tests, demo and these documents stay in
the repository.
