# Field monster drops

Three independent rolls per kill. Do not use the old potion-only `drops` tables.

## Rates
- 5% Ore (refine material)
- 1% wearable (some kinds, never high-tier)
- 3-4% potion

## New materials (add to DATA.MATERIALS)
- ore_phracon  แร่ไฟคอน   low refine +1 to +4, any slot
- ore_elunium  เอลูเนียม    wearable refine +5 to +10 (helm/armor/boots/cloak/shield)
- ore_oridecon โอริเดคอน   weapon refine +5 to +10

Refine must spend 1 matching ore in addition to the existing Zeno cost.
If the player has no ore, fail with "แร่ไม่พอ".

## Wiring
applyFieldRewards currently always does `save.potions[drop.id]++`. Change to:
- kind "potion" -> potions
- kind "material" -> save.materials[id]++
- kind "item" -> save.owned[id] = true (already-owned is still a success, do not duplicate-fail)

Each drop row: { kind, id, chance }

## Per-monster table (3 rows each)

id | ore 5% | wearable 1% | potion
poring | ore_phracon | helm_leather | red 4%
fabre | ore_phracon | armor_rough | red 4%
lunatic | ore_phracon | cloak_travel | orange 3%
willow | ore_phracon | boots_leather | blue 4%
condor | ore_phracon | shield_wood | orange 3%
wolf | ore_oridecon | boots_hunt | orange 4%
poporing | ore_phracon | cloak_mage | blue 4%
chonchon | ore_phracon | helm_iron | red 4%
roda_frog | ore_elunium | shield_iron | orange 4%
spore | ore_phracon | armor_robe | blue 4%
rocker | ore_oridecon | acc_life | orange 3%
steel_chonchon | ore_elunium | shield_iron | orange 4%
savage_babe | ore_oridecon | armor_chain | orange 4%
elder_willow | ore_elunium | helm_wizard | blue 4%
skeleton | ore_elunium | acc_life | white 3%

Wearable pool is low/mid only. No helm_abyss / armor_ruin / weapon_void / acc_triad from the field.

Show loot in the existing field-reward toast (name of ore / item / potion).
