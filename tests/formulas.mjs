import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const ctx = { console, Math, Date, Object, Array, Number, String, Boolean, Error };
vm.createContext(ctx);
for (const f of ["data.js", "stats.js", "combat.js", "pve.js", "map.js", "world.js", "fx.js"]) {
  vm.runInContext(readFileSync(join(root, "js", f), "utf8"), ctx, { filename: f });
}

const { DATA, STATS, COMBAT, PVE, MAP } = ctx;
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log("  ok  " + msg);
  } else {
    failed += 1;
    console.error("  FAIL  " + msg);
  }
}

function almost(a, b, eps) {
  return Math.abs(a - b) <= (eps == null ? 1e-9 : eps);
}

function dummy(partial) {
  return Object.assign(
    {
      atk: 0,
      matk: 0,
      def: 0,
      mdef: 0,
      crit: 0,
      critMult: 50,
      dodge: 0,
      accuracy: 100,
      weakenTurns: 0,
      focusTurns: 0,
      rageTurns: 0,
      curseTurns: 0,
      dragonStacks: 0,
      isHero: true,
      aspeed: 25,
    },
    partial
  );
}

function noCritRng() {
  const rng = COMBAT.createRng(1);
  rng.chance = function () {
    return false;
  };
  return rng;
}

console.log("DEF/MDEF split + min 1");
{
  const atk = dummy({ atk: 100, matk: 80 });
  const tgt = dummy({ def: 30, mdef: 20 });
  const r = COMBAT.calcDamage(atk, tgt, 1.0, 1.0, { rng: noCritRng(), canCrit: true });
  assert(almost(r.atkPart, 70), "ATK part 100-30=70, got " + r.atkPart);
  assert(almost(r.matkPart, 60), "MATK part 80-20=60, got " + r.matkPart);
  assert(r.damage === 130, "net 130, got " + r.damage);
}
{
  const atk = dummy({ atk: 10, matk: 0 });
  const tgt = dummy({ def: 999, mdef: 999 });
  const r = COMBAT.calcDamage(atk, tgt, 1.0, 0, { rng: noCritRng() });
  assert(r.atkPart === 0, "ATK part floored at 0");
  assert(r.matkPart === 0, "MATK part floored at 0");
  assert(r.damage === 1, "net damage min 1, got " + r.damage);
}

console.log("poison ignores armor");
{
  const atk = dummy({ matk: 200 });
  const tgt = dummy({ def: 999, mdef: 999 });
  const r = COMBAT.calcDamage(atk, tgt, 0, 0.3, { ignoreArmor: true, isPoison: true, canCrit: false });
  assert(r.damage === 60, "poison 30% of 200 = 60 vs full armor, got " + r.damage);
}

console.log("level bonuses");
{
  const lv1 = STATS.levelBonuses(1);
  const lv3 = STATS.levelBonuses(3);
  const lv6 = STATS.levelBonuses(6);
  assert(lv1.hp === 0 && lv1.atk === 0, "level 1 extra = 0");
  assert(lv3.hp === 200 && lv3.mp === 60 && lv3.atk === 10 && lv3.matk === 10 && lv3.def === 4 && lv3.mdef === 4, "level 3 = 2 stacks");
  assert(lv6.hp === 500 && lv6.mp === 150 && lv6.atk === 25 && lv6.def === 10, "level 6 = 5 stacks");
}

console.log("STR / VIT / INT special bonuses");
{
  const b20 = STATS.statPointBonuses({ str: 20, vit: 0, int: 0, agi: 0, dex: 0, luk: 0 });
  assert(b20.strBonusAtk === 4, "STR 20 bonus ATK floor(2)^2 = 4, got " + b20.strBonusAtk);
  assert(almost(b20.atk, 24), "STR 20 ATK 20+4=24, got " + b20.atk);
  assert(b20.hp === 200, "STR 20 HP +200");
  assert(almost(b20.hpRegen, 10), "STR 20 HP regen +10");
}
{
  const b = STATS.statPointBonuses({ str: 0, vit: 8, int: 0, agi: 0, dex: 0, luk: 0 });
  assert(b.vitBonusHp === 500, "VIT 8 special +250*2=500");
  assert(b.hp === 900, "VIT 8 HP 400+500=900, got " + b.hp);
  assert(b.def === 8, "VIT 8 DEF +8");
  assert(almost(b.hpRegen, 8), "VIT 8 HP regen +8");
  assert(almost(b.statusResist, 8), "VIT 8 resist +8%");
}
{
  const b = STATS.statPointBonuses({ str: 0, vit: 0, int: 15, agi: 0, dex: 0, luk: 0 });
  assert(b.intBonusMatk === 1, "INT 15 bonus MATK floor(1)^2=1");
  assert(b.intBonusMp === 75, "INT 15 bonus MP +25*3=75");
  assert(b.mp === 135, "INT 15 MP 60+75=135");
  assert(almost(b.matk, 16), "INT 15 MATK 15+1=16");
  assert(b.mpRegen === 3, "INT 15 MP regen +3");
  assert(b.mdef === 15, "INT 15 MDEF +15");
}

console.log("equipment raw stat points flow through formulas");
{
  const equip = DATA.emptyEquip();
  equip.armor = "armor_rough"; // +3 VIT
  const st = STATS.computeHeroStats("warrior", DATA.emptyAllocated(), equip, 1);
  assert(st.totalPts.vit === 3, "equip +3 VIT in totalPts");
  assert(st.maxHp === 3000 + 150, "warrior +3 VIT => +150 HP, got " + st.maxHp);
  assert(st.def === 30 + 3, "warrior +3 VIT => +3 DEF, got " + st.def);
}

console.log("skill damage vs dummy (no crit, no weaken)");
{
  const w = COMBAT.createUnit(STATS.computeHeroStats("warrior", DATA.emptyAllocated(), DATA.emptyEquip(), 1), "left");
  const a = COMBAT.createUnit(STATS.computeHeroStats("assassin", DATA.emptyAllocated(), DATA.emptyEquip(), 1), "left");
  const h = COMBAT.createUnit(STATS.computeHeroStats("hunter", DATA.emptyAllocated(), DATA.emptyEquip(), 1), "left");
  const dummy0 = dummy({ def: 0, mdef: 0 });
  const dummyArm = dummy({ def: 30, mdef: 20 });
  const rng = noCritRng();

  const wa0 = COMBAT.calcDamage(w, dummy0, 1.4, 0, { rng: rng });
  assert(wa0.damage === 224, "warrior attack 140%*160=224, got " + wa0.damage);

  const waA = COMBAT.calcDamage(w, dummyArm, 1.4, 0, { rng: rng });
  assert(waA.damage === 194, "warrior attack vs DEF30 = 194, got " + waA.damage);

  const wf = COMBAT.calcDamage(w, dummyArm, 2.0, 2.8, { rng: rng });
  assert(wf.damage === 494, "magifireblade 320-30 + 224-20 = 494, got " + wf.damage);

  const heal = Math.floor(3.0 * w.matk);
  assert(heal === 240, "warrior heal 300%*80=240, got " + heal);

  const st = COMBAT.calcDamage(a, dummy0, 0.9, 0, { rng: rng });
  assert(st.damage === 108, "assassin stab 90%*120=108, got " + st.damage);

  const pot = (0.2 + 0) * a.matk;
  assert(almost(pot, 24), "assassin stab poison 20% MATK=24");

  const sk = (0.7 + 0) * a.matk;
  assert(almost(sk, 84), "shadowkill poison 70% MATK=84");

  const ar = COMBAT.calcDamage(h, dummy0, 1.0, 0, { rng: rng });
  assert(ar.damage === 150, "arrowshot 100%*150=150, got " + ar.damage);

  const ps = COMBAT.calcDamage(h, dummy0, 2.8, 0, { rng: rng });
  assert(ps.damage === 420, "powershot 280%*150=420, got " + ps.damage);

  const sa = COMBAT.calcDamage(h, dummy0, 1.5, 2.5, { rng: rng });
  assert(sa.damage === 475, "soularrow 225+250=475, got " + sa.damage);

  const saH = Math.floor(475 * 0.35);
  assert(saH === 166, "soularrow lifesteal 35% of 475 = 166, got " + saH);
}

