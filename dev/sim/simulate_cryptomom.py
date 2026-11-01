#!/usr/bin/env python3
"""
Monte Carlo simulator for Crypto Mom (pages/basement/cryptomom/play.html logic).
Faithful port of core mechanics for 500k+ simulations per strategy.
Run with: python simulate_cryptomom.py
"""

import random
from collections import defaultdict

CRIME_RATE = {'realistic': 0.03, 'arcade': 0.015}


class CryptoMomSim:
    def __init__(self, seed=None, mode='realistic'):
        if seed is not None:
            random.seed(seed)
        self.mode = mode
        self.reset()

    def reset(self):
        self.week = 1  # week 1 auto-action already applied at start
        self.liquid = 680 - 28
        self.savings = 0
        self.kids = min(100, 72 + 12)
        self.stress = max(0, 62 - 8)
        self.risk = max(0, 6 - 4)
        self.reputation = 68
        self.rent_due_in = 4
        self.rent_amount = 1200 if self.mode == 'arcade' else 1400
        self.rent_paid = 0
        self.evicted = False
        self.cps_flag = False
        self.kids_taken = False
        self.gig_banned = False
        self.in_jail = False
        self.arrests = 0
        self.night_shifts = 0
        self.pepper_spray = False
        self.door_cam = False
        self.burner = False
        self.ended = False
        self.end_reason = None
        self.history = []
        self.image_triggers = []

    def clamp(self, val, minv, maxv):
        return max(minv, min(maxv, val))

    def apply_weekly_decay(self):
        kid_decay = 3 if self.mode == 'arcade' else 6
        stress_gain = 2 if self.mode == 'arcade' else 4
        self.kids = self.clamp(self.kids - kid_decay, 0, 100)
        self.stress = self.clamp(self.stress + stress_gain, 0, 100)
        if self.risk > 0:
            self.risk = self.clamp(self.risk - 2, 0, 100)

    def random_kid_incident(self):
        if random.random() > 0.35:
            return
        roll = random.random()
        if roll < 0.09:
            cost, kid_hit = 680, 4
        elif roll < 0.17:
            cost, kid_hit = 2450, 12
        elif roll < 0.26:
            cost, kid_hit = 1875, 7
        elif roll < 0.33:
            cost, kid_hit = 290, 3
        elif roll < 0.41:
            cost, kid_hit = 940, 9
        elif roll < 0.49:
            cost, kid_hit = 420, 6
        elif roll < 0.56:
            cost, kid_hit = 1350, 14
        elif roll < 0.62:
            cost, kid_hit = 780, 5
        elif roll < 0.70:
            cost, kid_hit = 0, 8
        else:
            cost, kid_hit = 320, 4
        self.liquid = max(0, self.liquid - cost)
        self.kids = self.clamp(self.kids - kid_hit, 0, 100)
        self.stress = self.clamp(self.stress + 3, 0, 100)
        self.history.append(('kid_incident', cost, kid_hit))

    def random_dad_event(self):
        if random.random() > 0.18:
            return
        roll = random.random()
        if roll < 0.25:
            self.stress = self.clamp(self.stress + 5, 0, 100)
        elif roll < 0.45:
            self.liquid += 60 + random.randint(0, 120)
        elif roll < 0.60:
            self.kids = self.clamp(self.kids - 3, 0, 100)
            self.stress = self.clamp(self.stress + 6, 0, 100)
        elif roll < 0.75:
            self.risk = self.clamp(self.risk + 4, 0, 100)
            self.stress = self.clamp(self.stress + 8, 0, 100)
        else:
            self.liquid += 40

    def handle_rent(self):
        self.rent_due_in -= 1
        if self.rent_due_in > 0:
            return False
        if self.liquid >= self.rent_amount:
            self.liquid -= self.rent_amount
            self.rent_paid += 1
            self.rent_due_in = 4
            self.stress = self.clamp(self.stress - 6, 0, 100)
            return False
        short = self.rent_amount - self.liquid
        self.liquid = 0
        if self.mode == 'arcade' and not self.evicted and self.rent_paid == 0:
            self.rent_due_in = 1
            self.history.append(('rent_mercy',))
            return False
        if not self.evicted:
            self.evicted = True
            self.end_reason = 'evicted'
            self.ended = True
            self.image_triggers.append(('bad', 'eviction'))
            return True
        return False

    def check_critical(self):
        if self.risk >= 92 and random.random() < 0.55:
            if self.door_cam:
                self.liquid = int(self.liquid * 0.55)
                self.risk = 42
            else:
                self.liquid = int(self.liquid * 0.35)
                self.savings = int(self.savings * 0.35)
                self.risk = 38
                self.stress += 22
                self.kids = self.clamp(self.kids - 15, 0, 100)
            self.history.append(('sweep',))
            self.image_triggers.append(('bad', 'risk_high'))

        if self.risk >= 96:
            self.ended = True
            self.end_reason = 'risk_burn'
            self.image_triggers.append(('bad', 'game_over'))
            return True

        if self.risk >= 78 and random.random() < 0.38:
            self.arrests += 1
            self.risk = max(25, self.risk - 30)
            self.in_jail = True
            self.history.append(('arrest',))
            return True

        if self.kids <= 18 and not self.cps_flag:
            cps_chance = 0.45 if self.mode == 'arcade' else 0.65
            if random.random() < cps_chance:
                self.cps_flag = True
                self.reputation = self.clamp(self.reputation - 22, 0, 100)
                self.stress += 18
                self.kids = self.clamp(self.kids - 8, 0, 100)
                self.history.append(('cps',))

        if self.kids <= 6 and not self.kids_taken:
            self.kids_taken = True
            self.stress += 30
            self.risk += 20
            self.image_triggers.append(('bad', 'kids_low'))
            self.history.append(('kids_taken',))

        if self.kids <= 2:
            self.ended = True
            self.end_reason = 'kids_collapse'
            self.image_triggers.append(('bad', 'game_over'))
            return True

        if self.stress >= 94:
            self.kids = self.clamp(self.kids - 8, 0, 100)
            self.history.append(('stress_crash',))

        return False

    def resolve_jail_quick(self):
        """Simplified jail resolution for sim — weighted outcomes."""
        choice_roll = random.random()
        if choice_roll < 0.35:
            cost = 4200
            if self.liquid + self.savings >= cost:
                self.liquid = max(0, self.liquid - cost)
                self.kids = self.clamp(self.kids - 18, 0, 100)
                self.stress += 14
                self.risk += 22
            else:
                self._serve_time(5)
        elif choice_roll < 0.55:
            if self.liquid >= 1850:
                self.liquid -= 1850
                self.kids = self.clamp(self.kids - 22, 0, 100)
            else:
                self._serve_time(7)
        elif choice_roll < 0.75:
            self._serve_time(7)
        else:
            if random.random() > 0.48:
                self.risk += 18
            else:
                self._serve_time(16)
        self.in_jail = False

    def _serve_time(self, weeks):
        self.jail_weeks = weeks
        self.week += weeks
        self.gig_banned = True
        self.kids = self.clamp(self.kids - 28, 0, 100)
        self.stress += 25
        self.liquid = int(self.liquid * 0.25)
        if self.kids < 25 and random.random() < 0.6:
            self.kids_taken = True
        if self.kids <= 5 or self.stress >= 92:
            self.ended = True
            self.end_reason = 'jail_destroyed'
            self.image_triggers.append(('bad', 'jail'))
            return True
        self.history.append(('served', weeks))
        return False

    def police_encounter(self):
        roll = random.random()
        if roll < 0.35:
            self.arrests += 1
            self.in_jail = True
            self.risk = max(25, self.risk - 30)
            return True
        elif roll < 0.65:
            self.risk += 25 + random.randint(0, 15)
            self.history.append(('police_escape',))
        else:
            self.risk += 12
            self.history.append(('police_warning',))
        return False

    def player_action(self, strategy):
        """One weekly player action before advance."""
        roll = random.random()

        if strategy == 'safe':
            if roll < 0.60:
                self.kids = self.clamp(self.kids + 10, 0, 100)
                self.stress = self.clamp(self.stress - 6, 0, 100)
                self.risk = self.clamp(self.risk - 4, 0, 100)
                self.liquid = max(0, self.liquid - 30)
            elif roll < 0.90:
                self.liquid += 95 + random.randint(0, 85)
                self.stress = self.clamp(self.stress + 2, 0, 100)
            # else lay low
        elif strategy == 'risky':
            if roll < 0.35:
                pay = 260 + random.randint(0, 160)
                self.liquid += pay
                self.risk = self.clamp(self.risk + 14, 0, 100)
                self.stress = self.clamp(self.stress + 12, 0, 100)
                self.night_shifts += 1
                if random.random() < CRIME_RATE.get(self.mode, 0.03):
                    self.liquid = max(0, self.liquid - int(pay * 0.4))
                    self.risk = self.clamp(self.risk + 14, 0, 100)
                if self.risk > 70 and random.random() < 0.12:
                    self.arrests += 1
                    self.in_jail = True
                    return
            elif roll < 0.55:
                earned = 550 + random.randint(0, 950)
                self.liquid += earned
                self.risk = self.clamp(self.risk + 32, 0, 100)
                self.kids = self.clamp(self.kids - 11, 0, 100)
                if self.risk > 70 and random.random() < 0.48:
                    self.arrests += 1
                    self.in_jail = True
                    return
            elif roll < 0.75:
                spend = 1200
                if self.liquid >= spend:
                    self.liquid -= spend
                    self.risk = self.clamp(self.risk + 27, 0, 100)
                    if random.random() < 0.22:
                        self.arrests += 1
                        self.in_jail = True
                        return
                    payout = int(spend * 2.7 * (0.85 + random.random() * 0.6))
                    self.liquid += payout
                self.kids = self.clamp(self.kids - 7, 0, 100)
            else:
                self.kids = self.clamp(self.kids + 4, 0, 100)
                self.stress = self.clamp(self.stress + 6, 0, 100)
        else:  # mixed
            if roll < 0.40:
                self.kids = self.clamp(self.kids + 10, 0, 100)
                self.stress = self.clamp(self.stress - 5, 0, 100)
                self.risk = self.clamp(self.risk - 3, 0, 100)
                self.liquid = max(0, self.liquid - 28)
            elif roll < 0.70:
                pay = 180 + random.randint(0, 200)
                self.liquid += pay
                self.risk = self.clamp(self.risk + 10, 0, 100)
                self.stress = self.clamp(self.stress + 8, 0, 100)
                if random.random() < CRIME_RATE.get(self.mode, 0.03) * 0.8:
                    self.risk = self.clamp(self.risk + 10, 0, 100)
            elif roll < 0.88:
                self.liquid += 120 + random.randint(0, 100)
            # else lay low

    def advance_week(self, strategy='mixed'):
        if self.ended:
            return False

        self.week += 1

        if not self.gig_banned and not self.in_jail:
            self.liquid += 720
        self.liquid = max(0, self.liquid - 85)
        if self.week % 2 == 0:
            self.liquid = max(0, self.liquid - 180)

        self.random_dad_event()
        self.random_kid_incident()
        self.apply_weekly_decay()

        if self.risk > 55 and random.random() < 0.22:
            self.risk += 8
            self.reputation = self.clamp(self.reputation - 5, 0, 100)

        if self.handle_rent():
            return False

        if self.week >= 13 and self.kids > 64 and self.risk < 28 and not self.evicted:
            self.ended = True
            self.end_reason = 'good_ending'
            self.image_triggers.append(('good', 'victory'))
            return False

        if self.check_critical():
            if self.in_jail and not self.ended:
                self.resolve_jail_quick()
            if self.ended:
                return False

        if self.in_jail:
            self.resolve_jail_quick()
            if self.ended:
                return False

        if self.risk > 68 and random.random() < 0.28 and not self.in_jail:
            if self.police_encounter():
                self.resolve_jail_quick()
                if self.ended:
                    return False

        k, r = self.kids, self.risk
        if k >= 70 and r < 25:
            self.image_triggers.append(('good', 'kids_high'))
        elif k < 30 or r > 70:
            self.image_triggers.append(('bad', 'risk_high'))
        elif r > 50:
            self.image_triggers.append(('medium', 'risk_high'))

        return True

    def run_game(self, max_weeks=52, strategy='mixed'):
        self.reset()
        weeks_played = 1
        for _ in range(max_weeks - 1):
            if self.ended:
                break
            self.player_action(strategy)
            if self.in_jail and not self.ended:
                self.resolve_jail_quick()
                if self.ended:
                    break
            if not self.advance_week(strategy):
                break
            weeks_played = self.week

        if not self.ended:
            self.end_reason = 'survived_max_weeks'

        return weeks_played, self.kids, self.risk, self.end_reason, len(self.image_triggers)


