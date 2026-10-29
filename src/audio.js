// Main-thread side of the sound, for a sidicio worklet: owns the
// AudioContext and turns game calls into messages. motorino does not import
// sidicio itself: the game passes `createNode` (sidicio's createSidicioNode),
// its compiled songs and its effect definitions, so each game pins its own
// sidicio version.
//
// `start()` runs once at load, so the title music plays at once where the
// browser allows it; most browsers keep the context suspended until a user
// gesture, so the first key press or tap must call `start()` again
// (Input.onFirstGesture). Calls made before the worklet is up are
// remembered (the song) or dropped (effects).
//
// settings: { music: 0..10, sfx: 0..10, muted, model: 6581 | 8580 }

export class Audio {
  constructor(settings, { createNode, songs = {}, sfx = {} }) {
    this.settings = settings;
    this.createNode = createNode;
    this.songs = songs;
    this.sfxDefs = sfx;
    this.ctx = null;
    this.node = null;
    this.current = null;
    this.onSongEnd = null;
  }

  async start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.node = await this.createNode(this.ctx);
    this.node.connect(this.ctx.destination);
    this.node.port.onmessage = (e) => {
      if (e.data.type === 'songEnd' && this.onSongEnd) this.onSongEnd();
    };
    this.post({ type: 'songs', songs: this.songs });
    this.post({ type: 'sfxDefs', defs: this.sfxDefs });
    this.applySettings();
    if (this.current) this.post({ type: 'play', name: this.current });
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  // True once sound is actually coming out, not merely set up.
  get started() {
    return !!this.node && this.ctx.state === 'running';
  }

  post(message) {
    if (this.node) this.node.port.postMessage(message);
  }

  applySettings() {
    const s = this.settings;
    const mute = s.muted ? 0 : 1;
    // Ten steps per slider; squared so the low end is actually quiet.
    this.post({ type: 'gain', music: (s.music / 10) ** 2 * 0.9 * mute, sfx: (s.sfx / 10) ** 2 * 0.9 * mute });
    this.post({ type: 'model', model: s.model });
  }

  play(name) {
    if (this.current === name) return;
    this.current = name;
    this.post({ type: 'play', name });
  }

  // Restart even if the same song is already playing (jingles).
  replay(name) {
    this.current = name;
    this.post({ type: 'play', name });
  }

  stop() {
    this.current = null;
    this.post({ type: 'stop' });
  }

  pause(paused) {
    this.post({ type: 'pause', paused });
  }

  sfx(name) {
    this.post({ type: 'sfx', name });
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
}
