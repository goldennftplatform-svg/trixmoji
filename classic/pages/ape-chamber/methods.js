/**
 * APE CHAMBER — WEEK 1 (mechanics pass)
 * 10 multi-stage chamber protocols. Add ~10/week → 100.
 *
 * Stage fields:
 *   at, ape, move, fx, caption
 *   roomShake  optional bool — heavy chamber rattle this beat
 *   runSpeed   optional number — for move:"run" (default 1)
 *   yBias      optional % — vertical bias for float/climb (default 58)
 */
const WEEK = 1;

/** Base protocols that must all be seen before PAULY PUNCH unlocks */
const BASE_PROTOCOL_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Secret unlock — only selectable after all 10 base executions are seen.
 * Ends with assets/media/pauly-punch.mp4
 */
const PAULY_PUNCH = {
  id: 99,
  type: "funny",
  special: true,
  unlock: "all_base",
  name: "Pauly Punch",
  era: "Secret option * unlock after all 10",
  desc: "A huge fist annihilates the glass case AND the ape. Guts, blood, water everywhere. Then the tape rolls. Select only after clearing all 10 protocols.",
  duration: 5800,
  video: "assets/media/pauly-punch.mp4",
  stages: [
    { at: 0, ape: "idle", move: "idle", fx: "none", caption: "Something's wrong with the feed…" },
    { at: 500, ape: "panic", move: "shake", fx: "pauly_shadow", caption: "HUGE FIST ENTERING FRAME—" },
    { at: 1300, ape: "panic", move: "thrash", fx: "pauly_fist", roomShake: true, caption: "PAULY PUNCH — CRASHING IN!!!" },
    { at: 2600, ape: "hide", move: "none", fx: "pauly_impact", roomShake: true, caption: "GLASS SHATTERED — DIRECT HIT!" },
    // Fist leaves once here — do not re-apply aftermath (would spawn a second fist)
    { at: 3800, ape: "hide", move: "none", fx: "pauly_aftermath", roomShake: true, caption: "GUTS. BLOOD. WATER." },
    { at: 5000, ape: "hide", move: "none", fx: "pauly_mess", caption: "ROLLING TAPE…" },
  ],
};

