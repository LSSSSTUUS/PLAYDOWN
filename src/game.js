import { Level } from "./level.js";

export class Game {
  constructor(canvas, input, callbacks = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.input = input;
    this.onLevelChange = callbacks.onLevelChange || (() => {});
    this.onFps = callbacks.onFps || (() => {});
    // new callbacks for sound hooks
    this.onJump = callbacks.onJump || (() => {});
    this.onStep = callbacks.onStep || (() => {});
    this.onDeath = callbacks.onDeath || (() => {});
    this.onLevelComplete = callbacks.onLevelComplete || (() => {});

    this.dpr = 1;
    this.viewport = { w: canvas.width, h: canvas.height };

    this.levelIndex = 1;
    this.level = new Level(this.levelIndex);

    this.player = {
      x: this.level.playerStart.x,
      y: this.level.playerStart.y,
      w: 28, h: 40,
      vx: 0, vy: 0,
      onGround: false,
      face: 1
    };

    this.camera = { x: 0, y: 0 };
    this._last = performance.now();
    this._accum = 0;
    this._running = false;

    this._fpsSamples = [];

    // Level complete animation state
    this._levelComplete = {
      active: false,
      t: 0,
      duration: 1.6 // seconds total (intro + hold + outro)
    };

    // Death animation state
    this._death = {
      active: false,
      t: 0,
      duration: 1.2
    };
    // step timer for footstep cadence
    this._stepTimer = 0;
  }

  setViewport(w, h, dpr) {
    this.viewport.w = w;
    this.viewport.h = h;
    this.dpr = dpr;
  }

  start() {
    this._running = true;
    this.onLevelChange(this.levelIndex);
    requestAnimationFrame(this._loop);
  }

  _loop = (t) => {
    if (!this._running) return;

    // frame time
    let frameTime = (t - this._last) / 1000;
    this._last = t;

    // prevent huge jumps
    if (frameTime > 0.25) frameTime = 0.25;

    // accumulate time for fixed-step physics
    this._accum += frameTime;

    const fixedDt = 1 / 60; // 60Hz physics
    while (this._accum >= fixedDt) {
      this.update(fixedDt);
      this._accum -= fixedDt;
    }

    // Update fps HUD every ~0.5s using actual frame intervals
    this._fpsSamples.push(1 / Math.max(1e-6, frameTime));
    if (this._fpsSamples.length > 30) {
      const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
      this.onFps(Math.round(avg));
      this._fpsSamples.length = 0;
    }

    this.render();
    requestAnimationFrame(this._loop);
  };

  resetLevel() {
    this.level = new Level(this.levelIndex);
    this.player.x = this.level.playerStart.x;
    this.player.y = this.level.playerStart.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = false;
    this.camera.x = 0;
    this.camera.y = 0;
    this.onLevelChange(this.levelIndex);
  }

  nextLevel() {
    this.levelIndex++;
    this.resetLevel();
  }

  // start the level-complete animation sequence
  _startLevelComplete() {
    if (this._levelComplete.active) return;
    this._levelComplete.active = true;
    this._levelComplete.t = 0;
    // optionally lock player input by zeroing velocities
    this.player.vx = 0;
    this.player.vy = 0;
    // callback for SFX/UI
    this.onLevelComplete();
  }

  // start death animation (then reset level)
  _startDeath() {
    if (this._death.active || this._levelComplete.active) return;
    this._death.active = true;
    this._death.t = 0;
    this.player.vx = 0;
    this.player.vy = 0;
    // callback for SFX/UI
    this.onDeath();
  }

  // finalize after animation finishes
  _finishLevelComplete() {
    this._levelComplete.active = false;
    this.nextLevel();
  }

