"""Compose fighting poses by moving limbs independently from one idle sprite."""
import math

from PIL import Image

PARTS = {
    "head": (0.22, 0.00, 0.78, 0.24),
    "torso": (0.20, 0.22, 0.80, 0.56),
    "arm_l": (0.00, 0.28, 0.34, 0.58),
    "arm_r": (0.66, 0.28, 1.00, 0.58),
    "leg_l": (0.14, 0.54, 0.48, 0.88),
    "leg_r": (0.52, 0.54, 0.86, 0.88),
    "foot_l": (0.08, 0.84, 0.44, 1.00),
    "foot_r": (0.56, 0.84, 0.92, 1.00),
}

PIVOT = {
    "head": (0.5, 0.95),
    "torso": (0.5, 0.95),
    "arm_l": (0.92, 0.08),
    "arm_r": (0.08, 0.08),
    "leg_l": (0.55, 0.05),
    "leg_r": (0.45, 0.05),
    "foot_l": (0.5, 0.1),
    "foot_r": (0.5, 0.1),
}

DEFAULT_ORDER = [
    "leg_l", "leg_r", "foot_l", "foot_r", "torso", "arm_l", "arm_r", "head"
]

KICK_ORDER = [
    "leg_l", "foot_l", "torso", "arm_l", "arm_r", "head", "leg_r", "foot_r"
]

