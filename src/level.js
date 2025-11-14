import seedrandom from "seedrandom";

export class Level {
  constructor(index) {
    this.index = Math.max(1, index | 0);
    this.platforms = [];
    this.hazards = [];
    this.boss = null; // new: optional boss for special levels
    this.goal = { x: 0, y: 0, w: 28, h: 44 };
    this.gravity = 1200;
    this.playerStart = { x: 40, y: 0 };
    this._generate();
  }

  _rand() {
    if (!this._rng) this._rng = seedrandom(`lv-${this.index}`);
    return this._rng();
  }

  _range(min, max) {
    return min + (max - min) * this._rand();
  }

  _pick(arr) {
    return arr[(this._rand() * arr.length) | 0];
  }

  _generate() {
    const difficulty = Math.min(1, (this.index - 1) / 5000);
    const length = 2400 + Math.floor(difficulty * 2600); // world width
    const baseY = 300; // baseline platform height
    const layers = 3 + ((difficulty * 3) | 0);
    const platformCount = 14 + ((difficulty * 20) | 0);
    const gapMin = 60;
    const gapMax = 180 + ((difficulty * 80) | 0);

    // Start platform
    this.platforms.push({ x: 0, y: baseY, w: 180, h: 20 });

    let x = 200;
    for (let i = 0; i < platformCount; i++) {
      const gap = this._range(gapMin, gapMax);
      x += gap;
      const w = this._range(80, 160 - difficulty * 40);
      const layer = (i % layers);
      const y = baseY - layer * (60 + difficulty * 20) + this._range(-10, 10);
      this.platforms.push({ x, y, w, h: 20 });

      // Occasionally add higher small platforms
      if (this._rand() < 0.25) {
        // Ensure small platforms are reachable: cap rise to player's max jump height
        const playerJumpVy = 480; // matches game's jump impulse
        const maxJumpRise = Math.max(40, Math.min(120, (playerJumpVy * playerJumpVy) / (2 * this.gravity) - 8));
        const hx = x + this._range(20, w - 30);
        const hy = y - this._range(40, maxJumpRise);
        this.platforms.push({ x: hx, y: hy, w: this._range(40, 70), h: 18 });
      }

      // Hazards under gaps — ensure spikes fill the hole for every gap
      {
        const hzW = Math.max(40, gap - 10);
        const hzX = x - gap + (gap - hzW) * 0.5;
        const hzY = baseY + this._range(18, 30);
        this.hazards.push({ x: hzX, y: hzY, w: hzW, h: 10 });
      }
    }

    // End platform and goal
    const endX = x + 220;
    const endY = baseY - ((layers - 1) * (60 + difficulty * 20)) + this._range(-10, 10);
    this.platforms.push({ x: endX - 120, y: endY, w: 180, h: 22 });
    this.goal.x = endX - 40;
    this.goal.y = endY - 44;

    // Every 20th level: place a boss near the end
    if (this.index % 20 === 0) {
      const bx = endX + 60;
      const by = endY - 60;
      this.boss = { x: bx, y: by, w: 96, h: 96, hp: 1 };
      // ensure world contains boss
      this.world = { w: Math.max(endX + 300 + 200, length), h: 900 };
    } else {
      // Clamp world width
      this.world = { w: Math.max(endX + 300, length), h: 900 };
    }

    // Player start on first platform
    this.playerStart.x = 30;
    this.playerStart.y = this.platforms[0].y - 40;
  }
}