  update(dt) {
    const p = this.player;
    const lvl = this.level;

    // If level complete animation is active, advance its timer and skip normal updates
    if (this._levelComplete.active) {
      this._levelComplete.t += dt;
      if (this._levelComplete.t >= this._levelComplete.duration) {
        this._finishLevelComplete();
      }
      return;
    }

    // If death animation active, advance its timer and skip normal updates
    if (this._death.active) {
      this._death.t += dt;
      if (this._death.t >= this._death.duration) {
        this._death.active = false;
        this.resetLevel();
      }
      return;
    }

    // Input to velocity
    const moveSpeed = 1200;
    const airControl = 0.6;
    const accel = (p.onGround ? 1 : airControl) * moveSpeed;
    const friction = p.onGround ? 0.85 : 0.98;

    let dir = 0;
    if (this.input.state.left) dir -= 1;
    if (this.input.state.right) dir += 1;
    p.vx += dir * accel * dt;
    p.vx *= friction;
    p.face = dir !== 0 ? dir : p.face;

    // Jump
    const jumpPressed = this.input.state.jump;
    if (jumpPressed && p.onGround) {
      p.vy = -480;
      p.onGround = false;
      // notify jump (for sound)
      this.onJump();
    }

    // Gravity
    p.vy += lvl.gravity * dt;

    // Integrate
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Collisions with platforms
    p.onGround = false;
    for (const s of lvl.platforms) {
      // AABB collision
      if (this._aabb(p.x, p.y, p.w, p.h, s.x, s.y, s.w, s.h)) {
        const overlapX = this._overlap(p.x, p.w, s.x, s.w);
        const overlapY = this._overlap(p.y, p.h, s.y, s.h);

        if (overlapX < overlapY) {
          // resolve X
          if (p.x + p.w / 2 < s.x + s.w / 2) {
            p.x = s.x - p.w;
          } else {
            p.x = s.x + s.w;
          }
          p.vx = 0;
        } else {
          // resolve Y
          if (p.y + p.h / 2 < s.y + s.h / 2) {
            p.y = s.y - p.h;
            p.vy = 0;
            p.onGround = true;
          } else {
            p.y = s.y + s.h;
            p.vy = 0;
          }
        }
      }
    }

    // Hazards -> start death animation instead of instant reset
    for (const h of lvl.hazards) {
      if (this._aabb(p.x, p.y, p.w, p.h, h.x, h.y, h.w, h.h)) {
        this._startDeath();
        break;
      }
    }

    // Boss collision (if present) -> start death animation
    if (lvl.boss) {
      const b = lvl.boss;
      if (this._aabb(p.x, p.y, p.w, p.h, b.x, b.y, b.w, b.h)) {
        this._startDeath();
      }
    }

    // Goal -> start level-complete animation instead of instantly advancing
    const g = lvl.goal;
    if (this._aabb(p.x, p.y, p.w, p.h, g.x, g.y, g.w, g.h)) {
      this._startLevelComplete();
    }

    // Clamp to world bounds
    p.x = Math.max(0, Math.min(lvl.world.w - p.w, p.x));
    // Se o jogador cair muito abaixo do mundo (void), refazer a fase
    if (p.y > lvl.world.h + 200) {
      this._startDeath();
      return;
    }
    p.y = Math.min(lvl.world.h - p.h, p.y);

    // Camera follow with margin
    const marginX = 140;
    const marginY = 80;
    const targetX = Math.max(0, Math.min(lvl.world.w - this.viewport.w / this.dpr, p.x - marginX));
    this.camera.x += (targetX - this.camera.x) * 0.12;
    this.camera.y = 0;

    // footsteps / movement SFX: if on ground and moving, trigger step cadence
    if (p.onGround && Math.abs(p.vx) > 60) {
      this._stepTimer -= dt;
      if (this._stepTimer <= 0) {
        this._stepTimer = 0.24; // cadence ~4 per second while running
        this.onStep();
      }
    } else {
      // reset timer while airborne or standing
      this._stepTimer = 0;
    }
  }

  render() {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const vw = this.viewport.w;
    const vh = this.viewport.h;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, vw / dpr, vh / dpr);

    // Parallax sky
    this._drawBackground();

    // Translate camera
    ctx.translate(-this.camera.x, -this.camera.y);

    // Draw platforms
    for (const s of this.level.platforms) {
      this._rect(s.x, s.y, s.w, s.h, "#2c3a34");
      this._rect(s.x, s.y + s.h - 4, s.w, 4, "#1e2a25");
    }

    // Hazards
    for (const h of this.level.hazards) {
      this._rect(h.x, h.y, h.w, h.h, "#b53a2d");
      this._spikes(h.x, h.y, h.w, h.h, "#ff6f3d");
    }

    // Goal flag
    const g = this.level.goal;
    this._rect(g.x, g.y, 4, g.h, "#36c67a");
    this._rect(g.x + 4, g.y, g.w - 4, 18, "#36c67a");

    // Player
    const p = this.player;
    this._rect(p.x, p.y, p.w, p.h, "#e6e6e6");
    // face direction accent
    const eyeX = p.face > 0 ? p.x + p.w - 8 : p.x + 4;
    this._rect(eyeX, p.y + 10, 4, 6, "#0f1416");

