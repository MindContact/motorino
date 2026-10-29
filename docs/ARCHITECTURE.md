# motorino — architecture

How the engine works inside: the shape of a game built on it, the loop, the
coordinate systems, the physics, the content formats, the widgets, sound and
the PWA. For the how-to side (commands, recipes, testing, releasing) see
[TECHNICAL.md](TECHNICAL.md).

## Principles

* **Plain ES modules, no build, no dependencies.** A game loads the engine
  straight from `lib/motorino/src/` (a git submodule) or `node_modules/`.
  What you read in the repository is exactly what runs in the browser. The
  price: no TypeScript, no minification, no tree shaking beyond what the
  browser's module loader gives.
* **A fixed simulation, a free renderer.** The game world advances in
  fixed 1/60 s steps; drawing happens once per display frame. Every number
  in the physics is "per update", so the game feels the same on a 60 Hz,
  a 144 Hz or a 30 Hz screen.
* **Content as text.** Sprites, maps and dialogue scripts are strings in
  the game's source. They read in a diff, they are checked at load time
  with errors that name the row, and a test can parse them without a
  browser. The price: no visual editor.
* **The simulation does not need a browser.** `Body`, `TileMap`,
  `parseMap`, `Dialog`, `Progress`, `nearest`, `FakeInput`, `wrapText` and
  the parsers run in Node. A game can therefore test its levels, replay
  recorded inputs and run a solver in `node --test`. Everything that
  touches the DOM, the canvas or audio sits at the edges.
* **Injection over dependency.** motorino does not import sidicio (the SID
  sound library): the game passes the node factory in. Each game pins its
  own sidicio version once, and motorino stays usable without sound.

## The shape of a game

```
 index.html ── <canvas id="screen">, #touch buttons, manifest
     │
 src/main.js
     ├─ setupScreen(canvas)          → ctx, 320×180, integer scaling
     ├─ new Input()                  → actions (keyboard, pad, touch)
     ├─ new Audio(settings, { createNode, songs, sfx })
     ├─ createStore('game-save')     → load/save JSON
     ├─ new StateMachine(game, { title, play, pause, … })
     ├─ watchFocus({ lost: pause })
     ├─ registerServiceWorker()
     └─ startLoop({
          update() { input.update(); machine.update(); },
          draw()   { machine.draw(ctx); },
        })
```

The engine owns no global state and no "scene graph". A game is a set of
states (title, play, pause, dialogue, game over…) that the `StateMachine`
switches between; each state reads `Input`, moves its bodies, and draws with
the font, sprite, particle and UI helpers. The engine supplies parts, the
game supplies the plan.

### Module map

| Layer | Modules | Runs in Node |
| --- | --- | --- |
| Time and screen | `loop.js`, `screen.js` | `loop.js` needs `requestAnimationFrame` |
| Input | `input.js` | `FakeInput` only |
| Drawing | `font.js`, `sprites.js`, `camera.js`, `particles.js` | `wrapText`, `textWidth`, `Camera` math |
| World | `tilemap.js`, `physics.js`, `interact.js` | yes |
| Story | `dialog.js`, `progress.js`, `i18n.js` | yes |
| Shell | `states.js`, `storage.js`, `focus.js`, `fullscreen.js` | `states.js` |
| Widgets | `ui.js` | `ConfirmBox`, `ListMenu`, `DialogBox` logic (with a stub context) |
| Platform | `audio.js`, `pwa.js`, `pwa/sw.js`, `tools/icon.mjs` | `tools/icon.mjs` only |

Dependencies between modules are few and one-way: `physics.js` imports
`TILE` from `tilemap.js` and `TURNS` from `sprites.js`; `camera.js` and
`ui.js` import the view size from `screen.js`; `ui.js` draws with
`font.js`. Nothing imports `audio.js`, `input.js` or `states.js`.

## Time: the fixed-step loop

`startLoop({ update, draw })` (`loop.js`) is an accumulator loop on
`requestAnimationFrame`:

1. Add the elapsed real time to an accumulator, capped at 0.25 s.
2. While the accumulator holds at least one `STEP` (1/60 s), run
   `update()` and subtract a step; at most 5 steps per frame.
3. If the cap of 5 was hit, empty the accumulator.
4. Run `draw()` once.

| Display | Updates per frame |
| --- | --- |
| 60 Hz | 1 |
| 144 Hz | 0 or 1 (some frames redraw the same state) |
| 30 Hz | 2 |
| stalled tab, breakpoint | at most 5, then the lost time is dropped |

