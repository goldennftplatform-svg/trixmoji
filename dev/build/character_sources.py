"""Per-character Grok source images for pose installation."""
import os

ROOT = r"C:\Users\franc\Desktop\DOSWAPZ-v2"
CHAR_ROOT = os.path.join(ROOT, "assets", "images", "kol-fighter", "characters")
DEGEN_DIR = os.path.join(CHAR_ROOT, "degen")
DEGEN_SOURCES = os.path.join(DEGEN_DIR, "sources")
SCREENS = os.path.join(ROOT, "assets", "images", "kol-fighter", "screens")

DOWNLOADS = r"C:\Users\franc\Downloads"
SESSION = (
    r"C:\Users\franc\.grok\sessions"
    r"\C%3A%5CWINDOWS%5Csystem32\019f2fe0-fdeb-7e11-98a6-8e30b11e84a7\assets"
)


def _first_existing(*paths):
    for path in paths:
        if path and os.path.isfile(path):
            return path
    return paths[0] if paths else None

CHARACTERS = [
    "degen", "ansem", "jason-williams", "dogedesigner", "roger-ver", "bitboy",
    "jimmy-edgar", "michael-saylor", "crypto-bitlord", "donalt", "vitalik-buterin", "pauly0x",
]

REFERENCE_FILES = {
    "degen": _first_existing(
        os.path.join(DOWNLOADS, "9ZNvl.jpg"),
        os.path.join(DEGEN_SOURCES, "idle-r.jpg"),
        os.path.join(DEGEN_DIR, "reference.jpg"),
        os.path.join(SCREENS, "9ZNvl.jpg"),
    ),
    "ansem": os.path.join(DOWNLOADS, "ANSEM.jpg"),
    "jason-williams": os.path.join(DOWNLOADS, "JASON WILLIAMS.jpg"),
    "dogedesigner": os.path.join(DOWNLOADS, "DOGEDESIGNER.jpg"),
    "roger-ver": os.path.join(DOWNLOADS, "ROGER VER.jpg"),
    "bitboy": os.path.join(DOWNLOADS, "BITBOY.jpg"),
    "jimmy-edgar": os.path.join(DOWNLOADS, "JIMMY EDGAR.jpg"),
    "michael-saylor": os.path.join(DOWNLOADS, "MICHAELSAYLOR.jpg"),
    "crypto-bitlord": os.path.join(DOWNLOADS, "CRYPTO BITLORD.jpg"),
    "donalt": os.path.join(DOWNLOADS, "DON ALT.jpg"),
    "vitalik-buterin": os.path.join(DOWNLOADS, "VITALIK BUTERIN.jpg"),
    "pauly0x": os.path.join(DOWNLOADS, "PAULY0X.jpg"),
}

def _degen_pose(pose, session_name, *fallbacks):
    return _first_existing(
        os.path.join(DEGEN_SOURCES, pose + ".jpg"),
        os.path.join(DEGEN_SOURCES, pose + ".png"),
        os.path.join(SESSION, session_name) if session_name else None,
        *fallbacks,
    )


DEGEN_PRIMARY = {
    "idle-r": _degen_pose("idle-r", "image-175568d4-90f0-4b78-970a-8c2521dadb55.jpg"),
    "idle-breath-r": _degen_pose("idle-breath-r", "image-a456ed22-0552-4596-9008-8c61b07a07a0.jpg"),
    "walk-forward-1-r": _degen_pose("walk-forward-1-r", "image-22d33eaf-1000-4967-861b-2fa6e8363877.jpg"),
    "walk-forward-2-r": _degen_pose("walk-forward-2-r", "image-a456ed22-0552-4596-9008-8c61b07a07a0.jpg"),
    "jump-r": _degen_pose(
        "jump-r",
        None,
        os.path.join(DOWNLOADS, "9ZNvl.jpg"),
        os.path.join(SCREENS, "9ZNvl.jpg"),
    ),
    "jump-peak-r": _degen_pose("jump-peak-r", "image-6fb64efc-7ed3-480e-b220-82ece820a586.jpg"),
    "crouch-r": _degen_pose("crouch-r", "image-bb99b224-bec8-46cd-a1da-84f918b00b25.jpg"),
    "block-high-r": _degen_pose(
        "block-high-r",
        None,
        os.path.join(DOWNLOADS, "CtUhC (1).jpg"),
        os.path.join(SCREENS, "CtUhC (1).jpg"),
        os.path.join(SCREENS, "CtUhC.jpg"),
    ),
    "block-low-r": _degen_pose("block-low-r", "image-c146bb9d-040a-4bc5-82de-60af61f80722.jpg"),
    "high-punch-r": _degen_pose("high-punch-r", "image-3a1d91c0-2283-4612-805d-0b7baee176d7.jpg"),
    "high-kick-r": _degen_pose("high-kick-r", "image-b7463fb3-590c-4415-be8a-9fc9217bb5c6.jpg"),
    "low-punch-r": _degen_pose("low-punch-r", "image-bb99b224-bec8-46cd-a1da-84f918b00b25.jpg"),
    "med-kick-r": _degen_pose("med-kick-r", "image-c224b37b-7506-4b44-8d06-efc26cc47a56.jpg"),
    "special-1-r": _degen_pose("special-1-r", "image-069f145d-1b86-4bd9-9621-ac3d2d22e550.jpg"),
    "special-2-r": _degen_pose("special-2-r", "image-c224b37b-7506-4b44-8d06-efc26cc47a56.jpg"),
    "victory-r": _degen_pose("victory-r", "image-6fb64efc-7ed3-480e-b220-82ece820a586.jpg"),
}