def run_simulations(n=500000, strategies=('safe', 'risky', 'mixed'), mode='realistic'):
    results = {}
    for strat in strategies:
        stats = defaultdict(int)
        stats['runs'] = 0
        total_weeks = 0
        total_kids = 0
        total_risk = 0
        total_images = 0
        bad_images = 0
        good_images = 0

        for i in range(n):
            sim = CryptoMomSim(seed=i, mode=mode)
            weeks, kids, risk, reason, img_count = sim.run_game(max_weeks=52, strategy=strat)
            stats['runs'] += 1
            total_weeks += weeks
            total_kids += kids
            total_risk += risk
            total_images += img_count
            stats[reason] = stats.get(reason, 0) + 1

            for item in sim.image_triggers:
                tag = item[0] if isinstance(item, (list, tuple)) and len(item) > 0 else str(item)
                detail = item[1] if isinstance(item, (list, tuple)) and len(item) > 1 else ''
                if tag in ('bad', 'risk_high') or 'risk' in str(detail).lower() or 'evict' in str(detail).lower():
                    bad_images += 1
                if tag == 'good' or 'kids_high' in str(detail) or 'victory' in str(detail):
                    good_images += 1

        results[strat] = {
            'runs': stats['runs'],
            'avg_weeks': total_weeks / stats['runs'],
            'survival_rate': stats.get('survived_max_weeks', 0) / stats['runs'],
            'good_ending_rate': stats.get('good_ending', 0) / stats['runs'],
            'arrest_rate': (stats.get('arrest', 0) + stats.get('jail_destroyed', 0)) / stats['runs'],
            'eviction_rate': stats.get('evicted', 0) / stats['runs'],
            'kids_collapse_rate': stats.get('kids_collapse', 0) / stats['runs'],
            'risk_burn_rate': stats.get('risk_burn', 0) / stats['runs'],
            'avg_final_kids': total_kids / stats['runs'],
            'avg_final_risk': total_risk / stats['runs'],
            'avg_images': total_images / stats['runs'],
            'bad_images': bad_images,
            'good_images': good_images,
            'endings': dict(stats),
        }
    return results