console.log("weaken -20% outgoing");
{
  const atk = dummy({ atk: 100, weakenTurns: 3 });
  const tgt = dummy({ def: 0 });
  const r = COMBAT.calcDamage(atk, tgt, 1.0, 0, { rng: noCritRng() });
  assert(r.damage === 80, "weaken 100 -> 80, got " + r.damage);
}

console.log("hit chance = accuracy - dodge");
{
  const atk = dummy({ accuracy: 120 });
  const tgt = dummy({ dodge: 20, isHero: false });
  assert(COMBAT.hitChance(atk, tgt) === 100, "120-20=100");
}

console.log("caps");
{
  const hero = STATS.computeHeroStats(
    "assassin",
    { str: 0, vit: 0, int: 0, agi: 99, dex: 0, luk: 99 },
    DATA.emptyEquip(),
    1
  );
  assert(hero.dodge <= 80, "hero dodge cap 80, got " + hero.dodge);
  assert(hero.crit <= 100, "hero crit cap 100, got " + hero.crit);
}

console.log("stat point cost curve");
{
  assert(STATS.costToRaise(0) === 2, "0→1 costs 2");
  assert(STATS.costToRaise(9) === 2, "9→10 costs 2");
  assert(STATS.costToRaise(10) === 3, "10→11 costs 3");
  assert(STATS.costToRaise(19) === 3, "19→20 costs 3");
  assert(STATS.costToRaise(20) === 4, "20→21 costs 4");
  assert(STATS.costToRaise(50) === 7, "50→51 costs 7");
  assert(STATS.costToRaise(90) === 11, "90→91 costs 11");
  assert(STATS.costToRaise(98) === 11, "98→99 costs 11");
  let ten = 0;
  for (let i = 0; i < 10; i++) ten += STATS.costToRaise(i);
  assert(ten === 20, "buying 10 ranks from 0 costs 20, got " + ten);
  assert(STATS.costToRaise(10) === 3, "11th rank costs 3 more");
  const sess = STATS.createAllocSession(DATA.emptyAllocated(), 400);
  for (let i = 0; i < 10; i++) STATS.allocAdd(sess, "str", 1);
  assert(sess.session.str === 10, "session ranks = 10");
  assert(STATS.sessionRemaining(sess) === 380, "400-20=380 remaining, got " + STATS.sessionRemaining(sess));
  STATS.allocAdd(sess, "str", 1);
  assert(sess.session.str === 11, "11th rank bought");
  assert(STATS.sessionRemaining(sess) === 377, "380-3=377 remaining, got " + STATS.sessionRemaining(sess));
  STATS.allocAdd(sess, "str", -1);
  assert(sess.session.str === 10 && STATS.sessionRemaining(sess) === 380, "refund 11th rank restores 3 points");
  STATS.allocMin(sess, "str");
  assert(sess.session.str === 0 && STATS.sessionRemaining(sess) === 400, "allocMin refunds all rank costs");
}

console.log("boss 6/7 + bonus points");
{
  assert(DATA.BOSSES.length === 7, "7 bosses, got " + DATA.BOSSES.length);
  assert(DATA.BONUS_STAT_POINTS_BY_BOSS.join(",") === "60,80,100,120,140,160,180", "bonus array");
  assert(DATA.bonusStatPointsFor(5) === 160, "boss 6 bonus 160");
  assert(DATA.bonusStatPointsFor(6) === 180, "boss 7 bonus 180");
  assert(DATA.BOSSES[5].id === "angel" && DATA.BOSSES[5].hp === 32000, "angel hp");
  assert(DATA.BOSSES[6].id === "dragon" && DATA.BOSSES[6].hp === 45000, "dragon hp");
  const lv8 = STATS.levelBonuses(8);
  assert(lv8.hp === 700 && lv8.mp === 210 && lv8.atk === 35 && lv8.def === 14, "level 8 = 7 stacks");
}

console.log("skill unlock / cost helpers");
{
  const roots = DATA.defaultSkillRanks("warrior");
  assert(roots.attack === 1 && roots.guard === 1 && roots.magifireblade === 0, "free root rank 1");
  assert(DATA.skillUnlocked("attack", roots, "warrior"), "root unlocked");
  assert(!DATA.skillUnlocked("magifireblade", { attack: 1, guard: 1 }, "warrior"), "magifireblade locked at attack 1");
  assert(DATA.skillUnlocked("magifireblade", { attack: 2, guard: 1 }, "warrior"), "magifireblade unlocked at attack 2");
  assert(!DATA.skillUnlocked("blade_storm", { attack: 3, magifireblade: 1 }, "warrior"), "blade_storm needs magifireblade 2");
  assert(DATA.skillUnlocked("blade_storm", { attack: 3, magifireblade: 2 }, "warrior"), "blade_storm unlocked");
  const sess = DATA.createSkillSession(DATA.defaultSkillRanks("warrior"), 4, "warrior");
  assert(DATA.skillSessionRemaining(sess) === 4, "start 4 unspent");
  assert(DATA.skillAdd(sess, "attack"), "buy attack rank 2 costs 1");
  assert(DATA.skillSessionRank(sess, "attack") === 2 && DATA.skillSessionRemaining(sess) === 3, "spent 1");
  assert(DATA.skillAdd(sess, "magifireblade"), "unlock magifireblade after attack 2");
  assert(!DATA.skillAdd(sess, "blade_storm"), "blade_storm still locked");
  assert(DATA.skillSub(sess, "magifireblade"), "refund session rank");
  assert(DATA.skillSessionRank(sess, "magifireblade") === 0 && DATA.skillSessionRemaining(sess) === 3, "refund restored point");
  assert(!DATA.skillSub(sess, "guard"), "cannot refund locked free root");
}

