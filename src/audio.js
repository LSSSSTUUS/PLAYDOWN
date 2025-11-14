export class MusicLoop {
  constructor({ volume = 0.12 } = {}) {
    this._ctx = null;
    this._master = null;
    this._gain = volume;
    this._running = false;
    this._interval = null;
  }

  _ensureCtx() {
    if (this._ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this._ctx = new C();
    this._master = this._ctx.createGain();
    this._master.gain.value = this._gain;
    this._master.connect(this._ctx.destination);
  }

  // start/resume the generated loop
  start() {
    this._ensureCtx();
    if (!this._ctx) return;
    if (this._running) return;
    // resume context if suspended (required on some browsers)
    if (this._ctx.state === "suspended") {
      this._ctx.resume();
    }
    this._running = true;
    // schedule a simple rhythmic loop using short synthesized notes
    // pattern repeats every 1.6s (pleasant loop)
    const loopDuration = 1.6;
    const schedule = () => {
      const now = this._ctx.currentTime;
      // bass pulse
      this._playTone(60, 0.0, 0.25, 0.02, 0.001); // low click
      // melodic pluck sequence
      this._playTone(72, 0.08, 0.18, 0.12, 0.002);
      this._playTone(76, 0.36, 0.16, 0.10, 0.002);
      this._playTone(79, 0.68, 0.14, 0.09, 0.002);
      // small ambient pad chord (short)
      this._playChord([48, 55, 60], 0.9, 0.55);
    };
    // schedule immediate and set interval
    schedule();
    this._interval = setInterval(schedule, 1600);
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    // gently ramp down master gain
    if (this._master && this._ctx) {
      const t = this._ctx.currentTime;
      this._master.gain.cancelScheduledValues(t);
      this._master.gain.linearRampToValueAtTime(0.0001, t + 0.08);
      // restore nominal value after a moment so next start uses correct volume
      setTimeout(() => {
        if (this._master) this._master.gain.value = this._gain;
      }, 120);
    }
  }

  isPlaying() {
    return this._running;
  }

  setVolume(v) {
    this._gain = Math.max(0, Math.min(1, v));
    if (this._master) this._master.gain.value = this._gain;
  }

  // utility: play a short sine/pluck tone in semitone pitch
  _playTone(semitone, offsetSec, durSec, amp = 0.12, detuneCents = 0) {
    if (!this._ctx) return;
    const osc = this._ctx.createOscillator();
    const env = this._ctx.createGain();
    const freq = 440 * Math.pow(2, (semitone - 69) / 12);
    osc.type = "sine";
    osc.frequency.value = freq;
    if (detuneCents) osc.detune.value = detuneCents;
    env.gain.value = 0;
    osc.connect(env);
    env.connect(this._master);

    const t0 = this._ctx.currentTime + offsetSec;
    const t1 = t0 + durSec;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(amp, t0 + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }

  // play a short chord (array of semitones)
  _playChord(semitones, offsetSec, durSec) {
    for (const st of semitones) {
      this._playTone(st, offsetSec, durSec, 0.06 + Math.random() * 0.02, (Math.random() - 0.5) * 6);
    }
  }
}

/* New: lightweight SFX manager using same style of WebAudio synthesis */
export class Sfx {
  constructor() {
    this._ctx = null;
    this._master = null;
  }

  _ensureCtx() {
    if (this._ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this._ctx = new C();
    this._master = this._ctx.createGain();
    this._master.gain.value = 0.9;
    this._master.connect(this._ctx.destination);
  }

  ensureResume() {
    this._ensureCtx();
    if (!this._ctx) return;
    if (this._ctx.state === "suspended") this._ctx.resume();
  }

  // generic short tone
  _playTone(freq, timeOffset = 0, dur = 0.08, amp = 0.18, type = "sine") {
    if (!this._ctx) return;
    const t0 = this._ctx.currentTime + timeOffset;
    const osc = this._ctx.createOscillator();
    const env = this._ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(env);
    env.connect(this._master);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(amp, t0 + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // jump sound (pluck-ish)
  playJump() {
    this._ensureCtx();
    this._playTone(880, 0, 0.14, 0.12, "triangle");
    this._playTone(1320, 0.04, 0.10, 0.08, "sine");
  }

  // landing / step
  playStep() {
    this._ensureCtx();
    this._playTone(220, 0, 0.08, 0.14, "sine");
  }

  // death sound
  playDeath() {
    this._ensureCtx();
    this._playTone(140, 0, 0.28, 0.22, "sawtooth");
    // add a small descending blip
    this._playTone(320, 0.06, 0.12, 0.08, "triangle");
  }

  // level complete
  playLevel() {
    this._ensureCtx();
    this._playTone(660, 0, 0.16, 0.16, "sine");
    this._playTone(880, 0.08, 0.14, 0.12, "sine");
  }
}