/**
 * GTA-style input: WASD, mouse orbit (pointer lock), jump, run, interact.
 */
(function (global) {
  "use strict";

  const keys = Object.create(null);
  const stick = { x: 0, y: 0 };
  let jumpPressed = false;
  let actPressed = false;
  let yawDelta = 0;
  let pitchDelta = 0;
  let zoomDelta = 0;
  let pointerLocked = false;

  function init(canvas) {
    window.addEventListener("keydown", (e) => {
      keys[e.code] = true;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === "Space" && !e.repeat) jumpPressed = true;
      if (e.code === "KeyE" && !e.repeat) actPressed = true;
      if (e.code === "KeyV" && !e.repeat && window.JIMPTHY_VHS) JIMPTHY_VHS.toggle();
    });
    window.addEventListener("keyup", (e) => {
      keys[e.code] = false;
    });

    // Click canvas to lock pointer (GTA mouse look)
    if (canvas) {
      canvas.addEventListener("click", () => {
        if (!pointerLocked && canvas.requestPointerLock) {
          canvas.requestPointerLock();
        }
      });
      document.addEventListener("pointerlockchange", () => {
        pointerLocked = document.pointerLockElement === canvas;
      });
      document.addEventListener("mousemove", (e) => {
        if (!pointerLocked) return;
        yawDelta -= e.movementX * 0.0022;
        pitchDelta += e.movementY * 0.0016;
      });
      // Fallback: drag when not locked
      let dragging = false;
      let lx = 0,
        ly = 0;
      canvas.addEventListener("pointerdown", (e) => {
        if (pointerLocked) return;
        dragging = true;
        lx = e.clientX;
        ly = e.clientY;
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (_) {}
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!dragging || pointerLocked) return;
        yawDelta -= (e.clientX - lx) * 0.005;
        pitchDelta += (e.clientY - ly) * 0.0035;
        lx = e.clientX;
        ly = e.clientY;
      });
      canvas.addEventListener("pointerup", () => {
        dragging = false;
      });
      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        zoomDelta += e.deltaY * 0.01;
      }, { passive: false });
    }

    // Touch stick
    const stickEl = document.getElementById("stick");
    const knob = document.getElementById("knob");
    if (stickEl) {
      const setUI = (cx, cy) => {
        const r = stickEl.getBoundingClientRect();
        let dx = cx - (r.left + r.width / 2);
        let dy = cy - (r.top + r.height / 2);
        const max = r.width * 0.38;
        const len = Math.hypot(dx, dy) || 1;
        if (len > max) {
          dx = (dx / len) * max;
          dy = (dy / len) * max;
        }
        stick.x = dx / max;
        stick.y = dy / max;
        if (knob) knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      };
      const clear = () => {
        stick.x = 0;
        stick.y = 0;
        if (knob) knob.style.transform = "translate(-50%, -50%)";
      };
      stickEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        stickEl.setPointerCapture(e.pointerId);
        setUI(e.clientX, e.clientY);
      });
      stickEl.addEventListener("pointermove", (e) => {
        if (e.buttons) setUI(e.clientX, e.clientY);
      });
      stickEl.addEventListener("pointerup", clear);
      stickEl.addEventListener("pointercancel", clear);
    }

    const bj = document.getElementById("btn-jump");
    if (bj) {
      bj.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        jumpPressed = true;
      });
    }
    const ba = document.getElementById("btn-act");
    if (ba) {
      ba.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        actPressed = true;
      });
    }
  }

  /** Move axes relative to camera (GTA): W = camera forward on ground */
  function moveAxes() {
    let x = 0;
    let z = 0;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) z += 1;
    if (keys.KeyS || keys.ArrowDown) z -= 1;
    x += stick.x;
    z += -stick.y;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return {
      x,
      z,
      sprint: !!(keys.ShiftLeft || keys.ShiftRight),
    };
  }

  function consumeJumpEdge() {
    const v = jumpPressed;
    jumpPressed = false;
    return v;
  }

  function consumeAct() {
    const v = actPressed;
    actPressed = false;
    return v;
  }

  function consumeLook() {
    const y = yawDelta;
    const p = pitchDelta;
    const z = zoomDelta;
    yawDelta = 0;
    pitchDelta = 0;
    zoomDelta = 0;
    return { yaw: y, pitch: p, zoom: z };
  }

  global.JIMPTHY_INPUT = {
    init,
    keys,
    moveAxes,
    consumeJumpEdge,
    consumeAct,
    consumeLook,
    isPointerLocked: () => pointerLocked,
  };
})(window);
