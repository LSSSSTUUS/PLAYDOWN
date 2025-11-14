import { Game } from "./src/game.js";
import { Input } from "./src/input.js";
import { MusicLoop, Sfx } from "./src/audio.js";

const canvas = document.getElementById("game");
const levelLabel = document.getElementById("levelLabel");
const fpsLabel = document.getElementById("fpsLabel");
const musicBtn = document.getElementById("musicBtn");

const input = new Input({
  leftEl: document.querySelector(".btn.left"),
  rightEl: document.querySelector(".btn.right"),
  jumpEl: document.querySelector(".btn.jump"),
});

const sfx = new Sfx();
const game = new Game(canvas, input, {
  onLevelChange: (lv) => {
    levelLabel.textContent = `Lv ${lv}`;
  },
  onFps: (fps) => {
    fpsLabel.textContent = fps ? `${fps} fps` : "";
  },
  onJump: () => { sfx.playJump(); },
  onStep: () => { sfx.playStep(); },
  onDeath: () => { sfx.playDeath(); },
  onLevelComplete: () => { sfx.playLevel(); }
});

// Try to restore saved state (level and player) from localStorage
(function restoreState() {
  try {
    const raw = localStorage.getItem("platformer_state_v1");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.levelIndex && Number.isFinite(data.levelIndex)) {
      game.levelIndex = Math.max(1, data.levelIndex | 0);
      game.resetLevel();
      // restore player position/velocity if available
      if (data.player && typeof data.player.x === "number") {
        game.player.x = Math.max(0, Math.min(game.level.world.w - game.player.w, data.player.x));
        if (typeof data.player.y === "number") game.player.y = Math.min(game.level.world.h - game.player.h, data.player.y);
        if (typeof data.player.vx === "number") game.player.vx = data.player.vx;
        if (typeof data.player.vy === "number") game.player.vy = data.player.vy;
      }
    }
  } catch (e) {
    console.warn("Failed to restore state:", e);
  }
})();

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  game.setViewport(canvas.width, canvas.height, dpr);
}
resize();

window.addEventListener("resize", resize, { passive: true });
window.addEventListener("orientationchange", resize, { passive: true });

game.start();

// Save function
function saveState() {
  try {
    const data = {
      levelIndex: game.levelIndex,
      player: {
        x: game.player.x,
        y: game.player.y,
        vx: game.player.vx,
        vy: game.player.vy
      },
      timestamp: Date.now()
    };
    localStorage.setItem("platformer_state_v1", JSON.stringify(data));
  } catch (e) {
    // ignore quota / storage errors
  }
}

// Save on visibility change (user switches app) and before unload
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveState();
});
window.addEventListener("pagehide", saveState, { passive: true });
window.addEventListener("beforeunload", saveState);

// ---------- Music initialization ----------
// create a MusicLoop instance and start it on first user gesture.
// The loop will run via WebAudio and is toggleable via the 50x50 button.

const music = new MusicLoop({ volume: 0.12 }); // moderate default volume

let userInteracted = false;
function ensureAudioStarted() {
  if (userInteracted) return;
  userInteracted = true;
  music.start(); // will resume AudioContext if needed
  // ensure SFX audio context is resumed/created too
  sfx.ensureResume();
  musicBtn.setAttribute("aria-pressed", "true");
}

// Toggle handler
musicBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!userInteracted) {
    ensureAudioStarted();
    return;
  }
  if (music.isPlaying()) {
    music.stop();
    musicBtn.setAttribute("aria-pressed", "false");
  } else {
    music.start();
    musicBtn.setAttribute("aria-pressed", "true");
  }
});

// Also start music on first game input (touch/keyboard) for better autoplay behavior
window.addEventListener("pointerdown", ensureAudioStarted, { once: true, passive: true });
window.addEventListener("keydown", ensureAudioStarted, { once: true, passive: true });