# RO-World — Field monsters Lv 10–20

Designed 2026-08-26 to sit after the starter five
(Poring 1, Fabre 2, Lunatic 2, Willow 3, Condor 3).
Schema matches `DATA.MONSTERS` in js/data.js.
Live drops: see monster-drops.md (5% ore / 1% wearable / 3-4% potion). Do not use old potion-only rates.

Progression: Prontera field → swamp → Payon woods → first cave.

## 1. wolf — วูล์ฟ — Lv 10
place: ทุ่งหญ้าโพรนเทรา
emoji: 🐺  color: #6d5a4a
look: หมาป่าขนเทา ตาเหลือง ไหล่สูงกว่าหัวผู้เล่นนิด ยืนสี่ขาแบบ RO
role: bruiser ตัวแรกที่ตีเจ็บ ของฟาร์มหลักช่วง 10–12
hp 3400  mp 70  aspeed 28  atk 158  matk 18  def 16  mdef 8
crit 8  critMult 50  dodge 10  accuracy 118
skills:
  mob_wolf_bite  กัด  basic  atk 1.15
  mob_wolf_howl  คำรามฝูง  special  cd 4  mp 14  atk 1.8
baseExp 240  jobExp 160  zeno 90–140
drops: ore_oridecon 5% / boots_hunt 1% / orange 4%

## 2. poporing — โปโปริ่ง — Lv 11
place: ป่าขอบเมือง
emoji: 💚  color: #4caf6a
look: สไลม์เขียว พองกว่าโปริ่ง มีกลิ่นเปรี้ยว จุดตาสีเข้ม
role: พิษ / น้ำ คู่แฝดโปริ่งช่วงกลาง
hp 3600  mp 90  aspeed 24  atk 150  matk 40  def 14  mdef 16
crit 3  critMult 50  dodge 6  accuracy 110
skills:
  mob_pop_hop  กระโดดชน  basic  atk 1.0
  mob_pop_acid  น้ำเมือกเปรี้ยว  special  cd 3  mp 12  atk 0.6  matk 1.1
baseExp 265  jobExp 175  zeno 95–150
drops: ore_phracon 5% / cloak_mage 1% / blue 4%

## 3. chonchon — ชอนชอน — Lv 12
place: ทุ่งหญ้าโพรนเทรา
emoji: 🪰  color: #c4a35a
look: แมลงบินกลม ปีกใส ตัวสีเหลืองน้ำตาล ลอยสูงกว่าพื้น
role: กระจกบิน เลือดน้อย หลบเก่ง ตีแล้วหาย
hp 2800  mp 60  aspeed 34  atk 155  matk 20  def 10  mdef 8
crit 6  critMult 50  dodge 18  accuracy 122
skills:
  mob_chon_buzz  ชนปีก  basic  atk 1.05
  mob_chon_dive  โฉบลง  special  cd 3  mp 10  atk 1.7
baseExp 280  jobExp 185  zeno 100–155
drops: ore_phracon 5% / helm_iron 1% / red 4%

## 4. roda_frog — โรด้าฟร็อก — Lv 13
place: บึงน้ำเขียว
emoji: 🐸  color: #3d8b5a
look: กบหลังเขียวท้องครีม ตัวใหญ่ กระโดดช้า ตาโต
role: แทงค์ช้า เลือดหนา ลากไฟท์ยาว
hp 4800  mp 80  aspeed 18  atk 170  matk 22  def 28  mdef 14
crit 2  critMult 50  dodge 3  accuracy 108
skills:
  mob_frog_tongue  แลบลิ้น  basic  atk 1.1
  mob_frog_slam  กระโดดทับ  special  cd 4  mp 16  atk 1.9
baseExp 310  jobExp 205  zeno 110–170
drops: ore_elunium 5% / shield_iron 1% / orange 4%

## 5. spore — สปอร์ — Lv 14
place: ป่าพายอน
emoji: 🍄  color: #e8d5a3
look: เห็ดขาบาง หมวกครีมจุดน้ำตาล ปล่อยละอองตอนยืนนิ่ง
role: เวทสนาม เลือดกลาง MATK สูง
hp 3900  mp 120  aspeed 22  atk 145  matk 95  def 14  mdef 22
crit 4  critMult 50  dodge 5  accuracy 115
skills:
  mob_spore_puff  พ่นสปอร์  basic  atk 0.4  matk 0.9
  mob_spore_cloud  หมอกละออง  special  cd 4  mp 18  atk 0.3  matk 1.4
baseExp 335  jobExp 220  zeno 115–180
drops: ore_phracon 5% / armor_robe 1% / blue 4%