The two caps exist because of the "spiral of death": after a long stall a
loop that tries to catch up runs hundreds of updates in one frame, which
takes longer than a frame, which stalls it again. Dropping the time makes the
game slow down for a moment instead of freezing. There is no interpolation
between updates: at 320×180 and integer positions the stutter on a 144 Hz
screen is not visible, and interpolation would double the state every
drawable has to keep.

## Space: screen, world, tiles

* **The view** is 320×180 pixels (`VIEW_W`, `VIEW_H`), 16:9. The canvas is
  exactly that size; CSS scales it. `setupScreen` picks the largest whole
  number that fits the window (2×, 3×, 4×…) so every game pixel is a square
  of real pixels; below 2× there is no whole number that fits, so it takes
  the exact fit and accepts uneven pixels. `imageSmoothingEnabled = false`
  and `image-rendering: pixelated` in the page keep edges hard.
* **The world** is in pixels, origin top-left, y down. Positions are
  floats; drawing rounds them.
* **Tiles** are 16×16 pixels (`TILE`). A tile at `(tx, ty)` covers world
  `[tx·16, tx·16+16) × [ty·16, ty·16+16)`.
* **The camera** (`camera.js`) holds the top-left of the view in world
  pixels. `follow(cx, cy)` eases toward centring a point (10% of the gap
  per update horizontally, 12% vertically, so vertical moves settle a bit
  faster), clamped to `bounds` so the void past the map edge never shows; a
  map smaller than the view is centred. `view(rand)` gives the integer
  offset to draw with, shake included; the shake decays by 15% per update
  and stops below 0.3 px. The random source is a parameter, so a game that
  replays deterministically can keep `Math.random` out of the simulation.

## Input: from devices to actions

`Input` (`input.js`) folds three devices into named actions (`left`,
`jump`, `action`, `inventory`, `pause`…):

| Source | Mapping |
| --- | --- |
| keyboard | `KeyboardEvent.code` → action (`DEFAULT_KEYS`; layout-independent: WASD stays WASD on AZERTY) |
| gamepad | standard layout button index → list of actions (`DEFAULT_PAD`); left stick past 0.4 horizontally, 0.5 vertically |
| touch | any element under `#touch` with `data-action="jump"` |

State is read through three calls: `down(a)` (held now), `pressed(a)` (went
down on this update) and `confirm()` (start or jump pressed: menus accept
both).

Events arrive between updates, at any time; the simulation must see them at
a step boundary. So events only fill sets (`keys`, `touch`, `hits`), and
`update()`, called once at the start of each fixed step, builds the frame's
`now` set from them and keeps the previous one in `prev`:

* `pressed(a)` is `now.has(a) && !prev.has(a)`.
* A key pressed *and released* between two updates would never be seen in
  `keys`. `hits` remembers every key-down since the last update and forces
  it into `now` and out of `prev`, so a quick tap always counts as one
  press. A tap on a touch button easily lasts less than 16 ms.
* Key repeat (`e.repeat`) is ignored for `hits`: holding a key is not a
  stream of presses.
* On `blur` the held keys are cleared, otherwise a key released while
  another window has the focus stays "held" forever.

Two hooks run *inside* the browser event, because some APIs work only
during a user gesture:

* `onFirstGesture` runs once at the first key or pointer press: the game
  resumes its `AudioContext` there.
* `onPress(action)` runs on every press: full screen is requested there,
  not in `update()`, where the browser refuses it.

`FakeInput` has the same reading API and a `set(actions)` method that
gives the actions held for the next update. Tests, replays and solvers drive
the game with it.

## Drawing

Everything is drawn with the Canvas 2D API on the 320×180 canvas, with
integer coordinates.

### The font

`font.js` holds a 5×7 bitmap font as text (`'#'` is ink), 6 pixels per
character including the gap. At load each glyph is turned into a list of
horizontal runs `[x, y, width]`, so a letter costs a handful of `fillRect`
calls instead of up to 35. `drawText` draws a one-pixel shadow down-right
first, then the text, at any integer scale, aligned left, centre or right.

Accents: a missing accent changes Italian words ("è" is "is", "e" is
"and"), so À È É Ì Ò Ù have glyphs of their own, nine rows tall, with the
accent in the two rows above the cell. Other accented letters fold to the
base letter through Unicode NFD. Lowercase letters draw as uppercase,
except `x`, which is a small multiplication sign ("x3"). `'#'` is a solid
block, for bars drawn as text. An unknown character draws as `?`.

