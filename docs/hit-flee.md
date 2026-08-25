# Locked HIT / FLEE / Perfect Dodge

Source of truth for connect chance. Combat uses HIT, FLEE, and Perfect Dodge — not the old % accuracy / % dodge.

## Player

- HIT = 175 + BaseLv + DEX + floor(LUK/3) + Bonus
- FLEE = 100 + BaseLv + AGI + floor(LUK/5) + ItemBonus
- Perfect Dodge = 1 + LUK × 0.1 + Mods, one decimal place

Bonus / ItemBonus / Mods come from equipment `hit` / `flee` / `perfectDodge` flats.

## Monster / boss

- HIT = 170 + BaseLv + DEX
- FLEE = 100 + BaseLv + AGI
- No PD unless the def sets `perfectDodge` or `pd`
- Missing DEX/AGI count as 0
- SkillBonus (fog / veil / phantom / angel dodge flats, plus `fleeSkillBonus`) adds to FLEE **outside** surround shrink

## Physical connect (`COMBAT.rollConnect`)

1. Magic (`atkRatio == 0 && matkRatio > 0`, or `opts.isMagic`) — no dodge / PD / FLEE (always connects; magic still cannot crit in `calcDamage`)
2. PD roll first — miss even on a would-be crit; surround does not affect PD
3. Crit — hit, skip FLEE; existing Hard-DEF-only crit path in `calcDamage`
4. HitChance = clamp(AttackerHIT − DefenderFLEE_actual, 5, 100)
5. If hit — existing Hard then Soft DEF

DodgeChance = 100 − HitChance (0–95%).

`doHitAttack` rolls connect once, then passes `forceCrit` / `canCrit: false` so crit is not rolled twice.

## Surround (mobs attacking the player ≥ 3)

ActualFLEE = 100 + SkillBonus + (FLEE − 100) × max(0, 1 − (Mobs − 2) × 0.1)

FLEE in that formula excludes SkillBonus.

- 1–2 mobs: no shrink (ActualFLEE = FLEE + SkillBonus)
- 12+ mobs: factor 0 → 100 + SkillBonus
- ATB / 1v1 default surround = 1
- Field RT: `WORLD.makePair` puts living aggro foes on `state.foes`; `COMBAT.surroundCount` counts them

## LUK1 book row (Lv99 DEX99 / AGI99 LUK1)

HIT 373, FLEE 298, PD 1.1

| matchup | result |
|---|---|
| vs mob FLEE 239 | hit 100% |
| vs mob FLEE 298 | hit 75% |
| mob HIT 319 vs us | hit 21% |
| mob HIT 368 vs us | hit 70% |
| surround 4, ActualFLEE 258.4 vs HIT 319 | HitChance **60.6** (book 61% is rounded — do not force 61) |
| surround 6, ActualFLEE 218.8 vs HIT 319 | hit 100% |

Do not mix the AGI99 LUK20 row (FLEE 302 / 66%) into these asserts.

## API

- `STATS.playerHit`, `playerFlee`, `perfectDodge`, `monsterHit`, `monsterFlee`, `actualFlee`, `hitChance`
- `COMBAT.effectiveHit`, `unitFleeSkillBonus`, `surroundCount`, `defenderActualFlee`, `hitChance`, `rollConnect`
- `COMBAT.rollHit` remains as a `.hit` shim over `rollConnect`
- `computeHeroStats` sets `hit` / `flee` / `perfectDodge`; `gearDelta` includes them
- `equipmentFlatBonuses` empty bag includes `hit`, `flee`, `perfectDodge`
- STATUS ค่าพิเศษ shows HIT, FLEE, Perfect Dodge (1 decimal) instead of % หลบ / % แม่นยำ

Legacy `dodge` / `accuracy` fields and `effectiveDodge` / `effectiveAccuracy` stay for old tests and item chips. Combat connect uses HIT / FLEE / PD.