console.log("rank scaling 1.15");
{
  assert(almost(COMBAT.rankCoeff(1), 1), "rank 1 coeff 1.00");
  assert(almost(COMBAT.rankCoeff(2), 1.15), "rank 2 coeff 1.15");
  assert(almost(COMBAT.rankCoeff(3), 1.3), "rank 3 coeff 1.30");
  assert(almost(COMBAT.rankCoeff(5), 1.6), "rank 5 coeff 1.60");
  const w = COMBAT.createUnit(STATS.computeHeroStats("warrior", DATA.emptyAllocated(), DATA.emptyEquip(), 1), "left");
  w.skillRanks = { attack: 2 };
  const sc = COMBAT.atkScale(w, "attack", 1.4, 0);
  assert(almost(sc.atk, 1.61), "attack rank 2 ATK% 1.4*1.15=1.61, got " + sc.atk);
  const dummy0 = dummy({ def: 0, mdef: 0, dodge: 0 });
  const r = COMBAT.calcDamage(w, dummy0, sc.atk, 0, { rng: noCritRng() });
  assert(r.damage === 257, "rank2 slash 1.61*160=257, got " + r.damage);
  assert(COMBAT.rankMp(40, 1) === 40, "rank 1 MP unchanged");
  assert(COMBAT.rankMp(40, 2) === 38, "rank 2 MP -5% floor");
  assert(COMBAT.rankMp(70, 5) === 56, "rank 5 MP 70*0.80=56");
  assert(COMBAT.rankCd(4, 3) === 4, "CD unchanged before rank 4");
  assert(COMBAT.rankCd(4, 4) === 3, "CD -1 at rank 4");
  assert(COMBAT.rankCd(0, 5) === 0, "CD min 0");
  const prev = COMBAT.skillPreview("attack", 2);
  assert(prev.text.indexOf("161%") >= 0, "preview shows 161% at rank 2, got " + prev.text);
  assert(COMBAT.effectBonus({ skillRanks: { guard: 2 } }, "guard") === 4, "utility +4% per extra rank");
}

console.log("pve first-clear vs farm rewards");
{
  const save = PVE.createSave("warrior", DATA.emptyAllocated());
  const r1 = PVE.applyWinRewards(save, "monster");
  assert(r1.first && r1.bonusPoints === 60 && save.level === 2, "first clear level+bonus");
  assert(save.skillPoints === 6 && save.zeno === 1500 && save.clearedBosses.monster, "first clear SP/zeno");
  const r2 = PVE.applyWinRewards(save, "monster");
  assert(!r2.first && r2.bonusPoints === 0 && save.level === 2 && save.skillPoints === 6, "farm no extras");
  assert(save.zeno === 2000, "farm +500 zeno only, got " + save.zeno);
  DATA.BOSSES.forEach(function (b) { save.clearedBosses[b.id] = true; });
  assert(PVE.allBossesCleared(save), "all 7 unique clears");
}

console.log("high-tier shop items");
{
  const ids = ["helm_abyss","eyes_judge","mouth_whisper","armor_ruin","weapon_void","shield_eclipse","cloak_night","boots_gale","acc_triad"];
  ids.forEach(function (id) {
    const it = DATA.ITEMS[id];
    assert(it && it.tier === "high" && it.price >= 800 && it.price <= 1500, id + " high-tier price");
  });
  assert(DATA.ITEMS.weapon_void.price === 1500 && DATA.ITEMS.armor_ruin.price === 1400, "top prices");
  const lastHelm = DATA.ITEMS_BY_TYPE.helm[DATA.ITEMS_BY_TYPE.helm.length - 1];
  assert(lastHelm.id === "helm_abyss", "high-tier last in helm list");
}

console.log("world map connectivity");
{
  assert(MAP.VIEW === 23, "camera 23");
  assert(MAP.ZONES.bosses.grid.cols === 100 && MAP.ZONES.bosses.grid.rows === 100, "boss world 100x100");
  assert(MAP.bossList.length === 7, "7 boss markers");
  assert(MAP.isWalkable(MAP.SPAWN.x, MAP.SPAWN.y), "spawn walkable");
  MAP.bossList.forEach(function (b) {
    assert(MAP.isWalkable(b.x, b.y), b.id + " on walkable tile");
    const path = MAP.path(MAP.SPAWN, { x: b.x, y: b.y });
    assert(path.length > 0, b.id + " reachable from spawn");
  });
}

console.log("blade_storm two hits / rain three hits");
{
  function hitOnly() {
    const rng = COMBAT.createRng(1);
    rng.chance = function (percent) {
      return percent >= 100;
    };
    return rng;
  }
  const wd = STATS.computeHeroStats("warrior", DATA.emptyAllocated(), DATA.emptyEquip(), 1);
  wd.skillRanks = { attack: 3, magifireblade: 2, blade_storm: 1, guard: 1 };
  wd.skills = ["blade_storm"];
  const hero = COMBAT.createUnit(wd, "left");
  const bd = STATS.computeBossStats(DATA.BOSSES[0]);
  bd.def = 0;
  bd.softDef = 0;
  bd.mdef = 0;
  bd.dodge = 0;
  const boss = COMBAT.createUnit(bd, "right");
  boss.def = 0;
  boss.softDef = 0;
  boss.dodge = 0;
  const st = COMBAT.createState(hero, boss, { seed: 1 });
  st.rng = hitOnly();
  hero.mp = 200;
  COMBAT.heroSkill(st, hero, "blade_storm");
  const dealt = boss.maxHp - boss.hp;
  assert(dealt === 576, "blade_storm 180%*160 x2 = 576, got " + dealt);

  const hd = STATS.computeHeroStats("hunter", DATA.emptyAllocated(), DATA.emptyEquip(), 1);
  hd.skillRanks = { arrowshot: 3, powershot: 2, rain: 1, focus: 1 };
  hd.skills = ["rain"];
  const hunter = COMBAT.createUnit(hd, "left");
  const boss2 = COMBAT.createUnit(bd, "right");
  boss2.def = 0;
  boss2.softDef = 0;
  boss2.dodge = 0;
  const st2 = COMBAT.createState(hunter, boss2, { seed: 1 });
  st2.rng = hitOnly();
  hunter.mp = 200;
  COMBAT.heroSkill(st2, hunter, "rain");
  const dealt2 = boss2.maxHp - boss2.hp;
  assert(dealt2 === 405, "rain 90%*150 x3 = 405, got " + dealt2);
}

