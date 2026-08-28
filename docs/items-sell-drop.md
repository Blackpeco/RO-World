# RO-World — Sell & Drop spec v1

Locked 2026-08-26 by Item. Kirito implements. Purpose: let the player shed weight when over 70/90/100%.

Weight already live: 70%+ no regen, 90%+ cannot attack/skills, 100% cannot buy/pick up.

## Sell ขาย

- Sell at gear shop and potion shop (city). Also from bag while in Prontera.
- Price: `sellZeno = max(1, floor(buyPrice / 2))` if buyPrice >= 1, else 0.
- Uses shop `price` only. Refine does not add sell value.
- Gear (`save.owned`): sell 1, clear owned, clear refine, unequip if worn, +Zeno.
- Stacks (potions, arrows/ammo, materials): sell `qty` (1 … count). +Zeno × qty, subtract count/weight.
- Cannot sell what you do not own. Cannot sell equipped gear until it is unequipped first (auto-unequip on confirm is OK).
- After sell, recalc weight. Toast: `ขาย [ชื่อ] ×N · +X Zeno`.

## Drop โยนทิ้ง

- From bag / inventory anywhere (city or field). No Zeno.
- Item is gone. Not left on the ground. No pickup.
- Gear: unequip if worn, clear owned + refine.
- Stacks: drop `qty` (1 … count).
- Confirm on gear and on qty > 1. Single potion/arrow can drop without a second dialog if UI is tight.
- Toast: `โยนทิ้ง [ชื่อ] ×N`.

## Qty UI

- Stacks: buttons 1 / 10 / ทั้งหมด plus a number field. Clamp to owned count.
- Gear: always 1.

## Do not

- Do not change weight caps or 70/90/100 penalties.
- Do not add a player shop / vending.
- Do not drop items onto the map tile.
- Do not let sell/drop create negative counts.
