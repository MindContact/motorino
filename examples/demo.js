// motorino demo: a station room with magnetic boots (jump at a wall or the
// ceiling and it becomes the floor), ECO on a terminal, a fuse to pick up
// and a door it opens, the inventory. Arrows move, Space jumps, E uses,
// I opens the inventory. In the console: window.demo.

import {
  setupScreen, startLoop, Input, Camera, Particles, TileMap, parseMap, TILE, Body, screenMove,
  bake, drawSprite, drawText, parseScript, Dialog, Progress, nearest, DialogBox, ListMenu, drawPrompt,
} from '../src/index.js';

const T = { WALL: 1, DOOR: 2, LEDGE: 3 };
const LEGEND = {
  ' ': {}, '#': { tile: T.WALL }, D: { tile: T.DOOR }, '=': { tile: T.LEDGE },
  P: { spawn: 'start' }, E: { spawn: 'eco' }, f: { spawn: 'fuse' },
};
const ROOM = [
  '##############################',
  '#      #                     #',
  '#      #          f          #',
  '#      #       ######        #',
  '#      D                     #',
  '#      D                     #',
  '###=####                     #',
  '#                            #',
  '#                      ===   #',
  '#  P      E                  #',
  '##############################',
];

const PALETTE = {
  k: '#0b0f1a', w: '#d8dee9', g: '#8a94a8', v: '#6ad0ff', V: '#e6fbff', b: '#3a4258', o: '#ff9a3c',
};
const PLAYER = bake([
  '....kkkk....',
  '...kwwwwkk..',
  '..kwwwwwwwk.',
  '..kwwvvvvvk.',
  '..kwwvVVvvk.',
  '..kwwvvvvvk.',
  '...kwwwwwk..',
  '..kkkwwwkkk.',
  '.kggkwwwwgk.',
  '.kggkwwwwgwk',
  '.kggkwwwwgbk',
  '..kkwwwwwkk.',
  '...kwgggwk..',
  '...kwk.kwk..',
  '...kwk.kwk..',
  '..kbok.kbok.',
], PALETTE);
const FUSE = bake(['.kkkk.', 'kooook', 'kowwok', 'kowwok', 'kooook', '.kkkk.'], PALETTE);

const SCRIPT = parseScript(`
@eco
eco: Buongiorno, tecnico. Sono ECO, il sistema di bordo. {if !met}
eco: Di nuovo tu. {if met}
{set met}
eco: La porta del magazzino è senza corrente. {if !fixed}
? Cosa devo fare? -> how {!has fuse} {if !fixed}
? Ho trovato un fusibile. -> fix {has fuse}
? Niente, grazie. -> end
@how
eco: Un fusibile, lassù. Salta verso il soffitto: gli stivali magnetici faranno il resto.
eco: Fidati di me. {set trust}
@fix
eco: Perfetto. Apro la porta. {take fuse} {set fixed} {call openDoor}
`);

const GRAVITY_NAMES = { down: 'GIÙ', up: 'SU', left: 'SINISTRA', right: 'DESTRA' };

const ITEMS = { fuse: { name: 'FUSIBILE', desc: 'UN FUSIBILE DA 40 A. SERVE ALLA PORTA DEL MAGAZZINO.', icon: FUSE } };

class Demo {
  constructor() {
    this.ctx = setupScreen(document.getElementById('screen'));
    this.input = new Input();
    const parsed = parseMap(ROOM, LEGEND);
    this.map = new TileMap(parsed, { solid: [T.WALL, T.DOOR], oneWay: [T.LEDGE], edges: { left: T.WALL, right: T.WALL, top: T.WALL, bottom: T.WALL } });
    const at = (kind) => parsed.spawns.find((s) => s.kind === kind);
    const s = at('start');
    this.body = new Body(s.x * TILE + 3, s.y * TILE + 2, 10, 14);
    const e = at('eco');
    const f = at('fuse');
    this.things = [
      { kind: 'eco', x: e.x * TILE, y: e.y * TILE, w: TILE, h: TILE },
      { kind: 'fuse', x: f.x * TILE + 5, y: f.y * TILE + 5, w: 6, h: 6 },
    ];
    this.progress = new Progress();
    this.camera = new Camera();
    this.camera.bounds = { x: 0, y: 0, w: this.map.pixelW, h: this.map.pixelH };
    this.camera.snap(this.body.cx, this.body.cy);
    this.particles = new Particles();
    this.box = new DialogBox({ speakers: () => ({ name: 'ECO', color: '#6ad0ff' }) });
    this.menu = new ListMenu({ title: 'INVENTARIO', empty: 'NIENTE IN TASCA' });
    this.mode = 'play';
    this.time = 0;
    startLoop({ update: () => this.update(), draw: () => this.draw() });
  }