console.log("prontera + field connectivity");
{
  MAP.setZone("city");
  const cg = MAP.ZONES.city.grid;
  const spawn = MAP.ZONES.city.spawn;
  assert(cg.cols >= 64 && cg.rows >= 64, "city at least 64x64, got " + cg.cols + "x" + cg.rows);
  assert(MAP.isWalkable(spawn.x, spawn.y), "prontera spawn walkable at " + spawn.x + "," + spawn.y);
  function findCell(ch) {
    const keys = Object.keys(cg.cells);
    for (let i = 0; i < keys.length; i++) {
      if (cg.cells[keys[i]] === ch) {
        const p = keys[i].split(",");
        return { x: Number(p[0]), y: Number(p[1]) };
      }
    }
    return null;
  }
  let fountainN = 0;
  let houseN = 0;
  let wallN = 0;
  Object.keys(cg.cells).forEach(function (k) {
    const ch = cg.cells[k];
    if (ch === "F" || ch === "f") fountainN += 1;
    if (ch === "H" || ch === "h" || ch === "R" || ch === "r") houseN += 1;
    if (ch === "#") wallN += 1;
  });
  assert(fountainN >= 8, "multi-tile fountain, got " + fountainN);
  assert(houseN >= 80, "townhouse blocks present, got " + houseN);
  assert(wallN >= 100, "city walls present, got " + wallN);
  assert(spawn.x === 40 && spawn.y === 51, "spawn at 40,51, got " + spawn.x + "," + spawn.y);
  const expectNpc = { W: [24, 40], P: [56, 40], S: [38, 49], K: [40, 16], G: [78, 40] };
  [["weapon", "W"], ["potion", "P"], ["kafra", "S"], ["castle", "K"], ["gate", "G"]].forEach(function (row) {
    const at = findCell(row[1]);
    assert(at, row[0] + " exists in Prontera");
    if (!at) return;
    const exp = expectNpc[row[1]];
    assert(at.x === exp[0] && at.y === exp[1], row[0] + " at " + exp[0] + "," + exp[1] + " got " + at.x + "," + at.y);
    assert(MAP.isWalkable(at.x, at.y), row[0] + " walkable");
    const path = MAP.path(spawn, { x: at.x, y: at.y });
    assert(path.length > 0, row[0] + " reachable from spawn (" + at.x + "," + at.y + ")");
  });
  let fountainCore = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (cg.cells[(40 + dx) + "," + (40 + dy)] === "F") fountainCore += 1;
    }
  }
  assert(fountainCore === 9, "fountain 3x3 core at 40,40, got " + fountainCore);
  let churchN = 0;
  let churchRoof = 0;
  for (let y = 8; y <= 20; y++) {
    for (let x = 52; x <= 62; x++) {
      const ch = cg.cells[x + "," + y];
      if (ch === "C") churchN += 1;
      if (ch === "N") churchRoof += 1;
    }
  }
  assert(churchN > 0 && churchRoof > 0, "church C/N in NE bbox, C=" + churchN + " N=" + churchRoof);
  let keepN = 0;
  for (let y = 4; y <= 16; y++) {
    for (let x = 34; x <= 46; x++) {
      if (cg.cells[x + "," + y] === "D") keepN += 1;
    }
  }
  assert(keepN > 0, "castle D in north keep bbox, got " + keepN);
  MAP.setZone("field");
  const fz = MAP.ZONES.field;
  assert(fz.grid.cols === 100 && fz.grid.rows === 100, "field 100x100");
  assert(MAP.isWalkable(fz.spawn.x, fz.spawn.y), "field spawn walkable");
  const gate = fz.grid.gate;
  assert(gate && MAP.isWalkable(gate.x, gate.y), "field gate walkable");
  assert(MAP.path(fz.spawn, { x: gate.x, y: gate.y }).length > 0, "city gate reachable");
  const mobs = MAP.listFieldSpawns();
  assert(mobs.length >= 20, "many field spawns, got " + mobs.length);
  const kinds = {};
  mobs.forEach(function (m) { kinds[m.monsterId] = m; });
  ["poring", "fabre", "lunatic", "willow", "condor"].forEach(function (id) {
    assert(kinds[id], id + " present on field");
    assert(MAP.isWalkable(kinds[id].x, kinds[id].y), id + " walkable");
    const path = MAP.path(fz.spawn, { x: kinds[id].x, y: kinds[id].y });
    assert(path.length > 0, id + " reachable from spawn");
  });
  MAP.setZone("bosses");
  assert(MAP.isWalkable(MAP.SPAWN.x, MAP.SPAWN.y), "reset to boss spawn");
}

console.log("EXP curves + level-up bonuses");
{
  assert(DATA.baseExpToNext(1) === 80, "baseExpToNext(1)=80, got " + DATA.baseExpToNext(1));
  assert(DATA.jobExpToNext(1) === 50, "jobExpToNext(1)=50, got " + DATA.jobExpToNext(1));
  assert(DATA.baseExpToNext(2) === Math.floor(80 * Math.pow(2, 1.65)), "base curve lv2");
  assert(DATA.jobExpToNext(2) === Math.floor(50 * Math.pow(2, 1.55)), "job curve lv2");
  assert(PVE.baseExpToNext(5) === DATA.baseExpToNext(5), "PVE.baseExpToNext aliases DATA");
  const save = PVE.createSave("warrior", DATA.emptyAllocated());
  const hp1 = PVE.derived(save).maxHp;
  const mp1 = PVE.derived(save).maxMp;
  const atk1 = PVE.derived(save).atk;
  const r = PVE.gainExp(save, PVE.baseExpToNext(1), PVE.jobExpToNext(1));
  assert(save.baseLevel === 2 && save.level === 2, "base level 1→2");
  assert(save.jobLevel === 2, "job level 1→2");
  assert(r.baseUps.length === 1 && r.jobUps.length === 1, "one of each level-up");
  assert(save.unspentStatPoints === 10, "base level grants +10 stat points");
  assert(save.skillPoints === DATA.SKILL_POINT_START + 1, "job level grants +1 skill point");
  const d2 = PVE.derived(save);
  assert(d2.maxHp === hp1 + 100, "level bonus +100 HP, got " + d2.maxHp + " vs " + (hp1 + 100));
  assert(d2.maxMp === mp1 + 30, "level bonus +30 MP");
  assert(d2.atk === atk1 + 5, "level bonus +5 ATK");
}

console.log("potion heal amounts + stacks");
{
  assert(PVE.potionHeal("red").hp === 200 && PVE.potionHeal("red").mp === 0, "red 200 HP");
  assert(PVE.potionHeal("orange").hp === 600, "orange 600 HP");
  assert(PVE.potionHeal("white").hp === 1200, "white 1200 HP");
  assert(PVE.potionHeal("blue").mp === 80 && PVE.potionHeal("blue").hp === 0, "blue 80 MP");
  const save = PVE.createSave("warrior", DATA.emptyAllocated());
  PVE.syncVitals(save);
  save.hp = 100;
  save.mp = 10;
  save.potions = { red: 1, orange: 0, white: 0, blue: 1 };
  const r = PVE.usePotion(save, "red");
  assert(r.ok && save.hp === 300, "use red 100+200=300, got " + save.hp);
  assert(save.potions.red === 0, "red stack consumed");
  const b = PVE.usePotion(save, "blue");
  assert(b.ok && save.mp === 90, "use blue 10+80=90, got " + save.mp);
  const fail = PVE.usePotion(save, "red");
  assert(!fail.ok, "cannot drink empty stack");
  const buy = PVE.buyPotion(save, "orange");
  assert(buy.ok && save.potions.orange === 1 && save.zeno === DATA.START_ZENO - 80, "buy orange");
}

