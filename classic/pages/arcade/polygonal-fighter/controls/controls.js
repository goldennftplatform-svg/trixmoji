/* Polygonal Fighter — PC + mobile input (canonical)
 *
 * PC:    WASD = 8-way move (diagonals normalized) · Arrow keys = attacks · Space = jump
 * Mobile: left virtual stick = WASD · right 4-button diamond = arrows
 * Pad:   left stick = move · face buttons / d-pad right cluster = attacks
 */
window.POLY_FIGHTER_CONTROLS = (function () {
  'use strict';

  /**
   * Attack diamond (same on PC arrows + mobile buttons + pad face):
   *
   *        ↑ / SPECIAL
   *  ← PUNCH          KICK →
   *        ↓ / BLOCK
   *
   * Throw = PUNCH + KICK together while in throw range.
   */
  const ATTACK = {
    punch: { key: 'ArrowLeft', code: 'ArrowLeft', mobileId: 'punch', label: 'PUNCH', poseTap: 'jab', poseHold: 'medPunch' },
    kick: { key: 'ArrowRight', code: 'ArrowRight', mobileId: 'kick', label: 'KICK', poseTap: 'lowKick', poseHold: 'medKick' },
    special: { key: 'ArrowUp', code: 'ArrowUp', mobileId: 'special', label: 'SPECIAL', poseTap: 'special1', poseHold: 'special2' },
    block: { key: 'ArrowDown', code: 'ArrowDown', mobileId: 'block', label: 'BLOCK', poseStand: 'blockHigh', poseCrouch: 'blockLow' }
  };

  /** WASD / stick axes — world or camera-relative later; values are unit vectors before normalize */
  const MOVE_KEYS = {
    KeyW: { x: 0, z: -1 }, // forward
    KeyS: { x: 0, z: 1 }, // back
    KeyA: { x: -1, z: 0 }, // left
    KeyD: { x: 1, z: 0 } // right
  };

  const JUMP_KEY = 'Space';
  const HOLD_MS = 200; // tap vs hold strength

  function createState() {
    return {
      keys: Object.create(null),
      stick: { x: 0, z: 0 }, // mobile / pad left stick -1..1
      buttons: {
        punch: false,
        kick: false,
        special: false,
        block: false,
        jump: false
      },
      holdStart: {
        punch: 0,
        kick: 0,
        special: 0
      }
    };
  }

  /** 8-way keyboard move from WASD (diagonals allowed, length normalized). */
  function moveFromKeys(keys) {
    let x = 0;
    let z = 0;
    if (keys.KeyW || keys.w || keys.W) z -= 1;
    if (keys.KeyS || keys.s || keys.S) z += 1;
    if (keys.KeyA || keys.a || keys.A) x -= 1;
    if (keys.KeyD || keys.d || keys.D) x += 1;
    return normalize2(x, z);
  }

  /** Merge keyboard WASD + virtual/pad stick into one move vector. */
  function resolveMove(state) {
    const k = moveFromKeys(state.keys);
    let x = k.x + (state.stick.x || 0);
    let z = k.z + (state.stick.z || 0);
    // clamp stick influence already -1..1; after add normalize again
    const m = normalize2(x, z);
    // deadzone
    if (m.len < 0.2) return { x: 0, z: 0, len: 0, crouch: false, forward: false };
    return {
      x: m.x,
      z: m.z,
      len: m.len,
      // crouch: pull stick/S mostly back+down style — pure S or stick z > 0.55 with low lateral
      crouch: m.z > 0.55 && Math.abs(m.x) < 0.45,
      forward: m.z < -0.35
    };
  }

  function normalize2(x, z) {
    const len = Math.sqrt(x * x + z * z);
    if (len < 1e-6) return { x: 0, z: 0, len: 0 };
    // critical: diagonal WASD must not be faster than cardinal
    return { x: x / len, z: z / len, len: Math.min(1, len) };
  }

  function attackHeld(state, name) {
    if (state.buttons[name]) return true;
    const a = ATTACK[name];
    if (!a) return false;
    return !!(state.keys[a.code] || state.keys[a.key]);
  }

  function jumpHeld(state) {
    return !!(state.buttons.jump || state.keys.Space || state.keys[' ']);
  }

  /**
   * Resolve one combat intent for this frame.
   * Returns { move, crouch, jump, block, attack, throw, strength }
   * attack: null | 'jab'|'medPunch'|... pose id intent names used by game.
   */
  function resolveIntent(state, opts) {
    opts = opts || {};
    const now = opts.now || performance.now();
    const inThrowRange = !!opts.inThrowRange;
    const move = resolveMove(state);

    const punch = attackHeld(state, 'punch');
    const kick = attackHeld(state, 'kick');
    const special = attackHeld(state, 'special');
    const block = attackHeld(state, 'block');
    const jump = jumpHeld(state);

    // track holds
    ['punch', 'kick', 'special'].forEach(function (n) {
      const down = n === 'punch' ? punch : n === 'kick' ? kick : special;
      if (down && !state.holdStart[n]) state.holdStart[n] = now;
      if (!down) state.holdStart[n] = 0;
    });

    // throw: punch+kick together
    if (punch && kick && inThrowRange) {
      return {
        move: move,
        crouch: move.crouch,
        jump: false,
        block: false,
        attack: 'throw',
        throw: true,
        strength: 'normal'
      };
    }

    if (block) {
      return {
        move: { x: 0, z: 0, len: 0, crouch: move.crouch, forward: false },
        crouch: move.crouch,
        jump: false,
        block: true,
        attack: null,
        throw: false,
        strength: 'normal',
        blockPose: move.crouch ? 'blockLow' : 'blockHigh'
      };
    }

    function strengthFor(name) {
      const t0 = state.holdStart[name];
      if (!t0) return 'light';
      const held = now - t0;
      if (move.forward) return 'heavy';
      if (held >= HOLD_MS) return 'medium';
      return 'light';
    }

    // priority: special > punch/kick (if both, prefer the one pressed — here special wins if held)
    if (special) {
      const s = strengthFor('special');
      return {
        move: move,
        crouch: move.crouch,
        jump: false,
        block: false,
        attack: s === 'medium' || s === 'heavy' ? 'special2' : 'special1',
        throw: false,
        strength: s
      };
    }

    if (punch) {
      const s = strengthFor('punch');
      let attack = 'jab';
      if (move.crouch) attack = 'lowPunch';
      else if (s === 'heavy') attack = 'heavyPunch';
      else if (s === 'medium') attack = 'medPunch';
      return {
        move: move,
        crouch: move.crouch,
        jump: false,
        block: false,
        attack: attack,
        throw: false,
        strength: s
      };
    }

    if (kick) {
      const s = strengthFor('kick');
      let attack = 'lowKick';
      if (s === 'heavy') attack = 'heavyKick';
      else if (s === 'medium') attack = 'medKick';
      else if (move.crouch) attack = 'lowKick';
      else attack = 'lowKick'; // light kick; med on hold
      if (s === 'light' && !move.crouch) attack = 'lowKick';
      return {
        move: move,
        crouch: move.crouch,
        jump: false,
        block: false,
        attack: attack,
        throw: false,
        strength: s
      };
    }

    return {
      move: move,
      crouch: move.crouch,
      jump: jump,
      block: false,
      attack: null,
      throw: false,
      strength: 'normal'
    };
  }

  /** Browser keyboard helpers */
  function bindKeyboard(state, target) {
    target = target || window;
    function down(e) {
      state.keys[e.code] = true;
      state.keys[e.key] = true;
      // prevent arrow/page scroll during fight
      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'Space'
      ) {
        e.preventDefault();
      }
    }
    function up(e) {
      state.keys[e.code] = false;
      state.keys[e.key] = false;
    }
    target.addEventListener('keydown', down, { passive: false });
    target.addEventListener('keyup', up, { passive: false });
    return function unbind() {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
    };
  }

  /** Set mobile stick from virtual joystick nx,ny in -1..1 (y up positive → convert to z back positive). */
  function setMobileStick(state, nx, ny) {
    // screen: up = forward = -z
    state.stick.x = nx;
    state.stick.z = -ny;
  }

  function setMobileButton(state, id, pressed) {
    if (id in state.buttons) state.buttons[id] = !!pressed;
  }

  return {
    ATTACK: ATTACK,
    MOVE_KEYS: MOVE_KEYS,
    JUMP_KEY: JUMP_KEY,
    HOLD_MS: HOLD_MS,
    createState: createState,
    moveFromKeys: moveFromKeys,
    resolveMove: resolveMove,
    resolveIntent: resolveIntent,
    bindKeyboard: bindKeyboard,
    setMobileStick: setMobileStick,
    setMobileButton: setMobileButton,
    normalize2: normalize2
  };
})();
