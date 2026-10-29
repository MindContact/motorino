// Screen widgets for adventure games, in the bitmap font: panels, the
// dialogue box with typewriter text and choices, a list menu (inventory,
// archive) and the "you can use this" prompt. They read an Input-like object
// (down/pressed/confirm) and draw on the 320x180 canvas.

import { drawText, textWidth, wrapText } from './font.js';
import { VIEW_W, VIEW_H } from './screen.js';

const LINE = 9;
const PAD = 6;

export const UI_COLORS = {
  panel: 'rgba(6, 10, 22, 0.92)',
  border: '#5f7ea8',
  text: '#e8eef8',
  dim: '#7d8ca3',
  cursor: '#ffd34a',
};

export function drawPanel(ctx, x, y, w, h, colors = UI_COLORS) {
  ctx.fillStyle = colors.panel;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colors.border;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

// Confirm in an adventure: the action button as well as jump and Enter.
const ok = (input) => input.pressed('action') || input.confirm();

// The dialogue box at the bottom of the screen. `speakers(id)` gives
// { name, color } for a speaker id. Text appears a few letters per update;
// confirm shows it all, then moves on. Choices: up/down and confirm.
export class DialogBox {
  constructor({ speakers = (id) => ({ name: id.toUpperCase(), color: UI_COLORS.cursor }), speed = 1, colors = UI_COLORS, onType = null } = {}) {
    this.speakers = speakers;
    this.speed = speed;
    this.colors = colors;
    this.onType = onType; // called every few letters: a typing blip
    this.dialog = null;
    this.w = VIEW_W - 8;
    this.textW = this.w - PAD * 2;
  }

  open(dialog) {
    this.dialog = dialog;
    this.reset();
  }

  get active() { return !!this.dialog && !this.dialog.done; }

  reset() {
    this.shown = 0;
    this.cursor = 0;
    this.lines = null;
  }

  // Updates the box; returns false once the dialogue is over.
  update(input) {
    const d = this.dialog;
    if (!d || d.done) return false;
    const cur = d.current;
    if (cur.type === 'line') {
      if (!this.lines) this.lines = wrapText(cur.text, this.textW);
      const total = this.lines.join('').length;
      if (this.shown < total) {
        const before = Math.floor(this.shown);
        this.shown = Math.min(total, this.shown + this.speed);
        if (this.onType && Math.floor(this.shown) !== before && before % 3 === 0) this.onType();
        if (ok(input)) this.shown = total;
      } else if (ok(input)) {
        d.next();
        this.reset();
      }
    } else {
      const n = cur.options.length;
      if (input.pressed('up')) this.cursor = (this.cursor + n - 1) % n;
      if (input.pressed('down')) this.cursor = (this.cursor + 1) % n;
      if (ok(input)) {
        d.choose(this.cursor);
        this.reset();
      }
    }
    return !d.done;
  }

  draw(ctx, time = 0) {
    const d = this.dialog;
    if (!d || d.done) return;
    const c = this.colors;
    const cur = d.current;
    const x = 4;
    if (cur.type === 'line') {
      const lines = this.lines || wrapText(cur.text, this.textW);
      const h = PAD * 2 + LINE * (lines.length + (cur.speaker ? 1 : 0)) - 2;
      const y = VIEW_H - 4 - h;
      drawPanel(ctx, x, y, this.w, h, c);
      let ty = y + PAD;
      if (cur.speaker) {
        const s = this.speakers(cur.speaker);
        drawText(ctx, s.name, x + PAD, ty, { color: s.color });
        ty += LINE;
      }
      let left = Math.floor(this.shown);
      for (const line of lines) {
        if (left <= 0) break;
        drawText(ctx, line.slice(0, left), x + PAD, ty, { color: cur.speaker ? c.text : c.dim });
        left -= line.length;
        ty += LINE;
      }
      if (this.shown >= lines.join('').length && (time >> 4) % 2) {
        drawText(ctx, '>', x + this.w - PAD - 5, y + h - PAD - 6, { color: c.cursor });
      }
    } else {
      const wrapped = cur.options.map((o) => wrapText(o.text, this.textW - 10));
      const rows = wrapped.reduce((n, l) => n + l.length, 0);
      const h = PAD * 2 + LINE * rows - 2;
      const y = VIEW_H - 4 - h;
      drawPanel(ctx, x, y, this.w, h, c);
      let ty = y + PAD;
      wrapped.forEach((lines, i) => {
        const on = i === this.cursor;
        if (on) drawText(ctx, '>', x + PAD, ty, { color: c.cursor });
        for (const line of lines) {
          drawText(ctx, line, x + PAD + 10, ty, { color: on ? c.cursor : c.text });
          ty += LINE;
        }
      });
    }
  }
}

// A titled list with a description pane: the inventory, the archive.
// Entries are { id, name, desc, icon? } (icon: a baked sprite). Up/down
// move, confirm returns the entry, `back` actions return 'close'.
export class ListMenu {
  constructor({ title = '', empty = '', back = ['pause', 'inventory'], colors = UI_COLORS } = {}) {
    this.title = title;
    this.empty = empty;
    this.back = back;
    this.colors = colors;
    this.entries = [];
    this.cursor = 0;
  }

  open(entries) {
    this.entries = entries;
    this.cursor = Math.min(this.cursor, Math.max(0, entries.length - 1));
  }

  update(input) {
    const n = this.entries.length;
    if (this.back.some((a) => input.pressed(a))) return 'close';
    if (!n) return null;
    if (input.pressed('up')) this.cursor = (this.cursor + n - 1) % n;
    if (input.pressed('down')) this.cursor = (this.cursor + 1) % n;
    if (ok(input)) return this.entries[this.cursor];
    return null;
  }

  draw(ctx) {
    const c = this.colors;
    const x = 12;
    const y = 12;
    const w = VIEW_W - 24;
    const h = VIEW_H - 24;
    drawPanel(ctx, x, y, w, h, c);
    drawText(ctx, this.title, x + w / 2, y + PAD, { color: c.cursor, align: 'center' });
    const listW = 110;
    const top = y + PAD + LINE + 6;
    if (!this.entries.length) {
      drawText(ctx, this.empty, x + w / 2, y + h / 2 - 3, { color: c.dim, align: 'center' });
      return;
    }
    const rows = Math.floor((y + h - PAD - top) / LINE);
    const first = Math.max(0, Math.min(this.cursor - rows + 1, this.entries.length - rows));
    this.entries.slice(first, first + rows).forEach((e, i) => {
      const on = first + i === this.cursor;
      const ty = top + i * LINE;
      if (on) drawText(ctx, '>', x + PAD, ty, { color: c.cursor });
      drawText(ctx, e.name, x + PAD + 10, ty, { color: on ? c.cursor : c.text });
    });
    ctx.fillStyle = c.border;
    ctx.fillRect(x + PAD + listW, top - 2, 1, h - (top - y) - PAD);
    const sel = this.entries[this.cursor];
    const dx = x + PAD + listW + 8;
    let dy = top;
    if (sel.icon) {
      ctx.drawImage(sel.icon, dx, dy);
      dy += sel.icon.height + 4;
    }
    for (const line of wrapText(sel.desc || '', x + w - PAD - dx)) {
      drawText(ctx, line, dx, dy, { color: c.text });
      dy += LINE;
    }
  }
}

// A small bobbing key hint above a point, e.g. "E" over a terminal.
export function drawPrompt(ctx, x, y, label, time = 0, colors = UI_COLORS) {
  const bob = Math.round(Math.sin(time / 10) * 1.5);
  const w = textWidth(label) + 6;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - 12 + bob);
  drawPanel(ctx, bx, by, w, 11, colors);
  drawText(ctx, label, bx + 3, by + 2, { color: colors.cursor, shadow: null });
}

