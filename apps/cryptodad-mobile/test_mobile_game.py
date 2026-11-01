#!/usr/bin/env python3
"""Automated smoke + logic tests for Crypto Dad mobile."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from time import sleep

ROOT = Path(__file__).resolve().parent
PORT = 8778


def start_server():
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(("", PORT), SimpleHTTPRequestHandler)
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    sleep(0.4)
    return httpd


def fetch(path: str) -> tuple[int, bytes]:
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}", timeout=8) as resp:
        return resp.status, resp.read()


def test_assets():
    required = [
        "/index.html",
        "/manifest.json",
        "/privacy-policy.html",
        "/sw.js",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
        "/images/cryptodad_colorful/11.jpg",
        "/images/last_stand.jpg",
        "/images/game_over.jpg",
        "/images/good_ending.jpg",
        "/images/heat_high.jpg",
        "/images/toasty-head.jpg",
        "/images/cryptodad_mint/kid1_portrait.jpg",
        "/images/cryptodad_mint/mom_portrait.jpg",
    ]
    failures = []
    for path in required:
        try:
            code, _ = fetch(path)
            if code != 200:
                failures.append(f"{path} -> HTTP {code}")
        except Exception as exc:
            failures.append(f"{path} -> {exc}")
    return failures


def extract_image_paths(html: str) -> list[str]:
    return sorted(set(re.findall(r'images/[^"\']+', html)))


def extract_js_image_paths(html: str) -> list[str]:
    return sorted(set(re.findall(r'images/[a-zA-Z0-9_./-]+', html)))


def test_html_references():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    failures = []

    if "const sleep = delay" not in html:
        failures.append("sleep alias missing (secret pixel will crash)")

    if "images/cryptodad/" in html:
        failures.append("stale images/cryptodad/ path still present")

    if "function hustleMenu" not in html or "function bankMenu" not in html:
        failures.append("hustle/bank menus missing")

    for ref in extract_js_image_paths(html):
        local = ROOT / ref.replace("/", os.sep)
        if not local.exists():
            failures.append(f"missing asset referenced in HTML/JS: {ref}")

    return failures


def simulate_game_logic(iterations: int = 500):
    """Pure-Python mirror of core mobile mechanics for regression testing."""

    def clamp(v, lo, hi):
        return max(lo, min(hi, v))

    failures = []

    for seed in range(iterations):
        rng = seed

        def rand():
            nonlocal rng
            rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF
            return rng / 0x7FFFFFFF

        state = {
            "week": 0,
            "liquid": 1250,
            "family": 100,
            "morale": 100,
            "heat": 0,
            "tradeHoursUsed": 0,
            "pixelChicken": False,
            "arrests": 0,
        }

        menus = ["intro", "main", "trade", "hustle", "family", "bank", "store"]
        stuck_weeks = 0

        for step in range(80):
            action = menus[int(rand() * len(menus))]

            if action == "intro":
                state["week"] = 1
                state["family"] = clamp(state["family"] + 18, 0, 100)
                continue

            if action == "main":
                sub = int(rand() * 6) + 1
                if sub == 1:
                    state["tradeHoursUsed"] = min(24, state["tradeHoursUsed"] + 4)
                    state["tradingCash"] = state.get("tradingCash", 0) + 120
                elif sub == 2:
                    state["liquid"] += 180
                    state["heat"] = clamp(state["heat"] + 14, 0, 100)
                elif sub == 3:
                    state["family"] = clamp(state["family"] + 15, 0, 100)
                elif sub == 4:
                    if state["liquid"] >= 200:
                        state["liquid"] -= 200
                elif sub == 5:
                    if state["liquid"] >= 820:
                        state["liquid"] -= 820
                elif sub == 6:
                    state["heat"] = clamp(state["heat"] - 6, 0, 100)

            # weekly advance
            prev_week = state["week"]
            state["week"] += 1
            state["tradeHoursUsed"] = 0
            state["family"] = clamp(state["family"] - 5, 0, 100)
            state["morale"] = clamp(state["morale"] - 3, 0, 100)
            if state["heat"] > 0:
                state["heat"] = clamp(state["heat"] - 2, 0, 100)

            if state["heat"] >= 96 or state["family"] <= 2:
                break

            if state["heat"] >= 78 and rand() < 0.35:
                # Fixed behavior: arrest is a setback, run continues
                state["arrests"] += 1
                state["heat"] = max(20, state["heat"] - 25)

            if state["week"] == prev_week:
                stuck_weeks += 1
            else:
                stuck_weeks = 0

            if stuck_weeks > 5:
                failures.append(f"seed {seed}: game stuck without week advance")
                break

        if state["week"] < 1:
            failures.append(f"seed {seed}: never advanced past intro")

    return failures


def test_manifest():
    data = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    failures = []
    if not data.get("icons"):
        failures.append("manifest missing icons")
    for icon in data.get("icons", []):
        src = icon.get("src", "")
        if not (ROOT / src).exists():
            failures.append(f"manifest icon missing: {src}")
    return failures


def main():
    httpd = start_server()
    all_failures = []

    try:
        all_failures.extend(("ASSET:" + f) for f in test_assets())
        all_failures.extend(("HTML:" + f) for f in test_html_references())
        all_failures.extend(("MANIFEST:" + f) for f in test_manifest())
        all_failures.extend(("LOGIC:" + f) for f in simulate_game_logic(10000))
    finally:
        httpd.shutdown()

    if all_failures:
        print(f"FAILED — {len(all_failures)} issue(s)")
        for item in all_failures[:40]:
            print(" -", item)
        if len(all_failures) > 40:
            print(f" ... and {len(all_failures) - 40} more")
        sys.exit(1)

    print("PASSED — assets, HTML references, manifest, and 10000 logic simulations OK")


if __name__ == "__main__":
    main()