POSE_LIMBS = {
    "idle": {},
    "idle-breath": {"torso": {"dy": -1, "sy": 1.03}},
    "walk-forward-1": {
        "leg_l": {"angle": 22, "dx": 8, "dy": -6},
        "leg_r": {"angle": -8, "dx": -4, "dy": 6},
        "foot_l": {"dx": 10, "dy": -4},
        "foot_r": {"dx": -4, "dy": 4},
        "arm_l": {"angle": -28, "dx": 6, "dy": -6},
        "arm_r": {"angle": 22, "dx": -6, "dy": 4},
        "torso": {"angle": -3, "dx": 3, "dy": -1},
    },
    "walk-forward-2": {
        "leg_l": {"angle": -10, "dx": -4, "dy": 6},
        "leg_r": {"angle": 20, "dx": 8, "dy": -6},
        "foot_l": {"dx": -4, "dy": 4},
        "foot_r": {"dx": 10, "dy": -4},
        "arm_l": {"angle": 24, "dx": -6, "dy": 4},
        "arm_r": {"angle": -26, "dx": 6, "dy": -6},
        "torso": {"angle": 3, "dx": -3, "dy": -1},
    },
    "walk-backward-1": {
        "leg_l": {"angle": -10, "dx": -4, "dy": 2},
        "leg_r": {"angle": 8, "dx": 4, "dy": -4},
        "arm_l": {"angle": 12, "dx": -2, "dy": 4},
        "arm_r": {"angle": -12, "dx": 2, "dy": 4},
        "torso": {"angle": 6, "dx": -3, "dy": 0},
    },
    "walk-backward-2": {
        "leg_l": {"angle": 10, "dx": 4, "dy": -4},
        "leg_r": {"angle": -8, "dx": -4, "dy": 2},
        "arm_l": {"angle": -12, "dx": 2, "dy": 4},
        "arm_r": {"angle": 12, "dx": -2, "dy": 4},
        "torso": {"angle": -5, "dx": 3, "dy": 0},
    },
    "crouch": {
        "torso": {"sy": 0.82, "dy": 14},
        "head": {"dy": 10},
        "arm_l": {"angle": 8, "dy": 12},
        "arm_r": {"angle": -8, "dy": 12},
        "leg_l": {"sy": 0.75, "dy": 18, "angle": 8},
        "leg_r": {"sy": 0.75, "dy": 18, "angle": -8},
        "foot_l": {"dy": 8},
        "foot_r": {"dy": 8},
    },
    "jump": {
        "torso": {"dy": -6},
        "head": {"dy": -6},
        "leg_l": {"angle": -28, "dx": -4, "dy": -8},
        "leg_r": {"angle": 22, "dx": 4, "dy": -10},
        "arm_l": {"angle": -40, "dx": -6, "dy": -14},
        "arm_r": {"angle": 35, "dx": 6, "dy": -12},
        "foot_l": {"dy": -4},
        "foot_r": {"dy": -4},
    },
    "jump-peak": {
        "torso": {"dy": -10},
        "head": {"dy": -10},
        "leg_l": {"angle": -8, "dx": -6, "dy": -4},
        "leg_r": {"angle": 8, "dx": 6, "dy": -4},
        "arm_l": {"angle": -55, "dx": -10, "dy": -18},
        "arm_r": {"angle": 50, "dx": 10, "dy": -18},
    },
    "falling": {
        "torso": {"angle": 8, "dy": 4},
        "leg_l": {"angle": 20, "dx": -6, "dy": 6},
        "leg_r": {"angle": -15, "dx": 8, "dy": 8},
        "arm_l": {"angle": 30, "dx": -8, "dy": 4},
        "arm_r": {"angle": -25, "dx": 10, "dy": 2},
    },
    "block-high": {
        "arm_l": {"angle": -75, "dx": 4, "dy": -18},
        "arm_r": {"angle": 75, "dx": -4, "dy": -18},
        "torso": {"angle": -6, "dy": -2},
    },
    "block-low": {
        "torso": {"sy": 0.82, "dy": 12},
        "head": {"dy": 8},
        "arm_l": {"angle": -40, "dx": 6, "dy": 4},
        "arm_r": {"angle": 40, "dx": -6, "dy": 4},
        "leg_l": {"sy": 0.78, "dy": 14},
        "leg_r": {"sy": 0.78, "dy": 14},
    },
    "hit-stun": {
        "torso": {"angle": 14, "dx": -10, "dy": -4},
        "head": {"angle": 10, "dx": -8, "dy": -6},
        "arm_l": {"angle": 25, "dx": -12, "dy": -4},
        "arm_r": {"angle": -15, "dx": -6, "dy": 2},
    },
    "crouch-hit-stun": {
        "torso": {"sy": 0.8, "angle": 12, "dx": -8, "dy": 10},
        "head": {"dy": 8, "dx": -6},
        "arm_l": {"angle": 20, "dx": -8, "dy": 8},
    },
    "knockdown": {
        "torso": {"angle": 85, "dx": -20, "dy": 30},
        "head": {"angle": 85, "dx": -18, "dy": 28},
        "arm_l": {"angle": 70, "dx": -24, "dy": 20},
        "arm_r": {"angle": 60, "dx": -10, "dy": 22},
        "leg_l": {"angle": 40, "dx": -16, "dy": 34},
        "leg_r": {"angle": 30, "dx": 0, "dy": 36},
        "foot_l": {"hide": True},
        "foot_r": {"hide": True},
    },
    "get-up": {
        "torso": {"angle": 35, "dy": 10, "sy": 0.9},
        "head": {"angle": 20, "dy": 6},
        "arm_l": {"angle": -50, "dx": -8, "dy": -6},
        "leg_l": {"angle": -30, "dx": -4, "dy": 8},
        "leg_r": {"angle": 40, "dx": 8, "dy": 4},
    },
    "victory": {
        "arm_l": {"angle": -110, "dx": -4, "dy": -28},
        "arm_r": {"angle": 110, "dx": 4, "dy": -28},
        "torso": {"dy": -4},
        "head": {"dy": -4},
    },
    "defeat": {
        "torso": {"angle": 25, "dy": 14},
        "head": {"angle": 20, "dy": 12},
        "arm_l": {"angle": 30, "dy": 10},
        "arm_r": {"angle": -20, "dy": 12},
        "leg_l": {"angle": 10, "dy": 8},
        "leg_r": {"angle": -8, "dy": 10},
    },
    "high-punch": {
        "_order": ["leg_l", "leg_r", "foot_l", "foot_r", "torso", "arm_l", "head", "arm_r"],
        "arm_r": {"angle": -88, "dx": 34, "dy": -18},
        "torso": {"angle": -12, "dx": 6, "dy": -2},
        "arm_l": {"angle": 35, "dx": -8, "dy": 2},
        "head": {"dx": 4, "dy": -2},
    },
    "high-kick": {
        "_order": KICK_ORDER,
        "leg_r": {"angle": -95, "dx": 22, "dy": -38},
        "foot_r": {"hide": True},
        "torso": {"angle": 18, "dx": -8, "dy": -6},
        "arm_l": {"angle": -45, "dx": -12, "dy": -14},
        "arm_r": {"angle": 40, "dx": 10, "dy": -12},
        "leg_l": {"angle": 8, "dx": -4, "dy": 0},
    },
    "low-punch": {
        "_order": ["leg_l", "leg_r", "foot_l", "foot_r", "torso", "arm_l", "head", "arm_r"],
        "torso": {"sy": 0.84, "dy": 12, "angle": -6},
        "head": {"dy": 10},
        "arm_r": {"angle": -62, "dx": 24, "dy": 10},
        "arm_l": {"angle": 15, "dy": 10},
        "leg_l": {"sy": 0.8, "dy": 12},
        "leg_r": {"sy": 0.8, "dy": 12},
    },
    "low-kick": {
        "_order": KICK_ORDER,
        "torso": {"sy": 0.84, "dy": 10, "angle": 8},
        "leg_r": {"angle": -55, "dx": 28, "dy": -12},
        "foot_r": {"angle": -40, "dx": 32, "dy": -16},
        "arm_l": {"angle": -25, "dx": -8, "dy": 4},
        "arm_r": {"angle": 30, "dx": 8, "dy": 2},
        "leg_l": {"sy": 0.82, "dy": 12},
    },
    "med-punch": {
        "_order": ["leg_l", "leg_r", "foot_l", "foot_r", "torso", "arm_l", "head", "arm_r"],
        "arm_r": {"angle": -78, "dx": 28, "dy": -12},
        "torso": {"angle": -10, "dx": 4, "dy": 0},
        "arm_l": {"angle": 18, "dx": -6, "dy": 2},
    },
    "med-kick": {
        "_order": KICK_ORDER,
        "leg_r": {"angle": -82, "dx": 20, "dy": -28},
        "foot_r": {"angle": -35, "dx": 24, "dy": -30},
        "torso": {"angle": 12, "dx": -6, "dy": -4},
        "arm_l": {"angle": -32, "dx": -10, "dy": -8},
        "arm_r": {"angle": 28, "dx": 8, "dy": -6},
    },
    "special-1": {
        "_order": ["leg_l", "leg_r", "foot_l", "foot_r", "torso", "arm_l", "head", "arm_r"],
        "arm_r": {"angle": -92, "dx": 36, "dy": -16},
        "arm_l": {"angle": -65, "dx": 14, "dy": -14},
        "torso": {"angle": -16, "dx": 8, "dy": -4},
        "leg_l": {"angle": -8, "dx": 4, "dy": -4},
    },
    "special-2": {
        "_order": ["leg_l", "leg_r", "foot_l", "foot_r", "torso", "arm_l", "head", "arm_r"],
        "arm_r": {"angle": -98, "dx": 40, "dy": -20},
        "arm_l": {"angle": -78, "dx": 16, "dy": -18},
        "torso": {"angle": -20, "dx": 10, "dy": -6},
        "leg_r": {"angle": -20, "dx": 6, "dy": -8},
    },
    "throw": {
        "arm_l": {"angle": -45, "dx": 10, "dy": -8},
        "arm_r": {"angle": -35, "dx": 8, "dy": -6},
        "torso": {"angle": -12, "dx": 6, "dy": 0},
        "leg_l": {"dx": 4, "dy": -2},
        "leg_r": {"dx": -2, "dy": 0},
    },
    "thrown": {
        "torso": {"angle": 55, "dx": -12, "dy": -16},
        "head": {"angle": 50, "dx": -10, "dy": -18},
        "arm_l": {"angle": 80, "dx": -16, "dy": -20},
        "arm_r": {"angle": -60, "dx": 4, "dy": -14},
        "leg_l": {"angle": 35, "dx": -8, "dy": -8},
        "leg_r": {"angle": -25, "dx": 10, "dy": -6},
        "foot_l": {"hide": True},
        "foot_r": {"hide": True},
    },
    "phase-2": {"torso": {"sy": 1.06, "dy": -4}},
    "phase-3": {"torso": {"sy": 1.1, "dy": -6}},
    "taunt": {"arm_r": {"angle": -30, "dx": 4, "dy": -8}, "torso": {"angle": -4}},
    "summon": {
        "arm_l": {"angle": -60, "dx": -6, "dy": -14},
        "arm_r": {"angle": 60, "dx": 6, "dy": -14},
        "torso": {"angle": -8, "dy": -2},
    },
    "heavy-special-windup": {
        "arm_r": {"angle": 45, "dx": -8, "dy": -6},
        "arm_l": {"angle": 35, "dx": -10, "dy": -4},
        "torso": {"angle": 12, "dx": -6, "dy": 0},
        "leg_l": {"angle": -5, "dx": -4, "dy": 0},
        "leg_r": {"angle": 5, "dx": 4, "dy": 0},
    },
}

