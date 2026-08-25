# Field monster primary + defense stats

Use these on every DATA.MONSTERS entry. Keep authored hp/atk/matk/aspeed.
Derive combat scores from the locked formulas (do not hardcode HIT/FLEE/Soft unless noted).

## Formulas (already in stats.js)
- HIT  = 170 + level + DEX          (STATS.monsterHit)
- FLEE = 100 + level + AGI          (STATS.monsterFlee)
- Soft DEF  = floor((VIT + level) / 2)   (STATS.monsterSoftDef)
- Soft MDEF = floor((INT + level) / 2)   ADD STATS.monsterSoftMdef and use it
- Hard DEF  = authored points (hardFactor)
- Hard MDEF = authored 0-100 percent (combat already treats it as %)

## Engine wiring
computeMonsterStats must:
- read str, agi, vit, int, dex, luk, hardDef, hardMdef
- softDef from vit (already)
- softMdef from INT via new monsterSoftMdef, not the old flat mdef
- hardMdef from mobDef.hardMdef (currently hardcoded 0 — fix this)
- hit/flee already derive if agi/dex are set

DEX is stored even though the user listed STR/AGI/VIT/INT/LUK, because HIT uses DEX.

## Table
id | lv | STR | AGI | VIT | INT | DEX | LUK | HIT | FLEE | SoftDEF | SoftMDEF | HardDEF | HardMDEF%
poring | 1 | 5 | 5 | 4 | 2 | 4 | 8 | 175 | 106 | 2 | 1 | 0 | 0
fabre | 2 | 6 | 6 | 8 | 3 | 5 | 4 | 177 | 108 | 5 | 2 | 1 | 0
lunatic | 2 | 7 | 14 | 5 | 2 | 8 | 10 | 180 | 116 | 3 | 2 | 0 | 0
willow | 3 | 8 | 4 | 12 | 14 | 6 | 3 | 179 | 107 | 7 | 8 | 8 | 6
condor | 3 | 9 | 12 | 6 | 3 | 11 | 5 | 184 | 115 | 4 | 3 | 2 | 0
wolf | 10 | 28 | 22 | 16 | 4 | 18 | 8 | 198 | 132 | 13 | 7 | 8 | 2
poporing | 11 | 14 | 12 | 20 | 22 | 12 | 10 | 193 | 123 | 15 | 16 | 4 | 8
chonchon | 12 | 12 | 36 | 10 | 6 | 20 | 8 | 202 | 148 | 11 | 9 | 2 | 4
roda_frog | 13 | 18 | 8 | 38 | 8 | 12 | 4 | 195 | 121 | 25 | 10 | 22 | 5
spore | 14 | 10 | 10 | 16 | 36 | 14 | 6 | 198 | 124 | 15 | 25 | 6 | 12
rocker | 15 | 16 | 32 | 14 | 10 | 26 | 18 | 211 | 147 | 14 | 12 | 6 | 4
steel_chonchon | 16 | 18 | 28 | 24 | 8 | 20 | 6 | 206 | 144 | 20 | 12 | 48 | 8
savage_babe | 17 | 36 | 16 | 28 | 4 | 16 | 8 | 203 | 133 | 22 | 10 | 18 | 3
elder_willow | 18 | 16 | 8 | 30 | 40 | 14 | 6 | 202 | 126 | 24 | 29 | 20 | 22
skeleton | 20 | 34 | 14 | 26 | 8 | 22 | 4 | 212 | 134 | 23 | 14 | 30 | 6

Roles: lunatic/chonchon/rocker = AGI/FLEE. frog/steel = tank Hard DEF. spore/elder/poporing = INT/Soft MDEF. wolf/savage/skeleton = STR. poring = LUK mascot.
