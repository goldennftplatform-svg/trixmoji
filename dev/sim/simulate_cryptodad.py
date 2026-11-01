#!/usr/bin/env python3
"""
Monte Carlo simulator for Crypto Dad game (GrokBuild_cryptoDad_v1.html logic).
Faithful port of core mechanics for 500k+ simulations.
Run with: python simulate_cryptodad.py
"""

import random
import sys
from collections import defaultdict

class CryptoDadSim:
    def __init__(self, seed=None):
        if seed is not None:
            random.seed(seed)
        self.reset()

    def reset(self):
        self.week = 0
        self.liquid = 1250
        self.savings = 0
        self.trading_cash = 0
        self.morale = 100
        self.family = 100
        self.heat = 0

        self.crypto = {'BTC': 0, 'ETH': 0, 'SOL': 0, 'MEME': 0}
        self.prices = {'BTC': 104800, 'ETH': 2480, 'SOL': 152, 'MEME': 0.018}

        self.firearm = False
        self.armor = False
        self.burner = False

        self.in_jail = False
        self.jail_weeks = 0
        self.job_lost = False
        self.divorced = False
        self.lost_house = False

        self.total_earned = 0
        self.arrests = 0

        self.history = []  # for debugging
        self.ended = False
        self.end_reason = None
        self.image_triggers = []  # track when updateGameImage would fire with special/heat/family

    def clamp(self, val, minv, maxv):
        return max(minv, min(maxv, val))

    def update_market(self):
        # Stable coins
        self.prices['BTC'] *= (0.965 + random.random() * 0.07)
        self.prices['ETH'] *= (0.96 + random.random() * 0.08)
        self.prices['SOL'] *= (0.91 + random.random() * 0.18)

        # MEME chaos
        meme_roll = random.random()
        if meme_roll < 0.11:
            self.prices['MEME'] *= (0.04 + random.random() * 0.12)
        elif meme_roll > 0.89:
            self.prices['MEME'] *= (5 + random.random() * 9)
        elif meme_roll > 0.72:
            self.prices['MEME'] *= (1.6 + random.random() * 2.1)
        else:
            self.prices['MEME'] *= (0.55 + random.random() * 1.3)

        # Global events (rare)
        event = random.random()
        if event < 0.04:
            self.prices['BTC'] *= 0.82
            self.prices['ETH'] *= 0.79
        elif event > 0.96:
            self.prices['BTC'] *= 1.11
            self.prices['ETH'] *= 1.09
        elif event > 0.93:
            self.prices['SOL'] *= 0.71

        # Floors/caps
        self.prices['BTC'] = self.clamp(self.prices['BTC'], 42000, 168000)
        self.prices['ETH'] = self.clamp(self.prices['ETH'], 980, 6200)
        self.prices['SOL'] = self.clamp(self.prices['SOL'], 38, 420)
        self.prices['MEME'] = self.clamp(self.prices['MEME'], 0.0008, 4.8)

    def apply_weekly_decay(self):
        self.family = self.clamp(self.family - 6, 0, 100)
        self.morale = self.clamp(self.morale - 4, 0, 100)
        if self.heat > 0:
            self.heat = self.clamp(self.heat - 2, 0, 100)

    def random_family_incident(self):
        if random.random() > 0.35:
            return
        roll = random.random()
        cost = 0
        fam_hit = 0
        if roll < 0.09:
            cost, fam_hit = 680, 4
        elif roll < 0.17:
            cost, fam_hit = 2450, 12
        elif roll < 0.26:
            cost, fam_hit = 1875, 7
        elif roll < 0.33:
            cost, fam_hit = 290, 3
        elif roll < 0.41:
            cost, fam_hit = 940, 6
        elif roll < 0.49:
            cost, fam_hit = 420, 6
        elif roll < 0.56:
            cost, fam_hit = 1350, 14
        elif roll < 0.62:
            cost, fam_hit = 780, 5
        else:
            cost, fam_hit = 320, 4

        self.liquid = max(0, self.liquid - cost)
        self.family = self.clamp(self.family - fam_hit, 0, 100)
        self.history.append(('family_incident', cost, fam_hit))

    def check_critical(self):
        # Fed raid
        if self.heat >= 92 and random.random() < 0.55:
            self.liquid = int(self.liquid * 0.35)
            self.trading_cash = int(self.trading_cash * 0.35)
            self.heat = 38
            self.morale -= 22
            self.family -= 15
            self.history.append(('fed_raid',))
            self.image_triggers.append(('heat_high',))
            return False

        # Arrest
        if self.heat >= 78 and random.random() < 0.38:
            self.arrests += 1
            self.heat = max(25, self.heat - 30)
            self.in_jail = True
            self.jail_weeks = 0
            self.history.append(('arrest',))
            return True

        # Divorce
        if self.family <= 18 and not self.divorced:
            if random.random() < 0.65:
                self.divorced = True
                self.family = 8
                self.morale -= 35
                self.liquid = int(self.liquid * 0.55)
                self.history.append(('divorce',))
                return False

        # Foreclosure
        if self.family <= 6 and not self.lost_house:
            self.lost_house = True
            self.morale -= 30
            self.heat += 25
            self.image_triggers.append(('heat_high',))
            self.history.append(('foreclosure',))
            return False

        # Morale death spiral
        if self.morale <= 12:
            self.family = self.clamp(self.family - 8, 0, 100)
            self.history.append(('morale_crash',))

        return False

    def police_encounter(self):
        # Simplified: high chance of arrest or heat spike if high heat
        if random.random() < 0.6:
            self.heat += 25
            self.history.append(('police_comply',))
        else:
            # Attempt to run/fight (risky)
            if random.random() < 0.45:
                self.heat += 38
                self.history.append(('police_escape',))
            else:
                self.arrests += 1
                self.in_jail = True
                self.heat = max(25, self.heat - 30)
                self.history.append(('police_arrest',))
                return True
        return False

    def advance_week(self, strategy='mixed'):
        """Advance one week. strategy: 'safe', 'risky', 'mixed'"""
        if self.ended:
            return False
        self.week += 1

        # Paycheck / bills (simplified)
        if not self.job_lost and not self.in_jail:
            self.liquid += 1180
        self.liquid -= 920
        self.liquid = max(0, self.liquid)

        # Market
        self.update_market()

        # Family incident
        self.random_family_incident()

        # Decay
        self.apply_weekly_decay()

        # Heat from risky behavior (depends on strategy)
        if strategy == 'risky' or (strategy == 'mixed' and random.random() < 0.4):
            self.heat += random.randint(5, 18)

        # Critical checks
        arrested = self.check_critical()
        if arrested:
            self.ended = True
            self.end_reason = 'arrested'
            return False

        # Police if high heat
        if self.heat > 68 and random.random() < 0.28 and not self.in_jail:
            arrested = self.police_encounter()
            if arrested:
                self.ended = True
                self.end_reason = 'arrested'
                return False

        # Image trigger check (family/heat thresholds from game)
        f = self.family
        h = self.heat
        if f >= 80 and h < 25:
            self.image_triggers.append(('good', 'family_high'))
        elif f < 30 or h > 70:
            self.image_triggers.append(('bad', 'heat_high'))
        elif h > 50:
            self.image_triggers.append(('medium', 'heat_high'))

        # Survival check
        if self.family <= 0 or self.morale <= 0 or (self.lost_house and self.heat > 90):
            self.ended = True
            self.end_reason = 'family_collapse'
            return False

        return True

    def run_game(self, max_weeks=52, strategy='mixed'):
        """Run one full game. Returns (weeks_survived, final_family, final_heat, end_reason, image_count)"""
        self.reset()
        weeks = 0
        for w in range(max_weeks):
            if not self.advance_week(strategy):
                break
            weeks += 1
            # Occasional "family time" or safe action in mixed/safe strategies
            if strategy in ('safe', 'mixed') and random.random() < 0.55:
                self.family = self.clamp(self.family + 8, 0, 100)
                self.heat = self.clamp(self.heat - 5, 0, 100)
                self.morale = self.clamp(self.morale + 4, 0, 100)

        if not self.ended:
            self.end_reason = 'survived_max_weeks'

        return weeks, self.family, self.heat, self.end_reason, len(self.image_triggers)

