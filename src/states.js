// A small state machine for the game shell. Each state is an object with
// optional `enter(machine, data)`, `exit(machine)`, `update(machine)` and
// `draw(machine, ctx)`; `go(name, data)` switches at once. A state may keep
// fields of its own; `machine.game` is whatever the game passed in.

export class StateMachine {
  constructor(game, states) {
    this.game = game;
    this.states = states;
    this.name = null;
    this.current = null;
    this.time = 0;
  }

  go(name, data) {
    const next = this.states[name];
    if (!next) throw new Error(`unknown state: ${name}`);
    if (this.current && this.current.exit) this.current.exit(this);
    this.name = name;
    this.current = next;
    this.time = 0;
    if (next.enter) next.enter(this, data);
  }

  update() {
    this.time++;
    if (this.current && this.current.update) this.current.update(this);
  }

  draw(ctx) {
    if (this.current && this.current.draw) this.current.draw(this, ctx);
  }
}