console.log("field monsters + field rewards");
{
  assert(DATA.MONSTERS.length >= 3, "at least 3 field monsters");
  const poring = DATA.findMonster("poring");
  assert(poring && poring.hp === 800 && poring.baseExp === 45 && poring.jobExp === 30, "poring stats");
  const fabre = DATA.findMonster("fabre");
  assert(fabre && fabre.hp === 1000 && fabre.baseExp === 60, "fabre stats");
  const luna = DATA.findMonster("lunatic");
  assert(luna && luna.hp === 1200 && luna.aspeed === 32, "lunatic faster aspeed");
  const save = PVE.createSave("warrior", DATA.emptyAllocated());
  const rng = { next: function () { return 0; }, chance: function () { return false; } };
  const r = PVE.applyFieldRewards(save, "poring", rng);
  assert(r.baseExp === 45 && r.jobExp === 30 && r.zeno === 20, "poring min zeno + exp");
  assert(save.baseExp === 45 && save.jobExp === 30, "exp stored");
  assert(save.zeno === DATA.START_ZENO + 20, "zeno added");
  const mob = STATS.computeMonsterStats(poring);
  assert(mob.isMonster && mob.isBoss && mob.maxHp === 800, "monster unit pipeline");
}

console.log("real-time ASPD / CD conversion");
{
  assert(COMBAT.attackIntervalMs(29) === Math.max(380, Math.min(2000, Math.round(1600 - 29 * 22))), "warrior 29 A.speed interval");
  assert(COMBAT.attackIntervalMs(22) === Math.round(1600 - 22 * 22), "poring 22 A.speed = 1116, got " + COMBAT.attackIntervalMs(22));
  assert(COMBAT.attackIntervalMs(80) === 380, "very high A.speed clamps to 380");
  assert(COMBAT.attackIntervalMs(1) === 1578 || COMBAT.attackIntervalMs(1) === Math.max(380, Math.min(2000, Math.round(1600 - 22))), "low A.speed");
  assert(COMBAT.cdMs(0) === 300, "CD 0 → 300ms global");
  assert(COMBAT.cdMs(4) === 6400, "CD 4 → 4*1600=6400ms");
  assert(COMBAT.cdMs(1) === 1600, "CD 1 → 1600ms");
}

console.log("hard / soft DEF from refine");
{
  const refine = {
    helm_iron: 10,
    armor_chain: 10,
    boots_leather: 10,
    cloak_travel: 10,
    shield_wood: 10,
  };
  const equip = DATA.emptyEquip();
  equip.helm = "helm_iron";
  equip.armor = "armor_chain";
  equip.boots = "boots_leather";
  equip.cloak = "cloak_travel";
  equip.shield = "shield_wood";
  const b = STATS.refineBonuses(equip, refine);
  assert(almost(b.hardDef, 35) && almost(b.hardMdef, 35), "5 wearables +10 → hard 35, got " + b.hardDef + "/" + b.hardMdef);
  const st = STATS.computeHeroStats("warrior", DATA.emptyAllocated(), equip, 1, refine);
  assert(almost(st.hardDef, 35) && almost(st.hardMdef, 35), "computeHeroStats hard 35");
  assert(st.softDef === STATS.playerSoftDef(0, 0, 1), "lv1 empty soft = player formula, got " + st.softDef);
  assert(st.aspd != null && st.finalAspd != null, "hero exposes aspd score + finalAspd");
}
{
  const equip = DATA.emptyEquip();
  equip.helm = "helm_leather";
  const b = STATS.refineBonuses(equip, { helm_leather: 1 });
  assert(almost(b.hardDef, 0.7) && almost(b.hardMdef, 0.7), "one piece +1 → 0.7, got " + b.hardDef);
}

console.log("hard DEF after soft subtract");
{
  const atk = dummy({ atk: 100, matk: 0 });
  const tgt = dummy({ def: 30, softDef: 30, hardDef: 10, mdef: 0, hardMdef: 0 });
  const r = COMBAT.calcDamage(atk, tgt, 1.0, 0, { rng: noCritRng() });
  const hf = STATS.hardFactor(10);
  const after = Math.floor(100 * hf);
  const exp = after - 30;
  assert(almost(r.atkPart, exp), "phys HardFactor then Soft: " + after + "-30=" + exp + ", got " + r.atkPart);
  assert(r.damage === exp, "phys net " + exp + ", got " + r.damage);
}
{
  const atk = dummy({ atk: 0, matk: 100 });
  const tgt = dummy({ def: 0, mdef: 30, softMdef: 30, hardMdef: 10 });
  const r = COMBAT.calcDamage(atk, tgt, 0, 1.0, { rng: noCritRng() });
  assert(almost(r.matkPart, 63), "magic path unchanged (100-30)*0.9=63, got " + r.matkPart);
  assert(r.damage === 63, "magic net 63, got " + r.damage);
}

console.log("poison ignores hard and soft");
{
  const atk = dummy({ matk: 200 });
  const tgt = dummy({ def: 999, mdef: 999, softDef: 999, softMdef: 999, hardDef: 50, hardMdef: 50 });
  const r = COMBAT.calcDamage(atk, tgt, 0, 0.3, { ignoreArmor: true, isPoison: true, canCrit: false });
  assert(r.damage === 60, "poison ignores hard/soft, got " + r.damage);
}

console.log("min 1 still holds with hard def");
{
  const atk = dummy({ atk: 10, matk: 0 });
  const tgt = dummy({ def: 999, hardDef: 90 });
  const r = COMBAT.calcDamage(atk, tgt, 1.0, 0, { rng: noCritRng() });
  assert(r.damage === 1, "min 1 still holds with hard def, got " + r.damage);
}

console.log("refine chance + zeno cost helpers");
{
  assert(STATS.refineChanceTo(1) === 100 && STATS.refineChanceTo(4) === 100, "+1..+4 100%");
  assert(STATS.refineChanceTo(5) === 70 && STATS.refineChanceTo(6) === 70, "+5 +6 70%");
  assert(STATS.refineChanceTo(7) === 40 && STATS.refineChanceTo(10) === 40, "+7..+10 40%");
  assert(STATS.refineCostTo(1) === 100 && STATS.refineCostTo(2) === 200, "+1 100 +2 200");
  assert(STATS.refineCostTo(5) === 600 && STATS.refineCostTo(10) === 3000, "+5 600 +10 3000");
  assert(STATS.refineCostTo(7) === 1200 && STATS.refineCostTo(9) === 2200, "+7 1200 +9 2200");
}

console.log("weapon refine +8 ATK/MATK (no Hard DEF)");
{
  const equip = DATA.emptyEquip();
  equip.weapon = "weapon_short";
  const st0 = STATS.computeHeroStats("warrior", DATA.emptyAllocated(), equip, 1, {});
  const st5 = STATS.computeHeroStats("warrior", DATA.emptyAllocated(), equip, 1, { weapon_short: 5 });
  assert(almost(st5.atk - st0.atk, 40), "weapon +5 → +40 ATK, got " + (st5.atk - st0.atk));
  assert(almost(st5.matk - st0.matk, 40), "weapon +5 → +40 MATK");
  assert(almost(st5.hardDef, 0) && almost(st5.hardMdef, 0), "weapon refine does not add Hard DEF");
}

