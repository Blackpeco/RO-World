# RO-World — Arrow spec v1

Locked 2026-08-26 by Item. Kirito implements. Do not invent extra arrows this pass.

Bows stay as live: weapon_bow 60 / weapon_oakbow 100 / weapon_hawk 150, twoHand, weaponLevel 1. No Hunter Bow 125.

## Rules

- Ammo items, stackable. Field `arrowAtk` is what `STATS.arrowAtkFrom` reads.
- All arrows are elementless (`element: "none"`). Same lock as weapons.
- Archer only (`jobs: DATA.JOB_BOW`).
- `reqLevel` tracks the matching bow tier so cheap arrows are usable from Lv 1.
- Do not leave `arrowAtk` at 0 — hunters cannot shoot.
- Start the hunter with basic arrows so the first field fight works.

## Catalog

| id | name | arrowAtk | reqLevel | price (ต่อดอก) | start |
|---|---|---:|---:|---:|---:|
| arrow | ลูกธนู | 25 | 1 | 1 | 100 |
| arrow_steel | ลูกธนูเหล็ก | 40 | 12 | 4 | 0 |
| arrow_oridecon | ลูกธนูโอริเดคอน | 50 | 32 | 10 | 0 |

Shop may sell them as singles or packs of 100 (pack price = 100 × unit). Potion shop is the right counter.

## DATA.ITEMS shape

```
{
  id, type: "ammo", name, price, arrowAtk, reqLevel,
  element: "none", jobs: DATA.JOB_BOW, stack: true, bonuses: {}
}
```

START: `{ arrow: 100 }` (or save.ammo = { id: "arrow", count: 100 }).

## Out of scope

- Element arrows (fire/silver/etc.)
- Changing bow Weapon ATK / WLv
- Arrow as a 2h conflict