# ================== MONTE CARLO RUNNER ==================

def run_simulations(n=500000, strategies=('safe', 'risky', 'mixed')):
    results = {}
    for strat in strategies:
        stats = {
            'runs': 0,
            'total_weeks': 0,
            'survivals': 0,          # reached max_weeks without collapse
            'arrests': 0,
            'family_collapses': 0,
            'avg_final_family': 0,
            'avg_final_heat': 0,
            'total_images': 0,
            'bad_ending_images': 0,
            'good_ending_images': 0,
        }
        for i in range(n):
            sim = CryptoDadSim(seed=i)  # reproducible
            weeks, fam, heat, reason, img_count = sim.run_game(max_weeks=52, strategy=strat)
            stats['runs'] += 1
            stats['total_weeks'] += weeks
            if reason == 'survived_max_weeks':
                stats['survivals'] += 1
            elif 'arrest' in reason:
                stats['arrests'] += 1
            else:
                stats['family_collapses'] += 1
            stats['avg_final_family'] += fam
            stats['avg_final_heat'] += heat
            stats['total_images'] += img_count
            # crude classification from triggers (robust to (tag,) or (kind, detail) formats)
            for item in sim.image_triggers:
                if isinstance(item, (list, tuple)):
                    tag = item[0] if len(item) > 0 else ''
                    detail = item[1] if len(item) > 1 else ''
                else:
                    tag = str(item)
                    detail = ''
                if tag in ('bad', 'heat_high') or 'heat' in detail.lower():
                    stats['bad_ending_images'] += 1
                if tag == 'good' or 'family_high' in detail.lower() or 'good_ending' in detail.lower():
                    stats['good_ending_images'] += 1

        # averages
        stats['avg_weeks'] = stats['total_weeks'] / stats['runs']
        stats['avg_final_family'] /= stats['runs']
        stats['avg_final_heat'] /= stats['runs']
        stats['survival_rate'] = stats['survivals'] / stats['runs']
        stats['avg_images_per_run'] = stats['total_images'] / stats['runs']
        results[strat] = stats
    return results

