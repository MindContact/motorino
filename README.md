# motorino

Small 2D game engine in vanilla JavaScript: ES modules, no dependencies, no
build. A 320×180 pixel screen, a fixed 60 Hz loop, and everything a small
platformer or adventure needs: input, bitmap font, sprites and maps written as
text, physics with gravity in four directions, dialogues, menus, saving, PWA.

[Italiano](README.it.md)

## Install

```bash
npm install motorino
```

or as a git submodule, which is how a game without a build step usually
carries it:

```bash
git submodule add https://github.com/MindContact/motorino lib/motorino
```

In the browser, import it by path (or map `motorino` with an import map):

```js
import { startLoop, setupScreen, Input } from './lib/motorino/src/index.js';
```

Sound is optional: motorino does not depend on
[sidicio](https://github.com/MindContact/sidicio); a game that wants SID audio
passes sidicio's `createSidicioNode` to `audio.js`, so it picks the version.

## Modules (`src/`, all re-exported by `src/index.js`)

| Module | What |
| --- | --- |
| `loop.js` | fixed 60 Hz step with an accumulator, one draw per frame |
| `screen.js` | the 320×180 canvas and its whole-number scaling |
| `input.js` | keyboard, gamepad, touch → actions; `FakeInput` for tests |
| `font.js` | 5×7 bitmap font with Italian accents, `wrapText` |
| `sprites.js` | sprites drawn as text, baked; drawn mirrored and turned |
| `camera.js` | eased camera clamped to bounds, with shake |
| `particles.js` | cosmetic particles with a gravity vector |
| `i18n.js` | strings per language, `pick({ it, en }, lang)` |
| `states.js` | state machine for the game shell |
| `storage.js` | save to localStorage, never throws |
| `tilemap.js` | maps drawn as text with a legend; live `TileMap` |
| `physics.js` | platformer `Body` with gravity in four directions |
| `dialog.js` | dialogue scripts as text: lines, choices, flags, items |
| `progress.js` | flags, inventory, archive of read texts |
| `interact.js` | nearest usable thing within reach |
| `ui.js` | panels, dialogue box, list menu (inventory/archive), yes/no box, prompt |
| `audio.js` | sidicio worklet glue; the game passes sidicio in |
| `focus.js` | `watchFocus`: pause when the tab hides or the window loses focus |
| `fullscreen.js` | full screen toggle (key F in `DEFAULT_KEYS`) |
| `pwa.js` | `registerServiceWorker`: installable, playable offline |

Gravity, the dialogue script format and the conventions are documented in
the head comment of each module.

## PWA

A game becomes installable and plays offline with:

* `sw.js` at its root: `importScripts('lib/motorino/pwa/sw.js');` (network
  first; every answer cached; offline the last good copy).
* `manifest.webmanifest` and `<link rel="manifest">` in its page.
* icons from pixel art: `node lib/motorino/tools/icon.mjs src/icon.js icons/`
  (32, 180, 192, 512 px; the art in the middle 3/4, good as maskable).
* `registerServiceWorker()` from `src/pwa.js` once the game starts.

With npm, the paths start from `node_modules/motorino/` instead.

## Development

```bash
npm test          # node --test
npm run demo      # http://localhost:8140/examples/
```

The demo is one station room: magnetic boots (jump at a wall or the ceiling
and it becomes the floor), ECO on a terminal, a fuse, a door, the inventory.
Arrows move, Space jumps, E uses, I opens the inventory.

The two READMEs say the same things; a test checks that they keep the same
shape.

How it works inside (loop, input, physics, dialogue, widgets, sound, PWA) is
in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); recipes, testing a game and
the rules for changes in [docs/TECHNICAL.md](docs/TECHNICAL.md) (both in
English).

### Releasing

1. Bump `version` in `package.json` and commit.
2. `git tag vX.Y.Z && git push origin main vX.Y.Z`.
3. The `release` workflow runs the tests and stages the version on npm
   through trusted publishing (no token in the repository).
4. Approve it on npmjs.com, *Staged Packages* tab, with 2FA. Until then
   nothing is public.

## License

[MIT](LICENSE) © MindContact | Roberto Luttino
