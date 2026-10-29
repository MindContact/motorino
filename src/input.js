// Keyboard, gamepad and touch folded into a handful of named actions.
// `pressed` is true only on the update where the action went down.
//
// The game may pass its own key and pad maps; the defaults cover a
// platformer with an action button and an inventory.

export const DEFAULT_KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
  KeyE: 'action', KeyX: 'action', KeyJ: 'action',
  KeyI: 'inventory', Tab: 'inventory',
  Enter: 'start',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
  KeyF: 'fullscreen',
};

// Standard gamepad layout: button index -> actions.
export const DEFAULT_PAD = {
  0: ['jump', 'start'],
  1: ['jump'],
  2: ['action'],
  3: ['inventory'],
  9: ['pause', 'start'],
  12: ['up'], 13: ['down'], 14: ['left'], 15: ['right'],
};

export class Input {
  constructor({ keys = DEFAULT_KEYS, pad = DEFAULT_PAD, touchRoot = 'touch' } = {}) {
    this.map = keys;
    this.padMap = pad;
    this.keys = new Set();
    this.touch = new Set();
    // Actions that went down since the last update, kept even if released
    // already: a quick tap can fall entirely between two updates.
    this.hits = new Set();
    this.now = new Set();
    this.prev = new Set();
    this.onFirstGesture = null;
    // Called inside the key or tap event with its action: what the browser
    // allows only during a gesture (full screen) goes here, not in update.
    this.onPress = null;

    window.addEventListener('keydown', (e) => {
      const a = this.map[e.code];
      if (a) {
        e.preventDefault();
        this.keys.add(a);
        if (!e.repeat) {
          this.hits.add(a);
          if (this.onPress) this.onPress(a);
        }
      }
      this.gesture();
    });
    window.addEventListener('keyup', (e) => {
      const a = this.map[e.code];
      if (a) this.keys.delete(a);
    });
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('pointerdown', () => this.gesture());
    this.bindTouch(touchRoot);
  }

  gesture() {
    if (this.onFirstGesture) {
      const f = this.onFirstGesture;
      this.onFirstGesture = null;
      f();
    }
  }

  // On-screen buttons: any element under #touchRoot with data-action.
  bindTouch(id) {
    const pad = document.getElementById(id);
    if (!pad) return;
    const show = () => document.body.classList.add('touch');
    window.addEventListener('touchstart', show, { once: true, passive: true });
    for (const btn of pad.querySelectorAll('[data-action]')) {
      const action = btn.dataset.action;
      const down = (e) => { e.preventDefault(); this.touch.add(action); this.hits.add(action); btn.classList.add('on'); this.gesture(); if (this.onPress) this.onPress(action); };
      const up = (e) => { e.preventDefault(); this.touch.delete(action); btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    }
  }

  // Call once per fixed update, before reading.
  update() {
    [this.prev, this.now] = [this.now, this.prev];
    this.now.clear();
    for (const a of this.keys) this.now.add(a);
    for (const a of this.touch) this.now.add(a);
    for (const a of this.hits) {
      this.now.add(a);
      // Make it count as a fresh press even if it was held last update too.
      this.prev.delete(a);
    }
    this.hits.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      p.buttons.forEach((b, i) => {
        if (b && b.pressed && this.padMap[i]) for (const a of this.padMap[i]) this.now.add(a);
      });
      const ax = p.axes[0] || 0;
      const ay = p.axes[1] || 0;
      if (ax < -0.4) this.now.add('left');
      if (ax > 0.4) this.now.add('right');
      if (ay < -0.5) this.now.add('up');
      if (ay > 0.5) this.now.add('down');
    }
  }

  down(a) { return this.now.has(a); }
  pressed(a) { return this.now.has(a) && !this.prev.has(a); }
  // Menus accept jump as confirm as well as Enter.
  confirm() { return this.pressed('start') || this.pressed('jump'); }
}

// A scripted stand-in with the same reading API, for tests, solvers and
// replays: `set(actions)` gives the actions held for the next update.
export class FakeInput {
  constructor() {
    this.now = new Set();
    this.prev = new Set();
  }

  set(actions = []) {
    this.prev = this.now;
    this.now = new Set(actions);
  }

  down(a) { return this.now.has(a); }
  pressed(a) { return this.now.has(a) && !this.prev.has(a); }
  confirm() { return this.pressed('start') || this.pressed('jump'); }
}
