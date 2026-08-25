# RO-World / ROATB — Sound System

เจ้าของ: Sound
อัปเดต: 26 ส.ค. 2026
สถานะตอนนี้: เกมยังไม่มี audio เลย ไม่มีโฟลเดอร์เสียง ไม่มี Web Audio
จุดต่อที่พร้อมที่สุด: `FX.applyOne` / `FX.play` ใน `js/fx.js`

ทิศทางเสียง: homage คลาสสิก Gravity RO (pre-Renewal) — คลิก UI กรุ๊งกริ๊ง,
ตีโลหะสั้น, คริติคอลแหลม, มอนสเตอร์น่ารัก/ดุแยกชัด, BGM ลูปเมือง/ทุ่ง/ถ้ำ
ไม่ทำเสียงสมจริง AAA

---

## 1. บัส (mixer)

```
Master
├── BGM          เพลงลูปต่อฉาก
├── Ambience     ลม นก ถ้ำ น้ำ (ชั้นบาง อยู่ใต้ BGM)
├── SFX Combat   ตี โดน คริ สกิล หลบ พิษ ฮีล ตาย
├── SFX World    เดิน เก็บดรอป คุย NPC วาร์ป
└── SFX UI       คลิก เปิดหน้าต่าง ซื้อ แจ้งเตือน ชนะ/แพ้
```

ค่าเริ่ม (linear 0–1, จำใน localStorage คีย์ `ro.atb.mix`)

| บัส | default | โน้ต |
|---|---|---|
| Master | 0.80 | มิวท์ทั้งเกม |
| BGM | 0.55 | crossfade 800ms ตอนเปลี่ยนฉาก |
| Ambience | 0.35 | ตัดตอนเข้า ATB combat |
| Combat | 0.90 | ลำดับสูงสุดในไฟต์ |
| World | 0.70 | เดิน + ดรอป |
| UI | 0.75 | คลิกสั้น ไม่ทับคริ |

กติกาเบราว์เซอร์: สร้าง `AudioContext` ครั้งเดียว หลังคลิก/คีย์ครั้งแรก (autoplay policy)
ไฟล์เป็น `.ogg` เป็นหลัก `.mp3` เป็น fallback
โฟลเดอร์: `assets/sfx/` และ `assets/bgm/`

---

## 2. ตั้งชื่อไฟล์

```
assets/sfx/ui/{action}.ogg
assets/sfx/combat/{event}.ogg
assets/sfx/skill/{heroId}_{skillId}.ogg
assets/sfx/mob/{mobId}_{event}.ogg
assets/sfx/world/{action}.ogg
assets/bgm/{scene}.ogg
```

ตัวอย่าง
- `sfx/ui/click.ogg`
- `sfx/combat/hit.ogg` `crit.ogg` `miss.ogg` `heal.ogg` `poison.ogg` `buff.ogg` `guard.ogg` `die.ogg` `win.ogg` `lose.ogg`
- `sfx/skill/warrior_attack.ogg` `warrior_magifireblade.ogg`
- `sfx/mob/poring_idle.ogg` `poring_hit.ogg` `poring_die.ogg`
- `sfx/world/step.ogg` `pickup.ogg` `warp.ogg`
- `bgm/prontera.ogg` `bgm/field.ogg` `bgm/combat.ogg` `bgm/boss_cave.ogg`

เวอร์ชันสุ่มกันล้า: `hit_01` `hit_02` `hit_03` เครื่องสุ่มตอนเล่น ไม่ใส่เลขในโค้ดเรียก

---

## 3. จุดยิงเสียงในโค้ด

ทุกเสียงต่อสู้ยิงจาก `FX.applyOne(e)` คู่กับแอนิเมชันที่มีอยู่แล้ว
อย่าใส่เสียงในสูตร `combat.js`

| `e.kind` / anim | เสียง |
|---|---|
| `act` + atk | swing ของอาชีพ + สกิลเฉพาะ |
| `act` + heal | `heal_cast` |
| `act` + buff | `buff` |
| `dmg` ปกติ | `hit` (ชั้นผิวตามอาวุธ/มอน) |
| `dmg` + crit | `hit` + `crit` ทับ |
| `miss` | `miss` |
| `heal` | `heal` |
| `poison` | `poison_tick` |
| HP ฮีโร่ = 0 | `die` ฮีโร่ + `lose` |
| HP บอส = 0 | `die` บอส + `win` |
| เกจ A.speed เต็ม (ฝั่งฮีโร่) | `atb_ready` สั้นมาก (optional, เบา) |

โลกเปิด: `world.js` / `map.js`
- ก้าวหนึ่งช่อง → `step` (cooldown 120ms)
- เก็บดรอป → `pickup`
- ชนมอนเข้าไฟต์ → sting สั้น แล้วสลับ BGM เป็น combat/boss
- พูด NPC / Kafra → `npc_open`
- วาร์ป → `warp`

UI: `ui.js` คลิกปุ่มหลัก / เปิดหน้าต่าง / ซื้อสำเร็จ / แต้มไม่พอ / refine สำเร็จ-แตก

---

## 4. ลำดับลงของ (ship first)

ทำชุดนี้ก่อน ที่เหลือค่อยเติมเฉพาะตัว

