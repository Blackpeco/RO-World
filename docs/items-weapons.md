# RO-World — Weapon spec v1

Locked 2026-08-26 by Item. Kirito implements. Do not invent extra types this pass.

## Rules

- Six `weaponClass` values: `sword` `dagger` `bow` `staff` `axe` `mace`
- `weaponAtk` is Weapon ATK from the piece (not status ATK, not the old `bonuses.atk`)
- Staff uses `weaponMatk` (Weapon MATK) instead; `weaponAtk` = 0
- Higher `price` and `reqLevel` → higher Weapon ATK / MATK
- No element. Every weapon is elementless (`element: "none"`). Do not add fire/water/wind/earth/holy/shadow.
- Keep existing ids where they map. New ids for dagger/bow/axe/mace and extra staff.
- Strip old `bonuses.atk` / `bonuses.matk` / `bonuses.str` / `bonuses.int` / `bonuses.crit` / `bonuses.mdef` from these weapons.
- Refine stays `+8` Weapon ATK / MATK per plus (existing constants).
- Job gates follow classic RO and the armor job families already in `DATA.JOB_*`.

## Ranges (lock)

| class | stat | min | max |
|---|---|---:|---:|
| sword | weaponAtk | 70 | 200 |
| dagger | weaponAtk | 40 | 120 |
| bow | weaponAtk | 60 | 150 |
| staff | weaponMatk | 100 | 260 |
| axe | weaponAtk | 100 | 250 |
| mace | weaponAtk | 60 | 180 |

## Jobs

- sword: Swordsman
- dagger: Thief / Mage / Archer
- bow: Archer
- staff: Mage / Acolyte
- axe: Swordsman / Merchant
- mace: Acolyte / Merchant

Hero map stays warrior=swordsman, assassin=thief, hunter=archer.

## Catalog (3 tiers each: ฝึก / กลาง / ชั้นสูง)

### ดาบ sword · Weapon ATK 70–200 · Swordsman

| id | name | weaponAtk | reqLevel | price | tier |
|---|---|---:|---:|---:|---|
| weapon_short | ดาบสั้นฝึกซ้อม | 70 | 1 | 200 | |
| weapon_long | ดาบยาว | 120 | 12 | 600 | |
| weapon_void | ดาบราชัน | 200 | 35 | 1500 | high |

### มีด dagger · Weapon ATK 40–120 · Thief / Mage / Archer

| id | name | weaponAtk | reqLevel | price | tier |
|---|---|---:|---:|---:|---|
| weapon_knife | มีดสั้นฝึก | 40 | 1 | 180 | |
| weapon_dirk | กริช | 75 | 12 | 500 | |
| weapon_shadow | กริชเงา | 120 | 30 | 1200 | high |

### ธนู bow · Weapon ATK 60–150 · Archer

| id | name | weaponAtk | reqLevel | price | tier |
|---|---|---:|---:|---:|---|
| weapon_bow | ธนูฝึกยิง | 60 | 1 | 200 | |
| weapon_oakbow | ธนูไม้โอ๊ค | 100 | 12 | 550 | |
| weapon_hawk | ธนูเหยี่ยว | 150 | 32 | 1400 | high |

### คทา staff · Weapon MATK 100–260 · Mage / Acolyte

| id | name | weaponMatk | reqLevel | price | tier |
|---|---|---:|---:|---:|---|
| weapon_staff | คทาฝึกเวท | 100 | 1 | 200 | |
| weapon_arch | คทาไม้ | 170 | 14 | 650 | |
| weapon_sage | คทามหาเวท | 260 | 36 | 1600 | high |

### ขวาน axe · Weapon ATK 100–250 · Swordsman / Merchant

| id | name | weaponAtk | reqLevel | price | tier |
|---|---|---:|---:|---:|---|
| weapon_hatchet | ขวานไม้ | 100 | 1 | 220 | |
| weapon_battleaxe | ขวานต่อสู้ | 160 | 16 | 700 | |
| weapon_waraxe | ขวานสงคราม | 250 | 38 | 1600 | high |

### กระบอง mace · Weapon ATK 60–180 · Acolyte / Merchant

| id | name | weaponAtk | reqLevel | price | tier |
|---|---|---:|---:|---:|---|
| weapon_club | กระบองไม้ | 60 | 1 | 180 | |
| weapon_mace | กระบองเหล็ก | 110 | 12 | 550 | |
| weapon_holy | กระบองศักดิ์สิทธิ์ | 180 | 34 | 1400 | high |

## Fields on DATA.ITEMS

```
weaponClass, weaponAtk, weaponMatk, reqLevel, element: "none", jobs, bonuses: {}
```

`bonuses` empty on these 18. Shop/equip line should print `Weapon ATK N` or `Weapon MATK N`, then jobs, then `ต้องการ Lv X`. Do not print an element.

## Out of scope this pass

- 1h vs 2h
- Arrows as ammo
- Weapon-type ASPD penalty (Formula reserved −50…+2)
- Weapon elements (locked off — all none)
