/* KOL Fighter - canonical pose list with L/R variants */
window.KOL_FIGHTER_POSES = (function () {
 'use strict';

 const BASE = [
 'idle', 'idleBreath',
 'walkForward1', 'walkForward2', 'walkBackward1', 'walkBackward2',
 'crouch',
 'jump', 'jumpPeak', 'falling',
 'blockHigh', 'blockLow',
 'hitStun', 'crouchHitStun',
 'knockdown', 'getUp',
 'victory', 'defeat',
 'highPunch', 'highKick', 'lowPunch', 'lowKick',
 'medPunch', 'medKick', 'special1', 'special2',
 'throw', 'thrown'
 ];

 const BOSS = [
 'phase2', 'phase3', 'taunt', 'summon', 'heavySpecialWindup'
 ];

 const GROUPS = {
 idle: ['idle', 'idleBreath'],
 facing: ['idle', 'idleBreath'],
 walk: ['walkForward1', 'walkForward2', 'walkBackward1', 'walkBackward2'],
 air: ['jump', 'jumpPeak', 'falling'],
 crouch: ['crouch'],
 block: ['blockHigh', 'blockLow'],
 hurt: ['hitStun', 'crouchHitStun', 'knockdown', 'getUp'],
 result: ['victory', 'defeat'],
 attack: [
 'highPunch', 'highKick', 'lowPunch', 'lowKick',
 'medPunch', 'medKick', 'special1', 'special2', 'throw', 'thrown'
 ],
 boss: BOSS
 };

 const LABELS = {
 idle: 'Idle', idleBreath: 'Idle (breath)',
 walkForward1: 'Walk Forward 1', walkForward2: 'Walk Forward 2',
 walkBackward1: 'Walk Backward 1', walkBackward2: 'Walk Backward 2',
 crouch: 'Crouch / Kneel',
 jump: 'Jump', jumpPeak: 'Jump Peak', falling: 'Falling / Landing',
 blockHigh: 'Block High', blockLow: 'Block Low',
 hitStun: 'Hit Stun', crouchHitStun: 'Crouch Hit Stun',
 knockdown: 'Knockdown', getUp: 'Get Up',
 victory: 'Victory', defeat: 'Defeat',
 highPunch: 'High Punch', highKick: 'High Kick',
 lowPunch: 'Low Punch', lowKick: 'Low Kick',
 medPunch: 'Medium Punch', medKick: 'Medium Kick',
 special1: 'Special 1', special2: 'Special 2',
 throw: 'Throw / Grab', thrown: 'Being Thrown',
 phase2: 'Phase 2', phase3: 'Phase 3',
 taunt: 'Taunt / Laugh', summon: 'Summon (Pond0x / PORK)',
 heavySpecialWindup: 'Heavy Special Wind-up'
 };

 function allBases(includeBoss) {
 return includeBoss ? BASE.concat(BOSS) : BASE.slice();
 }

 function frameKeys(includeBoss) {
 const keys = [];
 allBases(includeBoss).forEach(function (base) {
 keys.push(base + 'R', base + 'L');
 });
 return keys;
 }

 function side(facing) {
 return facing > 0 ? 'R' : 'L';
 }

 function key(base, facing) {
 return base + side(facing);
 }

 /** Map fighter state -> base pose name (before L/R suffix). */
 function resolve(f) {
 if (f.poseOverride) return f.poseOverride;

 if (f.victory) return 'victory';
 if (f.defeat) return 'defeat';

 if (f.knockdown > 0) {
 return f.knockdown < 18 ? 'getUp' : 'knockdown';
 }

 if (f.beingThrown > 0) return 'thrown';

 if (f.boss && f.taunt > 0) return 'taunt';
 if (f.boss && f.summonPose > 0) return 'summon';
 if (f.boss && f.attack === 'special' && f.attackTimer != null && f.attackTimer < 8) {
 return f.phase >= 3 ? 'heavySpecialWindup' : 'special1';
 }
 if (f.boss && f.phase >= 3 && !f.attack && !f.hitstun && Math.sin(f.anim || 0) > 0.92) {
 return 'phase3';
 }
 if (f.boss && f.phase >= 2 && !f.attack && !f.hitstun && Math.sin(f.anim || 0) > 0.88) {
 return 'phase2';
 }

 if (f.hitstun > 0) return f.crouch ? 'crouchHitStun' : 'hitStun';

 if (!f.onGround) {
 if (f.vy < -1.8) return 'jump';
 if (f.vy > 1.8) return 'falling';
 return 'jumpPeak';
 }

 if (f.block) return f.crouch ? 'blockLow' : 'blockHigh';
 if (f.crouch) return 'crouch';

 if (f.attack && f.attackTimer != null) {
 const k = f.attack;
 const t = f.attackTimer;
 const phase = f.attackPhase || 'active';

 if (phase === 'startup') {
 return f.crouch ? 'crouch' : 'idle';
 }
 if (phase === 'recovery') {
 if (k === 'throw') return 'throw';
 return f.crouch ? 'crouch' : 'idle';
 }

 if (k === 'throw') return 'throw';
 if (k === 'special') return t < 12 ? 'special1' : 'special2';
 if (k === 'heavy') return f.crouch ? 'lowKick' : 'highKick';
 if (k === 'low') return f.crouch ? 'lowPunch' : 'lowKick';
 if (k === 'med') return f.crouch ? 'lowPunch' : 'medPunch';
 if (k === 'high') return f.crouch ? 'lowPunch' : 'highPunch';
 }

 if (Math.abs(f.vx) > 0.15) {
 const movingForward = (f.vx > 0 && f.facing > 0) || (f.vx < 0 && f.facing < 0);
 const alt = Math.sin(f.anim || 0) > 0;
 if (movingForward) return alt ? 'walkForward1' : 'walkForward2';
 return alt ? 'walkBackward1' : 'walkBackward2';
 }

 if (Math.sin(f.anim || 0) > 0.97) return 'idleBreath';
 return 'idle';
 }

 function resolveKey(f) {
 return key(resolve(f), f.facing);
 }

 /** Base pose -> PNG filename (without -r/-l suffix) */
 const FILE_SLUG = {
 idle: 'idle', idleBreath: 'idle-breath',
 walkForward1: 'walk-forward-1', walkForward2: 'walk-forward-2',
 walkBackward1: 'walk-backward-1', walkBackward2: 'walk-backward-2',
 crouch: 'crouch', jump: 'jump', jumpPeak: 'jump-peak', falling: 'falling',
 blockHigh: 'block-high', blockLow: 'block-low',
 hitStun: 'hit-stun', crouchHitStun: 'crouch-hit-stun',
 knockdown: 'knockdown', getUp: 'get-up',
 victory: 'victory', defeat: 'defeat',
 highPunch: 'high-punch', highKick: 'high-kick',
 lowPunch: 'low-punch', lowKick: 'low-kick',
 medPunch: 'med-punch', medKick: 'med-kick',
 special1: 'special-1', special2: 'special-2',
 throw: 'throw', thrown: 'thrown',
 phase2: 'phase-2', phase3: 'phase-3', taunt: 'taunt',
 summon: 'summon', heavySpecialWindup: 'heavy-special-windup'
 };

 function posePath(slug, base, facing) {
 const file = (FILE_SLUG[base] || base) + (facing > 0 ? '-r' : '-l') + '.png';
 return slug + '/poses/' + file;
 }

 function sheetKey(base, facing) {
 return base + (facing > 0 ? 'R' : 'L');
 }

 /** Legacy 8-pose names for old previews / fallbacks */
 const LEGACY = {
 idle: 'idle', walk1: 'walkForward1', walk2: 'walkForward2',
 punch: 'highPunch', kick: 'highKick', jump: 'jump',
 crouch: 'crouch', hit: 'hitStun'
 };

 return {
 BASE, BOSS, GROUPS, LABELS, LEGACY, FILE_SLUG,
 allBases, frameKeys, side, key, sheetKey, posePath, resolve, resolveKey
 };
})();