### ชุด 0 — โครงเครื่อง (ไม่มีไฟล์ก็ต้องมี)
`js/audio.js`: AudioContext, บัส, unlock ตอนคลิกแรก, `AUDIO.play(id)`, `AUDIO.bgm(id)`, มิวท์
hook `FX.applyOne` + คลิก UI หลัก

### ชุด 1 — แกนต่อสู้ (เล่นเกมรู้เรื่องทันที)
1. `ui/click`
2. `ui/window_open`
3. `combat/swing_melee` (นักรบ / แอสซาซิน)
4. `combat/swing_bow` (ฮันเตอร์)
5. `combat/hit`
6. `combat/crit`
7. `combat/miss`
8. `combat/heal`
9. `combat/poison`
10. `combat/buff`
11. `combat/die`
12. `combat/win`
13. `combat/lose`
14. `world/step`
15. `world/pickup`
16. `bgm/prontera`
17. `bgm/field`
18. `bgm/combat`
19. `ui/buy`
20. `ui/error`

### ชุด 2 — สกิลฮีโร่ (18 ไฟล์, อาชีพละ 6)
นักรบ: attack, magifireblade, guard, heal, blade_storm, sanctuary
แอสซาซิน: stab, shadowkill, veil, counter, nightfall, phantom
ฮันเตอร์: arrowshot, powershot, focus, soularrow, rain, mark

ไม้ตาย / AoE ดังกว่า basic, บัฟเบาและสูง

### ชุด 3 — บอส 7 + สนาม 5 ตัวแรก
แต่ละตัว: idle (สั้น ใช้ตอนเข้าใกล้), hit, die
บอสเพิ่ม: skill_special, skill_ult (เอาตอน HP ต่ำ)

บอส: มอนสเตอร์ร้าย, โกเลมหิน, หมาป่าขนขาว, อัศวินเหล็กสีเลือด,
ราชันปีศาจแห่งนรก, นางฟ้ามงกุ่มมรณะ, พระผู้สร้างโลก

สนามเริ่ม: Poring, Fabre, Lunatic, Willow, Condor
(ชุดถัดไปตาม `docs/monsters-lv10-20.md`: wolf, poporing, chonchon, …)

### ชุด 4 — BGM ต่อฉากบอส
ถ้ำมอนสเตอร์ / ซากศิลา / หุบเขาหมาป่า / ปราสาทโลหิต /
ประตูนรก / วิหารมรณะ / บัลลังก์ผู้สร้าง
ถ้ายังไม่มีแยก ใช้ `bgm/boss` ร่วมก่อน แล้วค่อยแยก

---

## 5. โทนต่ออาชีพ / บอส

| ตัว | โทน |
|---|---|
| นักรบผู้กล้า | ดาบหนัก โล่ดังก้อง ฮีลศักดิ์สิทธิ์ |
| มือสังหารเงา | มีดสั้น ผ้า เงา whoosh พิษเปียก |
| นักล่าผู้ใช้เหยี่ยว | ธนูดีด เหยี่ยวร้องสั้น ฝนธนู |
| โปริ่ง | เด้งยาง น่ารัก ตายปุ๊บ |
| โกเลมหิน | หินถล่ม โล่หินทึบ |
| หมาป่าขนขาว | คำราม พิษ หมอก |
| อัศวินเหล็ก | ดาบ+เกราะโลหะ ฟาดสายฟ้า |
| ราชันปีศาจ | ไฟนรก ดูดเลือด ต่ำและหนา |
| นางฟ้ามงกุฎ | ระฆัง / ปีก / รีเซ็ตเกจแหลม |
| พระผู้สร้าง | ชั้นต่ำมาก + คอรัส ตอนไม้ตาย |

---

## 6. กฎมิกซ์ตอนสู้ (ATB)

- ไฟต์ละเสียงพร้อมกันไม่เกิน 6
- คริ / ไม้ตายบอส ตัดเสียงตีธรรมดาได้
- เดินบนแมพไม่ดังตอน combat overlay เปิด
- BGM combat เริ่มตอนเข้าไฟต์, กลับ field/city ตอนออก (crossfade)
- `atb_ready` ห้ามดังกว่า hit — เป็นติ๊กเล็กน้อยเท่านั้น ไม่งั้นรำคาญเพราะเกจวิ่งทั้งไฟต์

---

## 7. API ที่เกมจะเรียก (เป้า `js/audio.js`)

```
AUDIO.unlock()            // pointerdown ครั้งแรก
AUDIO.play(id, {bus, vol, pan})
AUDIO.bgm(id)             // crossfade
AUDIO.ambience(id|null)
AUDIO.mute(bus, on)
AUDIO.setVol(bus, 0..1)
AUDIO.stopAll()           // ออกจากไฟต์ / กลับโฮม
```

id คือ path โดยไม่ต้องใส่นามสกุล เช่น `combat/crit`

---

## 8. ยังไม่ทำ

- เสียงพูดบท (VO)
- 3D positional เต็ม (แมพ 100×100 พอด้วย pan ซ้ายขวาตามฝั่ง)
- เพลงลิขสิทธิ์จาก iRO จริง (ทำ homage โทนใกล้ ห้ามก็อปไฟล์ต้นฉบับ)
