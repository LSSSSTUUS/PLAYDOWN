export class Input {
  constructor({ leftEl, rightEl, jumpEl }) {
    this.state = { left: false, right: false, jump: false };
    this._bindButton(leftEl, "left");
    this._bindButton(rightEl, "right");
    this._bindButton(jumpEl, "jump");
    this._bindKeyboard();
  }

  _bindButton(el, key) {
    const on = (e) => { e.preventDefault(); this.state[key] = true; };
    const off = (e) => { e.preventDefault(); this.state[key] = false; };
    const leave = () => { this.state[key] = false; };

    el.addEventListener("touchstart", on, { passive: false });
    el.addEventListener("touchend", off, { passive: false });
    el.addEventListener("touchcancel", off, { passive: false });
    el.addEventListener("mousedown", on);
    el.addEventListener("mouseup", off);
    el.addEventListener("mouseleave", leave);
  }

  _bindKeyboard() {
    const down = (e) => {
      if (e.repeat) return;
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA": this.state.left = true; break;
        case "ArrowRight":
        case "KeyD": this.state.right = true; break;
        case "Space":
        case "ArrowUp":
        case "KeyW": this.state.jump = true; break;
      }
    };
    const up = (e) => {
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA": this.state.left = false; break;
        case "ArrowRight":
        case "KeyD": this.state.right = false; break;
        case "Space":
        case "ArrowUp":
        case "KeyW": this.state.jump = false; break;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
  }
}