const METHODS = [
  /* ════════════════════════════════════════
     1. INCINERATION
     beat: heat → catch → long fire sprint → trip → burn out → bones
     ════════════════════════════════════════ */
  {
    id: 1,
    type: "historic",
    name: "Incineration",
    era: "Chamber kiln protocol",
    desc: "Floor vents light. Ape catches fire, sprints the glass in panic, trips, burns down to bones.",
    duration: 9200,
    stages: [
      { at: 0, ape: "idle", move: "idle", fx: "none", caption: "Floor vents hiss…" },
      { at: 700, ape: "panic", move: "shake", fx: "embers", caption: "Heat spike — fur smokes!" },
      { at: 1600, ape: "panic", move: "stagger", fx: "embers_hot", caption: "Soles burning — can't stand still!" },
      { at: 2600, ape: "fire_run", move: "run", runSpeed: 1.35, fx: "inferno", roomShake: true, caption: "ON FIRE — SPRINTING!" },
      { at: 4800, ape: "fire_run", move: "run", runSpeed: 1.75, fx: "inferno_max", roomShake: true, caption: "FASTER — glass walls only!" },
      { at: 6400, ape: "fire_run", move: "spin", fx: "inferno_max", caption: "Trips — spinning out!" },
      { at: 7200, ape: "dead", move: "none", fx: "inferno", caption: "Down… still burning…" },
      { at: 8200, ape: "skeleton", move: "none", fx: "ash", caption: "Fire dies. Only bones." },
    ],
  },

  /* ════════════════════════════════════════
     2. PIRANHA TORNADO
     beat: fill steps → dunk → fish enter → cyclone → frenzy → drain bones
     ════════════════════════════════════════ */
  {
    id: 2,
    type: "historic",
    name: "Piranha Tornado",
    era: "Aquatic chamber mode",
    desc: "Water floods in. Piranhas form a spinning tornado. When the water drains — only a skeleton.",
    duration: 10000,
    stages: [
      { at: 0, ape: "idle", move: "idle", fx: "none", caption: "Drains reverse…" },
      { at: 400, ape: "panic", move: "shake", fx: "water_15", caption: "Ankle-deep!" },
      { at: 1200, ape: "panic", move: "stagger", fx: "water_40", caption: "Waist-high — panicking!" },
      { at: 2200, ape: "drown", move: "float", yBias: 48, fx: "water_100", caption: "Fully under!" },
      { at: 3200, ape: "drown", move: "thrash", yBias: 45, fx: "piranha_enter", caption: "Something's in the water…" },
      { at: 4200, ape: "drown", move: "spin", yBias: 50, fx: "piranha_tornado", roomShake: true, caption: "PIRANHA TORNADO!" },
      { at: 6200, ape: "hide", move: "none", fx: "piranha_frenzy", roomShake: true, caption: "Feeding frenzy — red water!" },
      { at: 7800, ape: "skeleton", move: "none", fx: "water_drain", caption: "Draining…" },
      { at: 9000, ape: "skeleton", move: "none", fx: "none", caption: "Bones on dry glass." },
    ],
  },

  /* ════════════════════════════════════════
     3. GAS CHAMBER
     beat: wisps → fill → wall-run panic → stagger → drop → clear
     ════════════════════════════════════════ */
  {
    id: 3,
    type: "historic",
    name: "Gas Chamber",
    era: "20th c. sealed-room tech",
    desc: "Green gas fills the box. Ape coughs, sprints the walls, staggers, drops. Fog clears on a still body.",
    duration: 8500,
    stages: [
      { at: 0, ape: "idle", move: "idle", fx: "none", caption: "Pellet tray arms…" },
      { at: 500, ape: "idle", move: "shake", fx: "gas_wisp", caption: "First wisps from the floor…" },
      { at: 1400, ape: "panic", move: "shake", fx: "gas_green", caption: "Coughing — gas rising!" },
      { at: 2600, ape: "panic", move: "run", runSpeed: 1.15, fx: "gas_green", caption: "Can't breathe — running walls!" },
      { at: 4500, ape: "panic", move: "stagger", fx: "gas_thick", caption: "Legs giving out…" },
      { at: 5800, ape: "dead", move: "none", fx: "gas_thick", caption: "Collapsed in the fog…" },
      { at: 7200, ape: "dead", move: "none", fx: "gas_fade", caption: "Fog thins. Chamber clear." },
    ],
  },

  /* ════════════════════════════════════════
     4. ELECTROCUTION
     beat: charge → zap jump → locked arc → max flash → blackout → smoke
     ════════════════════════════════════════ */
  {
    id: 4,
    type: "historic",
    name: "Electrocution",
    era: "Live-floor protocol",
    desc: "Metal floor goes hot. Ape spasms in white arcs, locks up mid-air feel, drops smoking.",
    duration: 8000,
    stages: [
      { at: 0, ape: "idle", move: "idle", fx: "none", caption: "Capacitors charging…" },
      { at: 600, ape: "panic", move: "shake", fx: "charge_glow", caption: "Floor humming…" },
      { at: 1300, ape: "electro", move: "spasm", fx: "zap_hit", roomShake: true, caption: "FIRST HIT!" },
      { at: 2200, ape: "electro", move: "spasm", fx: "electric_full", roomShake: true, caption: "Locked in the arc!" },
      { at: 3800, ape: "electro", move: "spasm", fx: "electric_max", roomShake: true, caption: "OVERLOAD — whiteout!" },
      { at: 5200, ape: "electro", move: "none", fx: "blackout", caption: "Power cut…" },
      { at: 6000, ape: "dead", move: "none", fx: "smoke", caption: "Smoke. Circuit open." },
      { at: 7200, ape: "dead", move: "none", fx: "smoke_light", caption: "Still smoking." },
    ],
  },

  /* ════════════════════════════════════════
     5. BEE SWARM
     beat: hatch → few bees → chase → blanket → thrash → settle
     ════════════════════════════════════════ */
  {
    id: 5,
    type: "historic",
    name: "Bee Swarm",
    era: "Apian punishment lore",
    desc: "Hatches dump bees. Ape flails, gets chased, blanketed, goes down under a living cloud.",
    duration: 9000,
    stages: [
      { at: 0, ape: "idle", move: "idle", fx: "none", caption: "Ceiling hatches click…" },
      { at: 500, ape: "panic", move: "shake", fx: "bees_few", caption: "First scouts…" },
      { at: 1400, ape: "panic", move: "run", runSpeed: 1.2, fx: "bees_swarm", caption: "Swarm pouring in — run!" },
      { at: 3400, ape: "panic", move: "run", runSpeed: 1.5, fx: "bees_chase", roomShake: true, caption: "They're following!" },
      { at: 5200, ape: "panic", move: "thrash", fx: "bees_thick", caption: "Blanketed — can't see!" },
      { at: 6800, ape: "dead", move: "none", fx: "bees_thick", caption: "Down under the cloud…" },
      { at: 8000, ape: "dead", move: "none", fx: "bees_settle", caption: "Swarm settles. Ape still." },
    ],
  },

  /* ════════════════════════════════════════
     6. DROWNING
     beat: rise in steps, climb water line, thrash ceiling, dunk, bubbles die, sink
     ════════════════════════════════════════ */
  {
    id: 6,
    type: "historic",
    name: "Drowning",
    era: "Flood-cell protocol",
    desc: "Cold water climbs the glass. Ape climbs with it, thrashes the ceiling line, then slips under for good.",
    duration: 9500,
    stages: [
      { at: 0, ape: "idle", move: "idle", fx: "none", caption: "Inlets open…" },
      { at: 400, ape: "panic", move: "shake", fx: "water_15", caption: "Ankle-deep — cold!" },
      { at: 1400, ape: "panic", move: "stagger", fx: "water_40", caption: "Waist-deep!" },
      { at: 2600, ape: "panic", move: "climb", yBias: 42, fx: "water_70", caption: "Chest-high — climbing glass!" },
      { at: 4000, ape: "drown", move: "thrash", yBias: 32, fx: "water_100", caption: "Ceiling line — thrashing!" },
      { at: 5600, ape: "drown", move: "float", yBias: 50, fx: "water_100", caption: "Under — bubbles…" },
      { at: 7200, ape: "drown", move: "sink", fx: "water_100_quiet", caption: "Bubbles slowing…" },
      { at: 8600, ape: "dead", move: "none", yBias: 78, fx: "water_100_quiet", caption: "Surface still. No more bubbles." },
    ],
  },

  /* ════════════════════════════════════════
     7. ALIEN FART CLOUD
     beat: UFO dock → first honk → run → second honk → thick soup → comic death
     ════════════════════════════════════════ */
  {
    id: 7,
    type: "funny",
    name: "Alien Fart Cloud",
    era: "Area 51 breakroom",
    desc: "UFO docks the vents. Neon green honk-fog fills the box. Ape holds nose, runs, then taps out.",
    duration: 8800,
    stages: [
      { at: 0, ape: "idle", move: "idle", fx: "none", caption: "UFO docks the vents…" },
      { at: 600, ape: "panic", move: "shake", fx: "fart_puff", caption: "*PPBBBBT* — first cloud!" },
      { at: 1600, ape: "panic", move: "run", runSpeed: 1.25, fx: "fart_cloud", caption: "Holding nose — still running!" },
      { at: 3400, ape: "panic", move: "run", runSpeed: 1.4, fx: "fart_double", roomShake: true, caption: "*PPBBT PPBBT* — encore!" },
      { at: 5000, ape: "panic", move: "stagger", fx: "fart_thick", caption: "Visibility zero. Dignity zero." },
      { at: 6500, ape: "dead", move: "none", fx: "fart_thick", caption: "Tapped out by smell." },
      { at: 7800, ape: "dead", move: "none", fx: "fart_haze", caption: "Abducted by atmosphere." },
    ],
  },

  /* ════════════════════════════════════════
     8. CRYO FREEZE
     beat: frost → shiver → slow stagger → lock ice → thicken → crack
     ════════════════════════════════════════ */
  {
    id: 8,
    type: "historic",
    name: "Cryo Freeze",
    era: "Lab extreme-cold cell",
    desc: "Cryo jets dump frost. Ape shivers, slows to a crawl, locks into an ice block. Crack. Stillness.",
    duration: 8500,
    stages: [
      { at: 0, ape: "idle", move: "idle", fx: "none", caption: "Cryo coils spooling…" },
      { at: 500, ape: "panic", move: "shake", fx: "frost", caption: "Temperature freefall!" },
      { at: 1600, ape: "panic", move: "shiver", fx: "frost", caption: "Shivering hard…" },
      { at: 3000, ape: "panic", move: "stagger", fx: "frost_heavy", caption: "Muscles locking…" },
      { at: 4400, ape: "frozen", move: "none", fx: "ice_block", caption: "FROZEN SOLID." },
      { at: 5800, ape: "frozen", move: "none", fx: "ice_thick", caption: "Ice thickening…" },
      { at: 7200, ape: "frozen", move: "none", fx: "ice_crack", roomShake: true, caption: "CRACK. No thaw scheduled." },
    ],
  },

  /* ════════════════════════════════════════
     9. ACID BATH
     beat: sizzle → rise feet → run walls → climb → submerge dissolve → bones
     ════════════════════════════════════════ */
  {
    id: 9,
    type: "historic",
    name: "Acid Bath",
    era: "Industrial waste cell",
    desc: "Green acid rises from the grate. Ape climbs the air. When the level drops — skeleton only.",
    duration: 9500,
    stages: [
      { at: 0, ape: "idle", move: "idle", fx: "none", caption: "Grate gurgles…" },
      { at: 500, ape: "panic", move: "shake", fx: "acid_sizzle", caption: "Sizzle on the floor!" },
      { at: 1300, ape: "panic", move: "run", runSpeed: 1.3, fx: "acid_25", caption: "Feet burning — run!" },
      { at: 2800, ape: "panic", move: "climb", yBias: 40, fx: "acid_55", caption: "Climbing the glass!" },
      { at: 4200, ape: "panic", move: "thrash", yBias: 35, fx: "acid_100", caption: "Submerged in green…" },
      { at: 5600, ape: "hide", move: "none", fx: "acid_100", caption: "Dissolving…" },
      { at: 7000, ape: "skeleton", move: "none", fx: "acid_drain", caption: "Acid reclaiming…" },
      { at: 8600, ape: "skeleton", move: "none", fx: "none", caption: "Bones only." },
    ],
  },

  /* ════════════════════════════════════════
     10. VACUUM SEAL
     beat: pumps → pull center → desperate run → pull harder → squash → dead
     ════════════════════════════════════════ */
  {
    id: 10,
    type: "historic",
    name: "Vacuum Seal",
    era: "Industrial / space sim",
    desc: "Pumps roar. Air leaves the box. Ape is dragged, panics, then physics wins.",
    duration: 8200,
    stages: [
      { at: 0, ape: "idle", move: "idle", fx: "none", caption: "Pumps online…" },
      { at: 500, ape: "panic", move: "shake", fx: "vacuum", roomShake: true, caption: "Pressure dropping!" },
      { at: 1400, ape: "panic", move: "pull", fx: "vacuum", caption: "Dragged toward center…" },
      { at: 2600, ape: "panic", move: "run", runSpeed: 1.45, fx: "vacuum_hard", roomShake: true, caption: "Fighting the pull!" },
      { at: 4200, ape: "panic", move: "pull", fx: "vacuum_max", roomShake: true, caption: "Ears pop — vision tunnels!" },
      { at: 5600, ape: "panic", move: "squash", fx: "vacuum_max", caption: "Soft tissue vs physics…" },
      { at: 6800, ape: "dead", move: "none", fx: "vacuum", caption: "Hard vacuum. Hard stop." },
      { at: 7600, ape: "dead", move: "none", fx: "vacuum_quiet", caption: "Silence." },
    ],
  },
];

/** All selectable methods once unlocked (base + secret) */
function getAllMethods() {
  return [...METHODS, PAULY_PUNCH];
}

const SPRITES = {
  idle: "assets/sprites/idle.png",
  panic: "assets/sprites/panic.png",
  fire_run: "assets/sprites/fire_run.png",
  electro: "assets/sprites/electro.png",
  drown: "assets/sprites/drown.png",
  frozen: "assets/sprites/frozen.png",
  dead: "assets/sprites/dead.png",
  skeleton: "assets/sprites/skeleton.png",
};
