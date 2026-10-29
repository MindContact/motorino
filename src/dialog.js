// Dialogue scripts written as text, and the runner that plays them.
//
//   # a comment
//   @start                      a node; the script begins at the one asked
//   eco: Buongiorno, tecnico.   a line: speaker id, colon, text
//   > La porta è chiusa.        narration, no speaker
//   eco: Bentornato. {if met}   shown only if the flag is set
//   {set met}                   a step with no text: effects only
//   ? Mi fido. -> trust {set trust}
//   ? Chi sei? -> who           consecutive "?" lines make one choice
//   ? Ecco la tessera. -> door {has card}
//   -> end                      jump; "end" (or running off a node) ends
//
// Commands in braces, several allowed, separated by spaces:
//   if F / if !F       condition on a flag       has I / !has I   on an item
//   set F / unset F    change a flag             give I / take I  inventory
//   read E             add an entry to the archive
//   call N             ask the game to do N (open a door, play a sound)
// On a line or step, conditions decide whether it runs at all; on a choice,
// whether it is offered, and the effects apply when it is picked.
//
// Speakers are ids; the game maps them to names and colours. Each language
// has its own script with the same shape: `scriptShape` lets a test check
// that translations stay in step.

const CMD = /\{([^}]*)\}/g;

function parseCommands(src) {
  const conds = [];
  const effects = [];
  for (const m of src.matchAll(CMD)) {
    const words = m[1].trim().split(/\s+/);
    for (let i = 0; i < words.length; i += 2) {
      const op = words[i];
      const arg = words[i + 1];
      if (!arg) throw new Error(`command without argument: {${m[1]}}`);
      if (op === 'if' || op === 'has' || op === '!has') {
        const neg = op === '!has' || arg.startsWith('!');
        conds.push({ kind: op === 'if' ? 'flag' : 'item', name: arg.replace(/^!/, ''), neg });
      } else if (['set', 'unset', 'give', 'take', 'read', 'call'].includes(op)) {
        effects.push({ op, arg });
      } else {
        throw new Error(`unknown command "${op}"`);
      }
    }
  }
  return { conds, effects, rest: src.replace(CMD, '').trim() };
}

export function parseScript(text) {
  const nodes = {};
  let node = null;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const where = `line ${i + 1}`;
    if (!line || line.startsWith('#')) return;
    if (line.startsWith('@')) {
      const id = line.slice(1).trim();
      if (nodes[id]) throw new Error(`${where}: node @${id} defined twice`);
      node = nodes[id] = [];
      return;
    }
    if (!node) throw new Error(`${where}: text before the first @node`);
    const { conds, effects, rest } = parseCommands(line);
    if (rest.startsWith('?')) {
      const m = rest.slice(1).match(/^(.*?)\s*->\s*(\S+)$/);
      if (!m) throw new Error(`${where}: a choice needs "-> node"`);
      const option = { text: m[1].trim(), to: m[2], conds, effects };
      const last = node[node.length - 1];
      if (last && last.type === 'choice' && last.open) last.options.push(option);
      else node.push({ type: 'choice', options: [option], open: true });
      return;
    }
    const last = node[node.length - 1];
    if (last && last.type === 'choice') last.open = false;
    if (rest.startsWith('->')) {
      node.push({ type: 'goto', to: rest.slice(2).trim(), conds, effects });
    } else if (rest.startsWith('>')) {
      node.push({ type: 'line', speaker: null, text: rest.slice(1).trim(), conds, effects });
    } else if (!rest) {
      node.push({ type: 'step', conds, effects });
    } else {
      const m = rest.match(/^([\w-]+):\s*(.*)$/);
      if (!m) throw new Error(`${where}: expected "speaker: text", "> text", "? choice" or "-> node"`);
      node.push({ type: 'line', speaker: m[1], text: m[2], conds, effects });
    }
  });
  for (const list of Object.values(nodes)) for (const e of list) delete e.open;
  // Every jump must land somewhere.
  for (const [id, list] of Object.entries(nodes)) {
    for (const e of list) {
      const targets = e.type === 'choice' ? e.options.map((o) => o.to) : e.type === 'goto' ? [e.to] : [];
      for (const t of targets) if (t !== 'end' && !nodes[t]) throw new Error(`@${id}: jump to unknown node "${t}"`);
    }
  }
  return nodes;
}

// The script without its words: node ids, entry kinds, speakers, jumps and
// commands. Two translations of one script must have equal shapes.
export function scriptShape(nodes) {
  const cmds = (e) => JSON.stringify([e.conds, e.effects]);
  return Object.entries(nodes).map(([id, list]) => `@${id}\n${list.map((e) => (e.type === 'choice'
    ? `choice ${e.options.map((o) => `${o.to}${cmds(o)}`).join(' | ')}`
    : `${e.type} ${e.speaker || ''} ${e.to || ''} ${cmds(e)}`)).join('\n')}`).join('\n');
}

// Plays one script from a node. `progress` holds flags, items and the
// archive (see progress.js); `onCall(name)` handles {call N}.
//
//   const d = new Dialog(nodes, 'start', progress, { onCall });
//   d.current   -> { type: 'line', speaker, text } | { type: 'choice', options: [{ text }] } | null
//   d.next()    after a line;  d.choose(i) on a choice;  d.done when over
export class Dialog {
  constructor(nodes, start, progress, { onCall = () => {} } = {}) {
    if (!nodes[start]) throw new Error(`no dialogue node "${start}"`);
    this.nodes = nodes;
    this.progress = progress;
    this.onCall = onCall;
    this.current = null;
    this.jump(start);
  }

  get done() { return this.current === null; }

  passes(conds) {
    const p = this.progress;
    return conds.every((c) => (c.kind === 'flag' ? p.flag(c.name) : p.hasItem(c.name)) !== c.neg);
  }

  apply(effects) {
    const p = this.progress;
    for (const { op, arg } of effects) {
      if (op === 'set') p.setFlag(arg);
      else if (op === 'unset') p.clearFlag(arg);
      else if (op === 'give') p.give(arg);
      else if (op === 'take') p.take(arg);
      else if (op === 'read') p.markRead(arg);
      else if (op === 'call') this.onCall(arg);
    }
  }

  jump(id) {
    if (id === 'end') {
      this.current = null;
      return;
    }
    this.node = this.nodes[id];
    this.pos = 0;
    this.advance();
  }

  // Runs steps and jumps until something to show, or the end.
  advance() {
    for (let guard = 0; guard < 10000; guard++) {
      const e = this.node[this.pos];
      if (!e) {
        this.current = null;
        return;
      }
      this.pos++;
      if (e.type === 'choice') {
        const options = e.options.filter((o) => this.passes(o.conds));
        if (!options.length) continue;
        this.current = { type: 'choice', options };
        return;
      }
      if (!this.passes(e.conds)) continue;
      this.apply(e.effects);
      if (e.type === 'line') {
        this.current = { type: 'line', speaker: e.speaker, text: e.text };
        return;
      }
      if (e.type === 'goto') {
        this.jump(e.to);
        return;
      }
    }
    throw new Error('dialogue loops without showing anything');
  }

  next() {
    if (this.current && this.current.type === 'line') this.advance();
  }

  choose(i) {
    if (!this.current || this.current.type !== 'choice') return;
    const o = this.current.options[i];
    if (!o) return;
    this.apply(o.effects);
    this.jump(o.to);
  }
}