// A yes/no question in a panel, for what cannot be undone (a new game over
// the saved one). The cursor starts on no; left/right or up/down move it,
// confirm answers, pause is no. `update` gives 'yes', 'no' or null.
export class ConfirmBox {
  constructor({ colors = UI_COLORS } = {}) {
    this.colors = colors;
    this.active = false;
  }

  open(question, { yes = 'YES', no = 'NO' } = {}) {
    this.lines = wrapText(question, VIEW_W - 64);
    this.answers = [yes, no];
    this.cursor = 1;
    this.active = true;
  }

  update(input) {
    if (!this.active) return null;
    if (['left', 'right', 'up', 'down'].some((a) => input.pressed(a))) this.cursor = 1 - this.cursor;
    let r = null;
    if (input.pressed('pause')) r = 'no';
    else if (ok(input)) r = this.cursor === 0 ? 'yes' : 'no';
    if (r) this.active = false;
    return r;
  }

  draw(ctx) {
    if (!this.active) return;
    const c = this.colors;
    const w = Math.max(...this.lines.map((l) => textWidth(l)), 100) + PAD * 4;
    const h = PAD * 2 + LINE * (this.lines.length + 1) + 4;
    const x = Math.round((VIEW_W - w) / 2);
    const y = Math.round((VIEW_H - h) / 2);
    drawPanel(ctx, x, y, w, h, c);
    this.lines.forEach((l, i) => drawText(ctx, l, VIEW_W / 2, y + PAD + i * LINE, { color: c.text, align: 'center' }));
    const ay = y + h - PAD - 7;
    this.answers.forEach((a, i) => {
      const on = i === this.cursor;
      drawText(ctx, on ? `> ${a} <` : a, VIEW_W / 2 + (i ? 1 : -1) * w / 4, ay, { color: on ? c.cursor : c.dim, align: 'center' });
    });
  }
}
