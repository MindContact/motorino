// What the player has done, for adventure games: flags set by dialogue and
// events, the inventory (in the order things were found) and the archive of
// logs and notes already read. Plain data, so it saves as JSON and a test or
// solver can build one without a browser.

export class Progress {
  constructor({ flags = [], items = [], read = [] } = {}) {
    this.flags = new Set(flags);
    this.items = [...items];
    this.read = [...read];
    // Called after any change: the game saves, shows a "new item" banner...
    this.onChange = null;
  }

  changed(what, id) {
    if (this.onChange) this.onChange(what, id);
  }

  flag(name) { return this.flags.has(name); }

  setFlag(name) {
    if (this.flags.has(name)) return;
    this.flags.add(name);
    this.changed('flag', name);
  }

  clearFlag(name) {
    if (this.flags.delete(name)) this.changed('flag', name);
  }

  hasItem(id) { return this.items.includes(id); }

  give(id) {
    if (this.items.includes(id)) return;
    this.items.push(id);
    this.changed('give', id);
  }

  take(id) {
    const i = this.items.indexOf(id);
    if (i < 0) return;
    this.items.splice(i, 1);
    this.changed('take', id);
  }

  isRead(id) { return this.read.includes(id); }

  markRead(id) {
    if (this.read.includes(id)) return;
    this.read.push(id);
    this.changed('read', id);
  }

  toJSON() {
    return { flags: [...this.flags], items: [...this.items], read: [...this.read] };
  }
}