`wrapText(text, maxWidth)` breaks at spaces; `\n` forces a break; a word
wider than a line gets a line of its own.

### Sprites

A sprite is an array of equal-length strings, one character per pixel, plus
a palette `{ char: colour }`; characters not in the palette are
transparent. `bake` draws it once into an `OffscreenCanvas` (or a canvas),
so drawing is a single `drawImage`. A ragged row throws, naming the row.
`recolor` swaps palette characters to make variants without new art.

Convention: sprites face right and stand on their bottom edge.
`drawSprite(ctx, img, x, y, { flip, turn })` anchors the image at its
bottom-centre, the point where the feet touch the ground, mirrors it when
`flip`, and rotates it by quarter turns about that point. `TURNS` maps a
gravity direction to the turn that puts the feet on that surface, so a body
walking on the ceiling is drawn with `turn: TURNS.up`.

### Particles

`Particles` keeps up to 400 (by default) cosmetic particles with velocity,
their own gravity vector, life and size; `update()` compacts the array in
place (no allocation per frame). Particles with `glow` are drawn in a
second pass with `globalCompositeOperation = 'lighter'`. They are never
part of the simulated state: a solver replaces `add` with a no-op and the
outcome of a level does not change.

## The world: tile maps

`parseMap(rows, legend)` turns a map drawn as text into data. The legend
maps each character to a tile code, a spawn, or both:

```js
legend = { ' ': {}, '#': { tile: 1 }, o: { spawn: 'gem' }, f: { tile: 4, spawn: 'bubble' } }
```

The result is `{ w, h, tiles: Uint8Array, spawns: [{ kind, x, y }] }`.
Tile codes are the game's own numbers (0 is empty, at most 255). Unknown
characters and ragged rows throw with row and column: the usual mistake in a
hand-drawn map is one stray space.

`TileMap` is the live copy the game plays on. It copies the tiles (so a
crumbled floor does not change the parsed level) and is told which codes are
`solid` and which are `oneWay`, and what lies past each border (`edges`: a
solid code turns the border into a wall, 0 leaves it open for falling out).
`get`, `set`, `solid`, `oneWay`, `find(...codes)` are all the physics and
the game need.

## Physics

`physics.js` is a platformer body, Vulcano's feel, generalised so gravity
can point at any of the four sides.

### Two frames

A `Body` thinks in a **local frame** that turns with its gravity:

* `vt`: speed along the floor; positive is "forward", the way an unflipped
  sprite faces.
* `vn`: speed along gravity; positive is falling.

Collisions happen in **world space**, on the axis-aligned box. The two are
linked by two unit vectors per gravity:

| Gravity | `g` (down) | `f` (forward) | Sprite turn |
| --- | --- | --- | --- |
| `down` | (0, 1) | (1, 0) | 0 |
| `left` | (−1, 0) | (0, 1) | 1 |
| `up` | (0, −1) | (−1, 0) | 2 |
| `right` | (1, 0) | (0, −1) | 3 |

`f` and `g` are "down" and "forward" rotated clockwise by the sprite's
turn, which is what makes the drawn sprite and the moving box agree: on the
left wall forward is screen-down, on the ceiling forward is screen-left.
World velocity is `vx = vt·f.x + vn·g.x`, `vy = vt·f.y + vn·g.y`, and back.

`w` and `h` are the size in the local frame (width along the floor, height
off it); the world box swaps them when gravity is horizontal (`bw`, `bh`).

### One update

`step(map, { move, jump, jumpHeld, drop })` does, in order:

1. **Run.** `move` (−1..1) accelerates `vt` (0.25 px/update² on the ground,
   0.2 in the air) up to `runSpeed`; with no input, ground friction takes
   0.3 per update, air drag keeps 96% per update.
2. **Coyote time.** On the ground the counter is refilled to 6 updates
   (100 ms); in the air it counts down. A jump is allowed while it is above
   zero, so a jump pressed just after running off a ledge still works.
3. **Jump buffer.** A jump press is remembered for 7 updates (117 ms), so a
   press just before landing jumps on landing.
4. **Jump or drop.** Buffer and coyote both active: jump (`vn = −6`), or,
   with `drop` while standing only on one-way tiles, fall through them for
   10 updates.
5. **Variable height.** Releasing jump while rising faster than 2 px/update
   cuts the speed to 2; while jump is held and the body rises, gravity is
   0.32 instead of 0.4. Fall speed is capped at 6.5.