if __name__ == "__main__":
    print("Running 500,000 Crypto Mom simulations per strategy (safe / risky / mixed)...")
    print("Mode: REALISTIC (arcade uses softer decay — run with mode='arcade' to compare)\n")
    print("This may take a few minutes.\n")

    res = run_simulations(n=500000, mode='realistic')

    for strat, s in res.items():
        print(f"\n=== STRATEGY: {strat.upper()} ===")
        print(f"Runs: {s['runs']:,}")
        print(f"Avg weeks survived: {s['avg_weeks']:.2f}")
        print(f"Survival rate (full 52 weeks): {s['survival_rate']*100:.2f}%")
        print(f"Good ending (week 13+): {s['good_ending_rate']*100:.2f}%")
        print(f"Arrest / jail destroyed: {s['arrest_rate']*100:.2f}%")
        print(f"Eviction: {s['eviction_rate']*100:.2f}%")
        print(f"Kids collapse: {s['kids_collapse_rate']*100:.2f}%")
        print(f"Risk burn: {s['risk_burn_rate']*100:.2f}%")
        print(f"Avg final Kids: {s['avg_final_kids']:.1f}")
        print(f"Avg final Risk: {s['avg_final_risk']:.1f}")
        print(f"Avg image triggers per run: {s['avg_images']:.2f}")
        print(f"  - Bad/risk image triggers: {s['bad_images']:,}")
        print(f"  - Good image triggers: {s['good_images']:,}")

    print("\n=== QUICK ANALYSIS ===")
    print("Safe strategy should dominate (high kids, low risk, more good endings).")
    print("Risky should spike arrests and evictions but occasionally high cash.")
    print("Mixed mirrors typical player behavior.")
    print("Night shift crime rate: 3% realistic / 1.5% arcade per shift.")
    print("If safe survival < risky survival, check decay or rent logic.")