  update() {
    this.time++;
    this.input.update();
    const input = this.input;
    if (this.mode === 'talk') {
      if (!this.box.update(input)) this.mode = 'play';
      return;
    }
    if (this.mode === 'inventory') {
      if (this.menu.update(input) === 'close') this.mode = 'play';
      return;
    }
    if (input.pressed('inventory')) {
      this.menu.open(this.progress.items.map((id) => ({ id, ...ITEMS[id] })));
      this.mode = 'inventory';
      return;
    }
    const b = this.body;
    const landed = b.step(this.map, {
      move: screenMove(b, (d) => input.down(d)),
      jump: input.pressed('jump'),
      jumpHeld: input.down('jump'),
      drop: input.down('down') && b.gravity === 'down',
    });
    // Magnetic boots: in the air, any surface touched becomes the floor.
    if (!b.ground) {
      for (const side of ['up', 'down', 'left', 'right']) {
        if (side !== b.gravity && b.touch[side]) {
          b.setGravity(side, this.map);
          this.camera.shake = 3;
          this.burst(b.feet.x, b.feet.y, '#6ad0ff');
          break;
        }
      }
    }
    if (landed > 3) this.burst(b.feet.x, b.feet.y, '#8a94a8');
    this.target = nearest(b.cx, b.cy, this.things, 10, (t) => !t.gone);
    if (this.target && input.pressed('action')) this.use(this.target);
    this.particles.update();
    this.camera.follow(b.cx, b.cy);
  }

  use(t) {
    if (t.kind === 'fuse') {
      t.gone = true;
      this.progress.give('fuse');
      this.burst(t.x + 3, t.y + 3, '#ff9a3c');
    } else if (t.kind === 'eco') {
      this.box.open(new Dialog(SCRIPT, 'eco', this.progress, { onCall: (n) => n === 'openDoor' && this.openDoor() }));
      this.mode = 'talk';
    }
  }

  openDoor() {
    for (const { x, y } of this.map.find(T.DOOR)) this.map.set(x, y, 0);
    this.camera.shake = 4;
  }

  burst(x, y, color) {
    for (let i = 0; i < 8; i++) this.particles.add(x, y, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 24, color, 2, 0, 0, true);
  }

  draw() {
    const ctx = this.ctx;
    const cam = this.camera.view();
    ctx.fillStyle = '#0a1020';
    ctx.fillRect(0, 0, 320, 180);
    const colors = { [T.WALL]: '#2b3550', [T.DOOR]: '#a85a2a', [T.LEDGE]: '#5f7ea8' };
    for (let ty = 0; ty < this.map.h; ty++) {
      for (let tx = 0; tx < this.map.w; tx++) {
        const c = this.map.get(tx, ty);
        if (!c) continue;
        ctx.fillStyle = colors[c];
        const h = c === T.LEDGE ? 4 : TILE;
        ctx.fillRect(tx * TILE - cam.x, ty * TILE - cam.y, TILE, h);
      }
    }
    for (const t of this.things) {
      if (t.gone) continue;
      if (t.kind === 'eco') {
        ctx.fillStyle = '#1b2a44';
        ctx.fillRect(t.x - cam.x, t.y - cam.y, t.w, t.h);
        ctx.fillStyle = (this.time >> 5) % 2 ? '#6ad0ff' : '#3a8ab8';
        ctx.fillRect(t.x - cam.x + 3, t.y - cam.y + 3, 10, 6);
      } else {
        ctx.drawImage(FUSE, t.x - cam.x, t.y - cam.y + Math.round(Math.sin(this.time / 12)));
      }
    }
    const b = this.body;
    drawSprite(ctx, PLAYER, b.feet.x - cam.x, b.feet.y - cam.y, { flip: b.facing < 0, turn: b.turn });
    this.particles.draw(ctx, cam);
    if (this.mode === 'play' && this.target) {
      const t = this.target;
      drawPrompt(ctx, t.x + t.w / 2 - cam.x, t.y - cam.y, 'E', this.time);
    }
    drawText(ctx, `GRAVITÀ ${GRAVITY_NAMES[b.gravity]}`, 4, 4, { color: '#5f7ea8' });
    if (this.mode === 'talk') this.box.draw(ctx, this.time);
    if (this.mode === 'inventory') this.menu.draw(ctx);
  }
}

window.demo = new Demo();