console.log("refine persist + safe fail");
{
  const save = PVE.createSave("warrior", DATA.emptyAllocated());
  save.owned.helm_leather = true;
  save.zeno = 10000;
  const failRng = { chance: function () { return false; } };
  const winRng = { chance: function () { return true; } };
  const r1 = PVE.attemptRefine(save, "helm_leather", winRng);
  assert(r1.ok && r1.success && save.refine.helm_leather === 1, "success +1");
  save.equip.helm = "helm_leather";
  PVE.equipItem(save, "helm", null);
  assert(save.refine.helm_leather === 1, "refine stays when unequipped");
  save.refine.helm_leather = 4;
  const z = save.zeno;
  const fail = PVE.attemptRefine(save, "helm_leather", failRng);
  assert(fail.ok && !fail.success && save.refine.helm_leather === 4, "fail stays at +4");
  assert(save.zeno === z - 600, "fail still spends 600 for +5, got " + save.zeno);
  const eyes = PVE.attemptRefine(save, "eyes_hunter", winRng);
  assert(!eyes.ok, "eyes not refinable");
}

console.log("boss hardDef is 0");
{
  const b = STATS.computeBossStats(DATA.BOSSES[0]);
  assert(b.hardDef === 0 && b.hardMdef === 0 && b.softDef === b.def, "boss soft=def hard=0");
  const m = STATS.computeMonsterStats(DATA.findMonster("poring"));
  assert(m.hardDef === 0 && m.softDef === m.def, "monster hard=0");
}

console.log("lv10-20 field pack + wolf namespace");
{
  const pack = [
    { id: "wolf", hp: 3400, skills: ["mob_wolf_bite", "mob_wolf_howl"], baseExp: 240, zenoMin: 90 },
    { id: "poporing", hp: 3600, skills: ["mob_pop_hop", "mob_pop_acid"], baseExp: 265, zenoMin: 95 },
    { id: "chonchon", hp: 2800, skills: ["mob_chon_buzz", "mob_chon_dive"], baseExp: 280, zenoMin: 100 },
    { id: "roda_frog", hp: 4800, skills: ["mob_frog_tongue", "mob_frog_slam"], baseExp: 310, zenoMin: 110 },
    { id: "spore", hp: 3900, skills: ["mob_spore_puff", "mob_spore_cloud"], baseExp: 335, zenoMin: 115 },
    { id: "rocker", hp: 4100, skills: ["mob_rock_strum", "mob_rock_screech"], baseExp: 365, zenoMin: 125 },
    { id: "steel_chonchon", hp: 3600, skills: ["mob_steel_buzz", "mob_steel_ram"], baseExp: 395, zenoMin: 135 },
    { id: "savage_babe", hp: 5200, skills: ["mob_babe_gore", "mob_babe_rush"], baseExp: 430, zenoMin: 145 },
    { id: "elder_willow", hp: 5600, skills: ["mob_elder_hit", "mob_elder_flame"], baseExp: 470, zenoMin: 155 },
    { id: "skeleton", hp: 6100, skills: ["mob_skel_slash", "mob_skel_bone"], baseExp: 530, zenoMin: 175 },
  ];
  pack.forEach(function (spec) {
    const m = DATA.findMonster(spec.id);
    assert(m && m.id === spec.id && m.hp === spec.hp, spec.id + " hp " + spec.hp + " got " + (m && m.hp));
    assert(m.baseExp === spec.baseExp && m.zenoMin === spec.zenoMin, spec.id + " exp/zenoMin");
    assert(m.skills && m.skills[0] === spec.skills[0] && m.skills[1] === spec.skills[1], spec.id + " skills");
  });

  const skillSpec = {
    mob_wolf_bite: [1.15, 0],
    mob_wolf_howl: [1.8, 0],
    mob_pop_hop: [1.0, 0],
    mob_pop_acid: [0.6, 1.1],
    mob_chon_buzz: [1.05, 0],
    mob_chon_dive: [1.7, 0],
    mob_frog_tongue: [1.1, 0],
    mob_frog_slam: [1.9, 0],
    mob_spore_puff: [0.4, 0.9],
    mob_spore_cloud: [0.3, 1.4],
    mob_rock_strum: [1.1, 0],
    mob_rock_screech: [1.75, 0],
    mob_steel_buzz: [1.2, 0],
    mob_steel_ram: [1.85, 0],
    mob_babe_gore: [1.2, 0],
    mob_babe_rush: [2.0, 0],
    mob_elder_hit: [0.8, 0.6],
    mob_elder_flame: [0.4, 1.5],
    mob_skel_slash: [1.2, 0],
    mob_skel_bone: [1.8, 0],
  };
  Object.keys(skillSpec).forEach(function (id) {
    const def = DATA.BOSS_SKILLS[id];
    const exp = skillSpec[id];
    assert(def && almost(def.atkRatio, exp[0]) && almost(def.matkRatio, exp[1]), id + " ratios " + exp[0] + "/" + exp[1]);
  });

  const fieldWolf = DATA.findMonster("wolf");
  const bossWolf = PVE.findBoss("wolf");
  assert(fieldWolf && fieldWolf.hp === 3400, "findMonster(wolf).hp === 3400, got " + (fieldWolf && fieldWolf.hp));
  assert(bossWolf && bossWolf.id === "wolf" && bossWolf.hp !== 3400, "findBoss(wolf) is the boss, hp " + (bossWolf && bossWolf.hp));
  assert(bossWolf.hp >= 6000, "boss wolf HP is the large one, got " + bossWolf.hp);

  MAP.setZone("field");
  const fz = MAP.ZONES.field;
  const spawn = fz.spawn;
  const mobs = MAP.listFieldSpawns();
  const starters = ["poring", "fabre", "lunatic", "willow", "condor"];
  const midIds = ["wolf", "poporing", "chonchon", "roda_frog"];
  const farIds = ["spore", "rocker", "steel_chonchon"];
  const deepIds = ["savage_babe", "elder_willow", "skeleton"];
  const wanted = starters.concat(midIds, farIds, deepIds);
  const first = {};
  mobs.forEach(function (m) {
    if (!first[m.monsterId]) first[m.monsterId] = m;
  });
  wanted.forEach(function (id) {
    const m = first[id];
    assert(m, id + " present on field");
    if (!m) return;
    assert(MAP.isWalkable(m.x, m.y), id + " walkable at " + m.x + "," + m.y);
    const path = MAP.path(spawn, { x: m.x, y: m.y });
    assert(path.length > 0, id + " reachable from spawn");
  });

  function bandOf(id) {
    if (starters.indexOf(id) >= 0) return "near";
    if (midIds.indexOf(id) >= 0) return "mid";
    if (farIds.indexOf(id) >= 0) return "far";
    if (deepIds.indexOf(id) >= 0) return "deep";
    return "";
  }
  mobs.forEach(function (m) {
    const d = Math.abs(m.x - spawn.x) + Math.abs(m.y - spawn.y);
    const band = bandOf(m.monsterId);
    if (band === "near") assert(d < 30, m.monsterId + " starter dist < 30, got " + d);
    else if (band === "mid") assert(d < 52 && d >= 30, m.monsterId + " mid 30<=d<52, got " + d);
    else if (band === "far") assert(d < 74 && d >= 52, m.monsterId + " far 52<=d<74, got " + d);
    else if (band === "deep") assert(d >= 74, m.monsterId + " deep d>=74, got " + d);
  });

  const save = PVE.createSave("warrior", DATA.emptyAllocated());
  const rng = { next: function () { return 0; }, chance: function () { return false; } };
  const r = PVE.applyFieldRewards(save, "wolf", rng);
  assert(r.baseExp === 240 && r.jobExp === 160, "applyFieldRewards(wolf) field exp 240/160, got " + r.baseExp + "/" + r.jobExp);
  assert(r.zeno === 90, "field wolf min zeno 90, got " + r.zeno);

  const skel = PVE.buildMonsterUnit("skeleton");
  assert(skel.sprite === "assets/mobs/skeleton.png", "skeleton sprite, got " + skel.sprite);
  assert(skel.skills && skel.skills.length === 2, "skeleton skills present");
  skel.skills.forEach(function (sid) {
    assert(DATA.BOSS_SKILLS[sid], "skeleton skill " + sid + " resolves");
  });
  MAP.setZone("bosses");
}