## 6. rocker — ร็อกเกอร์ — Lv 15
place: ทุ่งหญ้าโพรนเทรา
emoji: 🦗  color: #8fbf4a
look: จิ้งหรีดเขียวถือใบเป็นกีตาร์ ขาหลังยาว กระโดดเป็นจังหวะ
role: เร็ว คริ เสียงดัง ของฟาร์มช่วง 14–16
hp 4100  mp 85  aspeed 32  atk 188  matk 30  def 16  mdef 12
crit 10  critMult 50  dodge 14  accuracy 128
skills:
  mob_rock_strum  ดีดขา  basic  atk 1.1
  mob_rock_screech  กรีดร้อง  special  cd 3  mp 14  atk 1.75
baseExp 365  jobExp 240  zeno 125–195
drops: ore_oridecon 5% / acc_life 1% / orange 3%

## 7. steel_chonchon — สตีลชอนชอน — Lv 16
place: ทุ่งหินตะวันตก
emoji: ⚙️  color: #8a8f96
look: ชอนชอนหุ้มเกราะเงิน ปีกโลหะ เสียงบินหนัก
role: บินหุ้มเกราะ DEF สูง ดาเมจกายตัดยาก
hp 3600  mp 70  aspeed 30  atk 195  matk 24  def 32  mdef 16
crit 7  critMult 50  dodge 12  accuracy 125
skills:
  mob_steel_buzz  ชนเกราะ  basic  atk 1.2
  mob_steel_ram  พุ่งชนเหล็ก  special  cd 4  mp 16  atk 1.85
baseExp 395  jobExp 260  zeno 135–210
drops: ore_elunium 5% / shield_iron 1% / orange 4%

## 8. savage_babe — เซเวจเบบี้ — Lv 17
place: ป่าลึก
emoji: 🐗  color: #b07a48
look: ลูกหมูป่าขนน้ำตาล งาสั้น ตัวท้วม วิ่งชนหัวต่ำ
role: ชาร์จ เลือดหนา ตีแรง ของฟาร์มช่วง 16–18
hp 5200  mp 75  aspeed 26  atk 220  matk 20  def 22  mdef 12
crit 9  critMult 50  dodge 8  accuracy 124
skills:
  mob_babe_gore  ขวิด  basic  atk 1.2
  mob_babe_rush  พุ่งชน  special  cd 4  mp 16  atk 2.0
baseExp 430  jobExp 280  zeno 145–225
drops: ore_oridecon 5% / armor_chain 1% / orange 4%

## 9. elder_willow — เอลเดอร์วิลโลว์ — Lv 18
place: ป่าพายอน
emoji: 🔥  color: #c45c2a
look: ต้นไม้แก่ เปลือกไหม้ ใบแดงส้ม ตาในโพรงลำต้น
role: วิลโลว์ไฟ แทงค์เวท ต่อจากวิลโลว์เลเวล 3
hp 5600  mp 140  aspeed 20  atk 175  matk 130  def 24  mdef 28
crit 4  critMult 50  dodge 4  accuracy 120
skills:
  mob_elder_hit  เหวี่ยงกิ่งไฟ  basic  atk 0.8  matk 0.6
  mob_elder_flame  ไฟลามใบ  special  cd 4  mp 20  atk 0.4  matk 1.5
baseExp 470  jobExp 305  zeno 155–240
drops: ore_elunium 5% / helm_wizard 1% / blue 4%

## 10. skeleton — สเกเลตัน — Lv 20
place: ถ้ำหินพายอน
emoji: 💀  color: #d8d0c0
look: โครงกระดูกถือดาบสั้น เกราะหนังขาด ตาเบ้าแดง ตัวแรกในถ้ำ
role: อันเดดปิดช่วง 18–20 เปิดดันเจี้ยนพายอน
hp 6100  mp 90  aspeed 24  atk 245  matk 35  def 30  mdef 10
crit 8  critMult 50  dodge 6  accuracy 130
skills:
  mob_skel_slash  ฟันดาบกระดูก  basic  atk 1.2
  mob_skel_bone  ขว้างกระดูก  special  cd 3  mp 14  atk 1.8
baseExp 530  jobExp 345  zeno 175–270
drops: ore_elunium 5% / acc_life 1% / white 3%

## Spawn notes
- ทุ่งหญ้าโพรนเทรา: wolf, chonchon, rocker
- ป่าขอบเมือง: poporing (mix with leftover willow/condor)
- บึงน้ำเขียว: roda_frog
- ป่าพายอน: spore, elder_willow
- ทุ่งหินตะวันตก: steel_chonchon
- ป่าลึก: savage_babe
- ถ้ำหินพายอน: skeleton
- Do not dump all 10 on the current 100×100 starter field.
