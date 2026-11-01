/* Polygonal Fighter — canonical pose registry (mobile-first 3D)
 * Aligns with window.KOL_FIGHTER_POSES where possible for KOL overlay.
 */
window.POLY_FIGHTER_POSES = (function () {
  'use strict';

  /** Tier A = MVP playable mobile/desktop. B = full standard. C = 3D extras. */
  const TIER_A = [
    'idle', 'idleBreath',
    'walkForward1', 'walkForward2', 'walkBackward1', 'walkBackward2',
    'crouch',
    'jump', 'jumpPeak', 'falling',
    'blockHigh', 'blockLow',
    'hitStun', 'crouchHitStun',
    'knockdown', 'getUp',
    'jab', 'medPunch', 'lowKick', 'medKick',
    'special1',
    'throw', 'thrown',
    'victory', 'defeat'
  ];

  const TIER_B = [
    'heavyPunch', 'lowPunch', 'heavyKick', 'highKick', 'special2'
  ];

  const TIER_C = [
    'dashForward', 'dashBack', 'sidestepL', 'sidestepR', 'taunt'
  ];

  const GROUPS = {
    stance: ['idle', 'idleBreath', 'crouch'],
    locomotion: [
      'walkForward1', 'walkForward2', 'walkBackward1', 'walkBackward2',
      'dashForward', 'dashBack', 'sidestepL', 'sidestepR'
    ],
    air: ['jump', 'jumpPeak', 'falling'],
    defense: ['blockHigh', 'blockLow'],
    hurt: ['hitStun', 'crouchHitStun', 'knockdown', 'getUp'],
    attack: [
      'jab', 'medPunch', 'heavyPunch', 'lowPunch',
      'lowKick', 'medKick', 'heavyKick', 'highKick',
      'special1', 'special2'
    ],
    throw: ['throw', 'thrown'],
    result: ['victory', 'defeat'],
    flavor: ['taunt']
  };

  const LABELS = {
    idle: 'Idle / Fight stance',
    idleBreath: 'Idle breath',
    walkForward1: 'Walk forward A',
    walkForward2: 'Walk forward B',
    walkBackward1: 'Walk back A',
    walkBackward2: 'Walk back B',
    crouch: 'Crouch',
    jump: 'Jump rise',
    jumpPeak: 'Jump peak',
    falling: 'Fall / land prep',
    blockHigh: 'Block high / mid',
    blockLow: 'Block low',
    hitStun: 'Hit stun (stand)',
    crouchHitStun: 'Hit stun (crouch)',
    knockdown: 'Knockdown',
    getUp: 'Get up',
    jab: 'Jab (light punch)',
    medPunch: 'Medium punch',
    heavyPunch: 'Heavy punch',
    lowPunch: 'Low punch',
    lowKick: 'Low kick',
    medKick: 'Medium kick',
    heavyKick: 'Heavy kick',
    highKick: 'High kick',
    special1: 'Special 1',
    special2: 'Special 2',
    throw: 'Throw (attacker)',
    thrown: 'Thrown (victim)',
    victory: 'Victory',
    defeat: 'Defeat',
    dashForward: 'Dash forward',
    dashBack: 'Dash back',
    sidestepL: 'Sidestep left',
    sidestepR: 'Sidestep right',
    taunt: 'Taunt'
  };

  /** kebab-case filenames for Blender actions / export clips */
  const FILENAME = {
    idle: 'idle',
    idleBreath: 'idle-breath',
    walkForward1: 'walk-forward-1',
    walkForward2: 'walk-forward-2',
    walkBackward1: 'walk-backward-1',
    walkBackward2: 'walk-backward-2',
    crouch: 'crouch',
    jump: 'jump',
    jumpPeak: 'jump-peak',
    falling: 'falling',
    blockHigh: 'block-high',
    blockLow: 'block-low',
    hitStun: 'hit-stun',
    crouchHitStun: 'crouch-hit-stun',
    knockdown: 'knockdown',
    getUp: 'get-up',
    jab: 'jab',
    medPunch: 'med-punch',
    heavyPunch: 'heavy-punch',
    lowPunch: 'low-punch',
    lowKick: 'low-kick',
    medKick: 'med-kick',
    heavyKick: 'heavy-kick',
    highKick: 'high-kick',
    special1: 'special-1',
    special2: 'special-2',
    throw: 'throw',
    thrown: 'thrown',
    victory: 'victory',
    defeat: 'defeat',
    dashForward: 'dash-forward',
    dashBack: 'dash-back',
    sidestepL: 'sidestep-l',
    sidestepR: 'sidestep-r',
    taunt: 'taunt'
  };

  /**
   * Map polygonal pose id → existing KOL_FIGHTER_POSES key (2D sprites).
   * Used when overlaying KOL identity onto shared 3D base animations.
   */
  const TO_KOL = {
    idle: 'idle',
    idleBreath: 'idleBreath',
    walkForward1: 'walkForward1',
    walkForward2: 'walkForward2',
    walkBackward1: 'walkBackward1',
    walkBackward2: 'walkBackward2',
    crouch: 'crouch',
    jump: 'jump',
    jumpPeak: 'jumpPeak',
    falling: 'falling',
    blockHigh: 'blockHigh',
    blockLow: 'blockLow',
    hitStun: 'hitStun',
    crouchHitStun: 'crouchHitStun',
    knockdown: 'knockdown',
    getUp: 'getUp',
    jab: 'highPunch',
    medPunch: 'medPunch',
    heavyPunch: 'highPunch',
    lowPunch: 'lowPunch',
    lowKick: 'lowKick',
    medKick: 'medKick',
    heavyKick: 'highKick',
    highKick: 'highKick',
    special1: 'special1',
    special2: 'special2',
    throw: 'throw',
    thrown: 'thrown',
    victory: 'victory',
    defeat: 'defeat',
    taunt: 'taunt'
  };

  /**
   * Canonical input (PC + mobile same logic):
   *   WASD / left stick  = 8-way move (diagonals normalized)
   *   Arrows / face btns = attack diamond
   *        ↑ SPECIAL
   *   ← PUNCH    KICK →
   *        ↓ BLOCK
   *   Space / jump pad = jump
   *   Punch+Kick close = throw
   */
  const INPUT = {
    move: 'WASD 8-way (W A S D + WA WD SA SD diagonals, speed normalized)',
    jump: 'Space',
    ArrowLeft: { action: 'punch', tap: 'jab', hold: 'medPunch', forward: 'heavyPunch', crouch: 'lowPunch' },
    ArrowRight: { action: 'kick', tap: 'lowKick', hold: 'medKick', forward: 'heavyKick' },
    ArrowUp: { action: 'special', tap: 'special1', hold: 'special2' },
    ArrowDown: { action: 'block', stand: 'blockHigh', crouch: 'blockLow' },
    throw: 'ArrowLeft+ArrowRight (punch+kick) in range'
  };

  /** @deprecated use INPUT — kept for older call sites */
  const MOBILE_INPUT = {
    stick: 'same as WASD 8-way including diagonals',
    P: INPUT.ArrowLeft,
    K: INPUT.ArrowRight,
    S: INPUT.ArrowUp,
    B: INPUT.ArrowDown,
    PK: INPUT.throw
  };

  function allIds(tier) {
    if (tier === 'A') return TIER_A.slice();
    if (tier === 'B') return TIER_A.concat(TIER_B);
    return TIER_A.concat(TIER_B, TIER_C);
  }

  function tierOf(id) {
    if (TIER_A.indexOf(id) >= 0) return 'A';
    if (TIER_B.indexOf(id) >= 0) return 'B';
    if (TIER_C.indexOf(id) >= 0) return 'C';
    return null;
  }

  /**
   * Resolve gameplay fighter state → pose id.
   * Mirrors KOL_FIGHTER_POSES.resolve with polygonal names + mobile moveset.
   */
  function resolve(f) {
    if (f.poseOverride) return f.poseOverride;

    if (f.victory) return 'victory';
    if (f.defeat) return 'defeat';

    if (f.knockdown > 0) {
      return f.knockdown < 18 ? 'getUp' : 'knockdown';
    }
    if (f.beingThrown > 0) return 'thrown';
    if (f.hitstun > 0) return f.crouch ? 'crouchHitStun' : 'hitStun';

    if (!f.onGround) {
      if (f.vy < -1.8) return 'jump';
      if (f.vy > 1.8) return 'falling';
      return 'jumpPeak';
    }

    if (f.block) return f.crouch ? 'blockLow' : 'blockHigh';
    if (f.crouch && !f.attack) return 'crouch';

    if (f.attack && f.attackTimer != null) {
      const k = f.attack;
      const phase = f.attackPhase || 'active';
      if (phase === 'startup' || phase === 'recovery') {
        if (k === 'throw') return 'throw';
        return f.crouch ? 'crouch' : 'idle';
      }
      if (k === 'throw') return 'throw';
      if (k === 'special') return (f.attackTimer < 12 ? 'special1' : 'special2');
      if (k === 'jab' || k === 'high') return 'jab';
      if (k === 'med') return f.crouch ? 'lowPunch' : 'medPunch';
      if (k === 'heavy') return f.crouch ? 'lowKick' : 'heavyKick';
      if (k === 'low') return f.crouch ? 'lowPunch' : 'lowKick';
      if (k === 'punch') return 'medPunch';
      if (k === 'kick') return 'medKick';
    }

    if (f.dash > 0) return f.dashDir >= 0 ? 'dashForward' : 'dashBack';
    if (f.sidestep) return f.sidestep < 0 ? 'sidestepL' : 'sidestepR';

    if (Math.abs(f.vx) > 0.15 || Math.abs(f.vz) > 0.15) {
      const forward =
        (f.vx * (f.facingX || f.facing || 1) + (f.vz || 0) * (f.facingZ || 0)) >= 0;
      const alt = Math.sin(f.anim || 0) > 0;
      if (forward) return alt ? 'walkForward1' : 'walkForward2';
      return alt ? 'walkBackward1' : 'walkBackward2';
    }

    if (Math.sin(f.anim || 0) > 0.97) return 'idleBreath';
    return 'idle';
  }

  function filename(id) {
    return FILENAME[id] || id;
  }

  function toKol(id) {
    return TO_KOL[id] || null;
  }

  return {
    TIER_A: TIER_A.slice(),
    TIER_B: TIER_B.slice(),
    TIER_C: TIER_C.slice(),
    GROUPS: GROUPS,
    LABELS: LABELS,
    FILENAME: FILENAME,
    TO_KOL: TO_KOL,
    INPUT: INPUT,
    MOBILE_INPUT: MOBILE_INPUT,
    allIds: allIds,
    tierOf: tierOf,
    resolve: resolve,
    filename: filename,
    toKol: toKol
  };
})();