POSE_FALLBACK_R = {
    "walk-backward-1-r": "walk-forward-1-r",
    "walk-backward-2-r": "walk-forward-2-r",
    "falling-r": "jump-r",
    "hit-stun-r": "idle-breath-r",
    "crouch-hit-stun-r": "crouch-r",
    "knockdown-r": "crouch-r",
    "get-up-r": "crouch-r",
    "defeat-r": "hit-stun-r",
    "low-kick-r": "high-kick-r",
    "med-punch-r": "high-punch-r",
    "throw-r": "high-punch-r",
    "thrown-r": "knockdown-r",
    "phase-2-r": "idle-r",
    "phase-3-r": "idle-r",
    "taunt-r": "victory-r",
    "summon-r": "special-1-r",
    "heavy-special-windup-r": "high-punch-r",
}

# Grok images dropped in characters/ root (filename -> slug, pose)
ROOT_INBOX_MAP = {
    "grok-image-2ee6a0e3-b21d-440a-bcf7-8c090eece61c.jpg": ("ansem", "idle-r"),
    "grok-image-03c62547-9f9b-4522-ae89-b4031d38a6ce.jpg": ("pauly0x", "idle-r"),
    "grok-image-21e4f7d6-d398-4968-92bf-af21e052d3ab.jpg": ("crypto-bitlord", "idle-r"),
    "grok-image-b28a7d77-47a5-4c0b-b8dc-a25a18b5ca00.jpg": ("vitalik-buterin", "idle-r"),
    "grok-image-bfd73d13-013e-4078-a885-1e00afc8c4ea.jpg": ("roger-ver", "idle-r"),
    "grok-image-ccfc1fef-7371-46fb-af5f-932f739d3815.jpg": ("roger-ver", "high-punch-r"),
    "grok-image-9cbe4540-b8b3-470c-97fd-dcd6d0870083.jpg": ("jimmy-edgar", "idle-r"),
    "grok-image-d440f1a8-7a21-4ba6-b2a2-06f4893e556c.jpg": ("dogedesigner", "idle-r"),
    "grok-image-e8a08ca4-fbf6-4e13-bf15-c896e29633d7.jpg": ("michael-saylor", "idle-r"),
    "grok-image-0b801d9e-5084-418c-96a8-895ee82b7512.jpg": ("donalt", "idle-r"),
}

# Labeled reference JPG names -> slug
NAMED_REFERENCES = {
    "ansem.jpg": "ansem",
    "jason williams.jpg": "jason-williams",
    "dogedesigner.jpg": "dogedesigner",
    "roger ver.jpg": "roger-ver",
    "bitboy.jpg": "bitboy",
    "jimmy edgar.jpg": "jimmy-edgar",
    "michaelsaylor.jpg": "michael-saylor",
    "crypto bitlord.jpg": "crypto-bitlord",
    "don alt.jpg": "donalt",
    "vitalik buterin.jpg": "vitalik-buterin",
    "pauly0x.jpg": "pauly0x",
}

SINGLE_POSE_FALLBACK_R = {
    "idle-breath-r": "idle-r",
    "walk-forward-1-r": "idle-r",
    "walk-forward-2-r": "idle-r",
    "walk-backward-1-r": "idle-r",
    "walk-backward-2-r": "idle-r",
    "crouch-r": "idle-r",
    "jump-r": "idle-r",
    "jump-peak-r": "idle-r",
    "falling-r": "idle-r",
    "block-high-r": "idle-r",
    "block-low-r": "idle-r",
    "hit-stun-r": "idle-r",
    "crouch-hit-stun-r": "idle-r",
    "knockdown-r": "idle-r",
    "get-up-r": "idle-r",
    "victory-r": "idle-r",
    "defeat-r": "idle-r",
    "high-punch-r": "idle-r",
    "high-kick-r": "idle-r",
    "low-punch-r": "idle-r",
    "low-kick-r": "idle-r",
    "med-punch-r": "idle-r",
    "med-kick-r": "idle-r",
    "special-1-r": "idle-r",
    "special-2-r": "idle-r",
    "throw-r": "idle-r",
    "thrown-r": "idle-r",
    "phase-2-r": "idle-r",
    "phase-3-r": "idle-r",
    "taunt-r": "idle-r",
    "summon-r": "idle-r",
    "heavy-special-windup-r": "idle-r",
}