if __name__ == "__main__":
    print("Running 500,000 simulations per strategy (safe / risky / mixed)...")
    print("This may take a minute.")
    res = run_simulations(n=500000)

    for strat, s in res.items():
        print(f"\n=== STRATEGY: {strat.upper()} ===")
        print(f"Runs: {s['runs']}")
        print(f"Avg weeks survived: {s['avg_weeks']:.2f}")
        print(f"Survival rate (full 52 weeks): {s['survival_rate']*100:.2f}%")
        print(f"Arrest endings: {s['arrests']} ({s['arrests']/s['runs']*100:.2f}%)")
        print(f"Family collapse endings: {s['family_collapses']} ({s['family_collapses']/s['runs']*100:.2f}%)")
        print(f"Avg final Family: {s['avg_final_family']:.1f}")
        print(f"Avg final Heat: {s['avg_final_heat']:.1f}")
        print(f"Avg image triggers per run: {s['avg_images_per_run']:.2f}")
        print(f"  - 'Bad/heat' image triggers: {s['bad_ending_images']}")
        print(f"  - 'Good' image triggers: {s['good_ending_images']}")

    print("\n=== QUICK ANALYSIS ===")
    print("Safe strategy should dominate (high survival, high family, low heat).")
    print("Risky should have many early arrests/collapses but occasional high scores.")
    print("Mixed is the realistic 'player' behavior.")
    print("Check that image triggers fire for the documented thresholds (family >=80 + heat<25 = good; family<30 or heat>70 = bad).")
    print("If survival rates look inverted or image counts are zero for good/bad, there is a logic bug.")