KICK_POSES = {"high-kick", "low-kick", "med-kick"}


def _box(sprite, part):
    w, h = sprite.size
    l, t, r, b = PARTS[part]
    return (int(l * w), int(t * h), int(r * w), int(b * h))


def _draw_part(sprite, part, spec):
    if spec.get("hide"):
        return None

    box = _box(sprite, part)
    part_img = sprite.crop(box)
    sx = spec.get("sx", 1)
    sy = spec.get("sy", spec.get("sx", 1))
    if sx != 1 or sy != 1:
        part_img = part_img.resize(
            (max(1, int(part_img.width * sx)), max(1, int(part_img.height * sy))),
            Image.NEAREST,
        )

    angle = spec.get("angle", 0)
    px = PIVOT[part][0] * part_img.width
    py = PIVOT[part][1] * part_img.height
    if angle:
        part_img = part_img.rotate(-angle, resample=Image.NEAREST, center=(px, py), expand=True)

    layer = Image.new("RGBA", sprite.size, (0, 0, 0, 0))
    dx = spec.get("dx", 0)
    dy = spec.get("dy", 0)
    x = box[0] + dx + (box[2] - box[0] - part_img.width) // 2
    y = box[1] + dy + (box[3] - box[1] - part_img.height) // 2
    layer.paste(part_img, (x, y), part_img)
    return layer


def compose_pose(sprite, kind):
    limbs = POSE_LIMBS.get(kind, POSE_LIMBS["idle"])
    order = limbs.get("_order", DEFAULT_ORDER)
    w, h = sprite.size
    pad_x = math.ceil(w * 0.45)
    pad_y = math.ceil(h * 0.3)

    base = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for part in order:
        if part.startswith("_"):
            continue
        spec = limbs.get(part, {})
        layer = _draw_part(sprite, part, spec)
        if layer:
            base = Image.alpha_composite(base, layer)

    out = Image.new("RGBA", (w + pad_x * 2, h + pad_y), (0, 0, 0, 0))
    out.paste(base, (pad_x, pad_y // 2), base)
    return out