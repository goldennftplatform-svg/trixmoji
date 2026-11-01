const CONFIG = {
  W: 960,
  H: 540,
  SCROLL_BASE: 1.4,
  PLAYER_BASE_SPEED: 2.6,
  PLAYER_SPEED_STEP: 0.55,
  MAX_SPEED_LEVEL: 5,
  MAX_OPTIONS: 4,
  MAX_SHIELD: 3,
  FIRE_COOLDOWN: 9,
  LASER_COOLDOWN: 4,
  MISSILE_COOLDOWN: 22,
  INVULN_FRAMES: 90,
  CAPSULE_CHANCE: 0.22,
  START_LIVES: 3,
  // Gradius-scale but tall enough for pilot-on-rocket art
  PLAYER_W: 78,
  PLAYER_H: 48,
};

const POWER = [
  { id: "speed", label: "SPEED UP", color: "#4cf" },
  { id: "missile", label: "MISSILE", color: "#f84" },
  { id: "double", label: "DOUBLE", color: "#8f4" },
  { id: "laser", label: "LASER", color: "#4af" },
  { id: "option", label: "OPTION", color: "#ff4" },
  { id: "force", label: "?", color: "#c4f" },
  { id: "shield", label: "SHIELD", color: "#fff" },
];

const KEY = {
  left: false,
  right: false,
  up: false,
  down: false,
  fire: false,
  power: false,
  pause: false,
  start: false,
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function chance(p) {
  return Math.random() < p;
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