6. **Move** by the world velocity, x then y (below).
7. Return the fall speed at landing, or 0: the game uses it for dust, a
   thud, fall damage.

Measured with the default tuning on a flat floor: a held jump rises
**53.3 px** (3.3 tiles) and stays in the air 34 updates (0.57 s); a tapped
jump rises **9.7 px** in 12 updates. `runSpeed` 1.9 px/update is 114 px/s,
about 7 tiles per second. Everything is in `DEFAULT_TUNING` and every body
can override any field.

### Collision

`move()` clamps each component to 15 px (`TILE − 1`) and moves one world
axis at a time (`moveAxis`): it looks at the row or column of tiles the
leading edge enters, across the box's span on the other axis; on a hit it
places the box flush against the tile and zeroes that component. Because a
box never moves a whole tile in one update, it cannot skip a wall; the
tuning keeps all speeds well under that (6.5 px/update at most).

One-way tiles block only movement **along gravity** and only when the
leading edge was outside the tile before the move, so a body jumps up
through a platform and lands on it from above, whatever the gravity. They
do not block while `dropThrough` counts down.

After the move the body knows, in world terms, which sides it touched
(`touch`), and in local terms whether it stands (`ground`), hit its head
(`hitCeiling`) or a wall ahead or behind (`hitWall`). `touching(map, side)`
lists the tile codes just past one side, for surfaces with meaning
(magnetic, icy, electrified).

### Changing gravity

`setGravity(dir, map)` keeps what the player sees continuous:

* The **world velocity** is kept, re-expressed in the new frame: a body
  flying right keeps flying right.
* The **box centre** is kept; the box swaps width and height if the axis
  changes.
* The **facing on screen** is kept when the old and new forward are not
  perpendicular. On a quarter turn the local facing is kept instead, so
  holding the same key keeps carrying the body along the new floor.
* The box is then pushed out of any wall it now overlaps (`unstick`: away
  from the floor first, then along it, up to one tile), and settled onto a
  floor within 4 px (`settle`).
* Coyote and buffer are cleared, so a flip is never followed by an
  accidental jump.

`screenMove(body, held)` converts screen directions into `move`, so the
arrows always mean what they show: left/right on floors and ceilings,
up/down on walls.

## Story: dialogue, progress, interaction

### The script format

A dialogue script is text; `parseScript` turns it into nodes of entries:

```
# a comment
@start
eco: Buongiorno, tecnico. {if !met}
eco: Bentornato. {if met}
{set met}
? Chi sei? -> who
? Ecco la tessera. -> door {has card} {take card}
-> end
```

| Line | Entry |
| --- | --- |
| `@id` | starts a node |
| `speaker: text` | a line with a speaker id |
| `> text` | narration |
| `{…}` alone | a step: effects only |
| `? text -> node` | an option; consecutive options form one choice |
| `-> node` | a jump; `end` ends the dialogue |

Commands in braces: conditions `if F`, `if !F`, `has I`, `!has I`; effects
`set`, `unset`, `give`, `take`, `read`, `call`. On a line, step or jump,
the conditions decide whether it runs; on an option, whether it is offered,
and the option's effects run when it is picked.

Everything that can be checked is checked at parse time: unknown commands,
a command without argument, text before the first node, a node defined
twice, a jump to a node that does not exist. A broken script fails when the
game loads (or in a test), never in the middle of a conversation.

### The runner

`Dialog` plays a script against a `Progress`. `current` is what to show:
a line `{ speaker, text }`, a choice with only the options whose conditions
pass, or `null` at the end. `advance()` runs steps and jumps silently until
there is something to show; a guard of 10 000 entries turns an accidental
infinite loop of silent jumps into an error. `{call name}` asks the game to
act (open a door, play a sound) through `onCall`.

### Translations

Each language has its own script with the same structure. `scriptShape`
strips the words and keeps nodes, entry kinds, speakers, jumps and commands;
a game's test asserts the shapes of the Italian and English scripts are
equal, so a translator cannot drop a flag or a branch unnoticed.

### Progress and interaction

`Progress` is plain data: a set of flags, the inventory in the order things
were found, the list of read entries for the archive. `toJSON()` makes it
saveable as is; `onChange(what, id)` lets the game save or show a "new
item" banner. `nearest(px, py, things, reach, can)` returns the closest
usable thing whose box lies within `reach` (12 px by default) of a point,
measured from the point to the box, not to its centre, so a wide door is
usable from either end.

