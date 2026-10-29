import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScript, scriptShape, Dialog } from '../src/dialog.js';
import { Progress } from '../src/progress.js';
import { nearest } from '../src/interact.js';

const IT = `
# saluto di ECO
@start
eco: Buongiorno, tecnico. {if !met}
eco: Bentornato. {if met}
{set met}
> Le luci tremano.
? Mi fido di te. -> trust {set trust}
? Chi sei?  -> who
? Ecco la tessera. -> door {has card}
@trust
eco: Bene. {give card}
-> end
@who
eco: Sono ECO. {read log1}
@door
eco: Apro. {take card} {call openDoor}
`;

const EN = IT
  .replace('Buongiorno, tecnico.', 'Good morning, technician.')
  .replace('Bentornato.', 'Welcome back.')
  .replace('Le luci tremano.', 'The lights flicker.')
  .replace('Mi fido di te.', 'I trust you.')
  .replace('Chi sei?', 'Who are you?')
  .replace('Ecco la tessera.', 'Here is the card.')
  .replace('Bene.', 'Good.')
  .replace('Sono ECO.', 'I am ECO.')
  .replace('Apro.', 'Opening.');

test('lines, conditions and effects run in order', () => {
  const p = new Progress();
  const d = new Dialog(parseScript(IT), 'start', p);
  assert.deepEqual(d.current, { type: 'line', speaker: 'eco', text: 'Buongiorno, tecnico.' });
  d.next();
  assert.equal(p.flag('met'), true);
  assert.deepEqual(d.current, { type: 'line', speaker: null, text: 'Le luci tremano.' });
  d.next();
  assert.equal(d.current.type, 'choice');
  assert.deepEqual(d.current.options.map((o) => o.text), ['Mi fido di te.', 'Chi sei?'], 'card choice hidden');
  d.choose(0);
  assert.equal(p.flag('trust'), true);
  assert.equal(d.current.text, 'Bene.');
  assert.equal(p.hasItem('card'), true);
  d.next();
  assert.equal(d.done, true);
});

test('a second visit takes the other branch and offers the item', () => {
  const p = new Progress({ flags: ['met'], items: ['card'] });
  const calls = [];
  const d = new Dialog(parseScript(IT), 'start', p, { onCall: (n) => calls.push(n) });
  assert.equal(d.current.text, 'Bentornato.');
  d.next();
  d.next();
  assert.equal(d.current.options.length, 3);
  d.choose(2);
  assert.equal(d.current.text, 'Apro.');
  assert.equal(p.hasItem('card'), false);
  assert.deepEqual(calls, ['openDoor']);
});

test('running off the end of a node ends the dialogue; read goes to the archive', () => {
  const p = new Progress();
  const d = new Dialog(parseScript(IT), 'start', p);
  d.next(); d.next(); d.choose(1);
  assert.equal(d.current.text, 'Sono ECO.');
  assert.deepEqual(p.read, ['log1']);
  d.next();
  assert.equal(d.done, true);
});

test('translations must keep the same shape', () => {
  assert.equal(scriptShape(parseScript(EN)), scriptShape(parseScript(IT)));
  const broken = EN.replace('{give card}', '');
  assert.notEqual(scriptShape(parseScript(broken)), scriptShape(parseScript(IT)));
});

test('script errors are caught at parse time', () => {
  assert.throws(() => parseScript('eco: ciao'), /before the first @node/);
  assert.throws(() => parseScript('@a\n-> nowhere'), /unknown node "nowhere"/);
  assert.throws(() => parseScript('@a\n? scelta senza meta'), /needs "-> node"/);
  assert.throws(() => parseScript('@a\neco: x {fly away}'), /unknown command "fly"/);
  assert.throws(() => parseScript('@a\n@a'), /defined twice/);
});

test('progress round-trips through JSON and reports changes', () => {
  const seen = [];
  const p = new Progress();
  p.onChange = (what, id) => seen.push(`${what}:${id}`);
  p.give('fuse'); p.give('fuse'); p.setFlag('x'); p.markRead('n1'); p.take('fuse');
  assert.deepEqual(seen, ['give:fuse', 'flag:x', 'read:n1', 'take:fuse']);
  const q = new Progress(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(q.toJSON(), p.toJSON());
});

test('nearest picks the closest thing within reach', () => {
  const things = [{ id: 'a', x: 0, y: 0, w: 16, h: 16 }, { id: 'b', x: 40, y: 0, w: 16, h: 16 }];
  assert.equal(nearest(20, 8, things, 10).id, 'a');
  assert.equal(nearest(35, 8, things, 10).id, 'b');
  assert.equal(nearest(100, 8, things, 10), null);
  assert.equal(nearest(20, 8, things, 10, (t) => t.id !== 'a'), null);
});