    ctx.restore();

    // Draw death overlay if active (UI space)
    if (this._death.active) {
      this._renderDeathOverlay();
    }

    // If level complete animation active, draw overlay (UI space, not camera-translated)
    if (this._levelComplete.active) {
      this._renderLevelCompleteOverlay();
    }
  }

  _aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  _overlap(aPos, aSize, bPos, bSize) {
    const left = Math.max(aPos, bPos);
    const right = Math.min(aPos + aSize, bPos + bSize);
    return Math.max(0, right - left);
  }

  _rect(x, y, w, h, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  _spikes(x, y, w, h, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    const count = Math.max(3, (w / 10) | 0);
    for (let i = 0; i < count; i++) {
      const sx = x + (i + 0.2) * (w / count);
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + (w / count) * 0.6, y);
      ctx.lineTo(sx + (w / count) * 0.3, y - h * 0.8);
      ctx.closePath();
      ctx.fill();
    }
  }

  // draw level complete UI overlay
  _renderLevelCompleteOverlay() {
    const ctx = this.ctx;
    const w = this.viewport.w / this.dpr;
    const h = this.viewport.h / this.dpr;
    const T = this._levelComplete;
    const t = Math.min(1, T.t / (T.duration * 0.45)); // animate in during first 45% of duration

    // dim background
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.45 * t})`;
    ctx.fillRect(0, 0, w, h);

    // main "LEVEL" title - pop/scale animation
    const centerX = w * 0.5;
    const centerY = h * 0.42;
    const scale = 0.6 + 0.6 * t; // from 0.6 -> 1.2
    ctx.translate(centerX, centerY);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#e6e6e6";
    ctx.font = `${48 * scale}px "Lucky Guy", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("LEVEL", 0, 0);

    // subtile: "PRÓXIMO LEVEL" slides up during hold phase
    const holdStart = T.duration * 0.45;
    const holdEnd = T.duration * 0.85;
    let subT = 0;
    if (T.t > holdStart) subT = Math.min(1, (T.t - holdStart) / (holdEnd - holdStart));
    const subY = 48 + (1 - subT) * 24;
    ctx.font = `20px "Lucky Guy", sans-serif`;
    ctx.fillStyle = "#ff6f3d";
    ctx.fillText("PRÓXIMO LEVEL", 0, subY);

    // Special celebratory text for every 10th level
    // (shows "UAAUUUU" when current level is a multiple of 10)
    if (this.levelIndex % 10 === 0) {
      const beat = Math.min(1, (T.t / Math.max(0.001, T.duration * 0.25)));
      const pop = 1 + Math.sin(beat * Math.PI) * 0.18; // subtle pulse
      ctx.font = `${28 * pop}px "Lucky Guy", sans-serif`;
      ctx.fillStyle = "#36c67a";
      ctx.fillText("UAAUUUU", 0, -72);
    }

    ctx.restore();
  }

  // draw death overlay UI
  _renderDeathOverlay() {
    const ctx = this.ctx;
    const w = this.viewport.w / this.dpr;
    const h = this.viewport.h / this.dpr;
    const T = this._death;
    const t = Math.min(1, T.t / (T.duration * 0.6)); // intro eased

    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.55 * t})`;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.95;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${36 + 12 * t}px "Lucky Guy", sans-serif`;
    ctx.fillText("MORRI", w * 0.5, h * 0.45);

    ctx.font = `18px "Lucky Guy", sans-serif`;
    ctx.fillStyle = "#ff6f3d";
    ctx.fillText("(fui burro de mais)", w * 0.5, h * 0.55);
    ctx.restore();
  }

  _drawBackground() {
    const ctx = this.ctx;
    const w = this.viewport.w / this.dpr;
    const h = this.viewport.h / this.dpr;

    // horizon gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#101518");
    grad.addColorStop(1, "#0f1416");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // simple parallax hills
    ctx.save();
    const cam = this.camera.x;
    ctx.translate(-cam * 0.2, 0);
    ctx.fillStyle = "#162024";
    for (let i = -1; i < 6; i++) {
      const bx = i * 240;
      ctx.fillRect(bx, h - 140, 240, 140);
    }
    ctx.translate(-cam * 0.3, 0);
    ctx.fillStyle = "#1b2529";
    for (let i = -1; i < 6; i++) {
      const bx = i * 300;
      ctx.fillRect(bx, h - 90, 300, 90);
    }
    ctx.restore();
  }
}