console.log("charName + first-run name lock");
{
  const save = PVE.createSave("warrior", DATA.emptyAllocated());
  assert(typeof save.charName === "string", "createSave.charName is a string, got " + typeof save.charName);
  assert(save.charName === "", "createSave.charName starts empty");

  const named = PVE.createSave("hunter", DATA.emptyAllocated(), "เหยี่ยวแดง");
  assert(named.charName === "เหยี่ยวแดง", "createSave persists passed charName");

  const blank = { heroId: "assassin", allocated: DATA.emptyAllocated() };
  PVE.ensureProgress(blank);
  assert(blank.charName === DATA.HEROES.assassin.name, "ensureProgress fills charName from hero, got " + blank.charName);

  const keep = { heroId: "warrior", allocated: DATA.emptyAllocated(), charName: "ผู้กล้า" };
  PVE.ensureProgress(keep);
  assert(keep.charName === "ผู้กล้า", "ensureProgress keeps existing charName");

  ["warrior", "assassin", "hunter"].forEach(function (id) {
    const h = DATA.HEROES[id];
    assert(h && typeof h.name === "string" && h.name.length > 0, id + " hero name exists: " + (h && h.name));
  });

  const v = PVE.validateCharName;
  assert(typeof v === "function", "PVE.validateCharName exists");
  assert(v("").ok === false, "empty name rejected");
  assert(v("   ").ok === false, "whitespace-only name rejected");
  assert(v("A").ok === true && v("A").name === "A", "1-char name accepted");
  assert(v("  นักรบ  ").ok === true && v("  นักรบ  ").name === "นักรบ", "trimmed name accepted");
  const twentyfour = "123456789012345678901234";
  assert(v(twentyfour).ok === true && v(twentyfour).name.length === 24, "24-char name accepted");
  assert(v(twentyfour + "x").ok === false, ">24 name rejected");
  assert(v("นกน้อยในป่าใหญ่").ok === true, "Thai name accepted");
  assert(v(null).ok === false, "null name rejected");
}

console.log("locked ASPD book examples");
{
  function rnd2(n) { return Math.round(n * 100) / 100; }
  const a = STATS.computeAspd({ agi: 1, dex: 1 });
  assert(almost(a.aspd, 156.56, 1e-9), "AGI1 DEX1 aspd 156.56, got " + a.aspd);
  assert(almost(rnd2(a.finalAspd), 1.15, 1e-9), "AGI1 DEX1 final 1.15, got " + rnd2(a.finalAspd));

  const b = STATS.computeAspd({ agi: 99, dex: 50 });
  assert(almost(b.aspd, 179.41, 1e-9), "AGI99 DEX50 aspd 179.41, got " + b.aspd);
  assert(almost(rnd2(b.finalAspd), 2.43, 1e-9), "AGI99 DEX50 final 2.43, got " + rnd2(b.finalAspd));

  const c = STATS.computeAspd({ agi: 99, dex: 50, potionMod: 0.20, skillMod: 0.30 });
  assert(almost(c.aspd, 189.70, 1e-9), "AGI99 + Berserk + Skill30 aspd 189.70, got " + c.aspd);
  assert(almost(rnd2(c.finalAspd), 4.85, 1e-9), "AGI99 + Berserk + Skill30 final 4.85, got " + rnd2(c.finalAspd));

  const cDex1 = STATS.computeAspd({ agi: 99, dex: 1, potionMod: 0.20, skillMod: 0.30 });
  assert(almost(cDex1.aspd, 189.65, 1e-9) || almost(cDex1.aspd, 189.70, 1e-9), "DEX1 variant recorded: " + cDex1.aspd);

  const dEqOnly = STATS.computeAspd({ agi: 99, dex: 50, equipAspdMod: 0.20, equipFixed: 2 });
  const d = STATS.computeAspd({ agi: 99, dex: 50, potionMod: 0.20, skillMod: 0.30, equipAspdMod: 0.20, equipFixed: 2 });
  assert(almost(d.aspd, 192.70, 1e-9), "AGI99 + full set (ber+sk+eq20%+2) aspd 192.70, got " + d.aspd + " (eq-only was " + dEqOnly.aspd + ")");
  assert(almost(rnd2(d.finalAspd), 6.85, 1e-9), "full set final 6.85, got " + rnd2(d.finalAspd));

  const e = STATS.computeAspd({ agi: 102, dex: 50, potionMod: 0.20, skillMod: 0.30, equipAspdMod: 0.20, equipFixed: 2 });
  assert(almost(e.finalAspd, 7, 1e-9), "AGI102 + full set caps at 7, got " + e.finalAspd);

  const solo = STATS.computeAspd({ agi: 99, dex: 99 });
  assert(solo.finalAspd < 7, "AGI alone cannot reach 7, got " + solo.finalAspd);

  const sh = STATS.computeAspd({ agi: 1, dex: 1, hasShield: true });
  assert(sh.aspd < a.aspd, "shield penalty lowers ASPD, " + sh.aspd + " < " + a.aspd);

  const hero = STATS.computeHeroStats("warrior", { str: 0, vit: 0, int: 0, agi: 99, dex: 50, luk: 0 }, DATA.emptyEquip(), 1);
  assert(almost(hero.aspd, 179.41, 1e-9), "computeHeroStats AGI99 DEX50 aspd 179.41, got " + hero.aspd);
  assert(almost(rnd2(hero.aspeed), 2.43, 1e-9), "hero aspeed is Final ASPD 2.43, got " + rnd2(hero.aspeed));
  const unit = COMBAT.createUnit(hero, "left");
  const ms = COMBAT.attackIntervalMs(unit);
  assert(ms === Math.round(1000 / hero.finalAspd), "hero interval 1000/finalAspd, got " + ms);
}