`i18n.js` keeps the game's on-screen strings by language; the first language
is the fallback for a missing key, and `pick({ it, en }, lang)` reads names
stored next to content.

## Widgets

`ui.js` draws in the same font on the same canvas, in a shared palette
(`UI_COLORS`, overridable per widget). Each widget has the same contract:
`update(input)` reads an Input-like object and returns what happened; `draw(ctx)`
draws. No widget owns the loop or the state machine, so a game decides when
a dialogue blocks movement and when it does not.

| Widget | Update returns | Notes |
| --- | --- | --- |
| `DialogBox` | `false` when the dialogue is over | typewriter text (`speed` letters per update), confirm shows the rest then advances; choices with up/down; `onType` for a typing blip every 3 letters |
| `ListMenu` | the chosen entry, `'close'`, or `null` | inventory or archive: list on the left, icon and description on the right, scrolls |
| `ConfirmBox` | `'yes'`, `'no'` or `null` | starts on **no**: it guards what cannot be undone; pause answers no |
| `drawPrompt` | — | a bobbing key hint above a thing |

Confirm in a widget is the action button as well as jump and Enter.

## Saving, focus, full screen

* `createStore(key)` saves JSON under one `localStorage` key. Reading never
  throws (a missing or corrupted save is `{}`); writing swallows the
  exception of private mode or a full quota, and the game goes on unsaved.
* `watchFocus({ lost, hidden, shown })` calls `lost` when the tab hides
  *or* the window loses focus, so the world never goes on without the
  player; `hidden` and `shown` follow only the tab, for sound that may go
  on while another window is in front.
* `toggleFullscreen()` puts the whole page in full screen (so the touch
  buttons come along) and resolves to the new state. It must be called from
  `Input.onPress`.

## Sound

`audio.js` is the main-thread half of the sound; the other half is
sidicio's AudioWorklet. `Audio`:

* creates the `AudioContext` on `start()`, asks the game's `createNode`
  for the worklet node, sends it the compiled songs and the effect
  definitions, and applies the settings;
* is called once at load (so the title music plays where the browser
  allows it) and again from `Input.onFirstGesture` (where most browsers
  first allow it);
* remembers the current song if `play` is called before the worklet is up,
  and drops effects that arrive that early (a late jump sound is worse than
  none);
* maps the 0–10 volume sliders to gains with a square curve, times 0.9:
  linear steps sound like nothing changes at the top and jumps at the
  bottom;
* `suspend()` and `resume()` follow the tab (`watchFocus`), so a hidden
  game takes no audio CPU.

Every message is posted to the worklet; there is no audio processing on the
main thread.

## PWA

* `registerServiceWorker()` registers the game's `sw.js` after `load`,
  except on `file://`.
* The game's `sw.js` sits at its root (its location decides the scope) and
  contains one line, `importScripts('lib/motorino/pwa/sw.js')`.
* `pwa/sw.js` is **network first**: online every request goes to the
  network and the answer is stored; offline the stored copy is served. A
  navigation with a query string (`?new`, `?room=3`) is matched ignoring the
  query. There is no list of files to keep in sync: an ES module game
  fetches all its files at start, so one visit online is enough to play
  offline. The price: online, nothing is served from the cache, so the
  first paint waits for the network.
* The cache is named after the scope, so two games on one origin do not
  share one.
* `tools/icon.mjs` renders the PNG icons (32, 180, 192, 512 px) from pixel
  art as text, with a small hand-written PNG encoder (zlib from Node): the
  art is scaled by a whole number and centred in the middle 3/4, which keeps
  it inside Android's maskable safe zone.

## Limits and choices

| Choice | Why | Price |
| --- | --- | --- |
| 320×180 fixed view | 16:9, scales by whole numbers to 720p, 1080p, 1440p, 4K | no high-resolution text or UI |
| 60 Hz fixed step, no interpolation | identical feel and deterministic replays | possible judder on 144 Hz displays |
| Axis-aligned boxes on a tile grid | simple, exact, fast enough for hundreds of bodies | no slopes, no rotation, no body-to-body collision (the game does that) |
| Speeds below one tile per update | no tunnelling without swept collision | a very fast projectile needs its own sub-steps |
| Text formats for content | readable diffs, load-time errors, Node tests | no visual editor |
| One `localStorage` key | no backend, works offline | about 5 MB, per origin, cleared with site data |
| Network-first service worker | never stale during development | slower first paint than cache-first |
| No sidicio import | each game pins its sound version | the game wires `createNode` itself |