console.log("locked physical DEF book examples");
{
  assert(almost(STATS.hardFactor(200), 0.7), "Hard 200 → factor 0.70, got " + STATS.hardFactor(200));
  assert(almost(STATS.hardFactor(500), 0.5), "Hard 500 → factor 0.50, got " + STATS.hardFactor(500));
  assert(almost(1 - STATS.hardFactor(200), 0.3), "Hard 200 → 30% reduction");
  assert(almost(1 - STATS.hardFactor(500), 0.5), "Hard 500 → 50% reduction");

  assert(STATS.playerSoftDef(99, 20, 99) === 103, "VIT99 AGI20 Lv99 Soft 103, got " + STATS.playerSoftDef(99, 20, 99));
  assert(STATS.playerSoftDef(99, 25, 99) === 104, "VIT99 AGI25 Lv99 Soft 104 (formula as written), got " + STATS.playerSoftDef(99, 25, 99));
  const st99 = STATS.computeHeroStats("warrior", { str: 0, vit: 99, int: 0, agi: 20, dex: 0, luk: 0 }, DATA.emptyEquip(), 99);
  assert(st99.softDef === 103, "computeHeroStats VIT99 AGI20 Lv99 softDef 103, got " + st99.softDef);

  const atk = dummy({ atk: 500, matk: 0, critMult: 0 });
  const tgt = dummy({ softDef: 103, hardDef: 200, def: 103, mdef: 0 });
  const n = COMBAT.calcDamage(atk, tgt, 1.0, 0, { rng: noCritRng(), canCrit: false });
  assert(n.damage === 247, "raw 500 Hard200 Soft103 normal 247, got " + n.damage);
  assert(n.atkPart === 247, "normal atkPart 247, got " + n.atkPart);

  const c = COMBAT.calcDamage(atk, tgt, 1.0, 0, { forceCrit: true, canCrit: true, rng: noCritRng() });
  assert(c.crit === true, "forceCrit sets crit");
  assert(c.damage === 350, "crit bypasses Soft → 350, got " + c.damage);
  assert(c.atkPart === 350, "crit atkPart is AfterHard 350, got " + c.atkPart);

  const tiny = COMBAT.calcDamage(dummy({ atk: 1 }), dummy({ softDef: 999, hardDef: 500 }), 1.0, 0, { rng: noCritRng() });
  assert(tiny.damage === 1, "min damage 1, got " + tiny.damage);

  const bypass = COMBAT.calcDamage(atk, tgt, 1.0, 0, { rng: noCritRng(), canCrit: false, bypass: 1 });
  assert(bypass.damage === 397, "bypass 100% skips Hard, Soft still subtracts 500-103=397, got " + bypass.damage);
}

console.log("crit is physical only / magic path unchanged");
{
  const mage = dummy({ atk: 0, matk: 200, crit: 100, critMult: 50 });
  const tgt = dummy({ mdef: 20, softMdef: 20, hardMdef: 10, def: 0, softDef: 0 });
  const r = COMBAT.calcDamage(mage, tgt, 0, 1.0, { forceCrit: true, canCrit: true, rng: noCritRng() });
  assert(r.crit === false, "magic cannot crit, got crit=" + r.crit);
  assert(almost(r.matkPart, 162), "magic (200-20)*0.9=162, got " + r.matkPart);
  assert(r.damage === 162, "magic net 162 (no crit mult), got " + r.damage);

  const hybrid = dummy({ atk: 100, matk: 80, critMult: 0 });
  const arm = dummy({ softDef: 10, hardDef: 0, mdef: 20, softMdef: 20, hardMdef: 0 });
  const h = COMBAT.calcDamage(hybrid, arm, 1.0, 1.0, { forceCrit: true, canCrit: true });
  assert(h.crit === true, "hybrid physical can crit");
  assert(h.atkPart === 100, "hybrid crit skips Soft on ATK, atkPart 100, got " + h.atkPart);
  assert(almost(h.matkPart, 60), "hybrid magic still subtracts Soft MDEF, got " + h.matkPart);
  assert(h.damage === 160, "hybrid crit 100+60=160, got " + h.damage);
}

console.log("hunter range 4 / warrior range 1");
{
  const WORLD = ctx.WORLD;
  assert(WORLD && WORLD.HUNTER_RANGE === 4, "HUNTER_RANGE 4, got " + (WORLD && WORLD.HUNTER_RANGE));
  assert(WORLD.WARRIOR_RANGE === 1, "WARRIOR_RANGE 1, got " + WORLD.WARRIOR_RANGE);
  const hunter = { unit: { heroId: "hunter" } };
  const warrior = { unit: { heroId: "warrior" } };
  assert(WORLD.skillRange(hunter, "arrowshot") === 4, "hunter arrowshot range 4");
  assert(WORLD.skillRange(hunter, "powershot") === 4, "hunter powershot range 4");
  assert(WORLD.skillRange(hunter, "soularrow") === 4, "hunter soularrow range 4");
  assert(WORLD.skillRange(warrior, "attack") === 1, "warrior attack range 1");
  assert(WORLD.skillRange(warrior, "magifireblade") === 1, "warrior magifireblade range 1");
  assert(WORLD.skillRange(warrior, "blade_storm") === 1, "warrior blade_storm range 1");
}

console.log("8-dir facing");
{
  const FX = ctx.FX;
  assert(!!FX, "FX loaded");
  assert(FX.facingFromDelta(0, 1) === "s", "south");
  assert(FX.facingFromDelta(0, -1) === "n", "north");
  assert(FX.facingFromDelta(1, 0) === "e", "east");
  assert(FX.facingFromDelta(-1, 0) === "w", "west");
  assert(FX.facingFromDelta(1, 1) === "se", "se");
  assert(FX.facingFromDelta(-1, 1) === "sw", "sw");
  assert(FX.facingFromDelta(1, -1) === "ne", "ne");
  assert(FX.facingFromDelta(-1, -1) === "nw", "nw");
  assert(FX.facingArt("w").base === "e" && FX.facingArt("w").flip, "west flips east");
  assert(FX.facingArt("sw").base === "se" && FX.facingArt("sw").flip, "sw flips se");
  assert(FX.facingArt("nw").base === "n" && FX.facingArt("nw").flip, "nw flips north");
  assert(FX.facingArt("ne").base === "n" && !FX.facingArt("ne").flip, "ne uses north");
  const src = FX.spriteSrc("warrior", { heroId: "warrior", facing: "e" });
  assert(src === "assets/chars/warrior_e.png", "east sprite file, got " + src);
  const srcW = FX.spriteSrc("hunter", { heroId: "hunter", facing: "w" });
  assert(srcW === "assets/chars/hunter_e.png", "west uses east file, got " + srcW);
}

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exit(1);

