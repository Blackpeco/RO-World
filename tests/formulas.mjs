import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const ctx = { console, Math, Date, Object, Array, Number, String, Boolean, Error, setInterval, clearInterval, setTimeout, clearTimeout };
vm.createContext(ctx);
for (const f of ["data.js", "stats.js", "combat.js", "pve.js", "map.js", "world.js", "audio.js", "fx.js"]) {
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
      hit: 175,
      flee: 100,
      perfectDodge: 0,
      fleeSkillBonus: 0,
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
  equip.weapon = "weapon_short"; // Weapon ATK 70, no STR
  const st = STATS.computeHeroStats("warrior", DATA.emptyAllocated(), equip, 1);
  assert(st.totalPts.str === 0, "weapon no longer grants STR");
  assert(st.maxHp === 3000, "warrior no extra HP from weapon, got " + st.maxHp);
  assert(st.atk === 160 + 70, "warrior +70 Weapon ATK => 230, got " + st.atk);
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

console.log("hit chance uses HIT − actual FLEE (legacy accuracy−dodge retired)");
{
  const atk = dummy({ hit: 373, accuracy: 120 });
  const tgt = dummy({ flee: 239, dodge: 20, isHero: false });
  assert(COMBAT.hitChance(atk, tgt) === 100, "HIT 373 − FLEE 239 clamp 100");
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
  assert(roots.bash === 1 && roots.provoke === 1 && roots.magnum_break === 0, "free root rank 1");
  assert(DATA.skillUnlocked("bash", roots, "warrior"), "root unlocked");
  assert(!DATA.skillUnlocked("magnum_break", { bash: 4, provoke: 1 }, "warrior"), "magnum locked until bash 5");
  assert(DATA.skillUnlocked("magnum_break", { bash: 5, provoke: 1 }, "warrior"), "magnum unlocked at bash 5");
  assert(!DATA.skillUnlocked("endure", { provoke: 4 }, "warrior"), "endure locked until provoke 5");
  assert(DATA.skillUnlocked("endure", { provoke: 5 }, "warrior"), "endure unlocked");
  const sess = DATA.createSkillSession(DATA.defaultSkillRanks("warrior"), 4, "warrior");
  assert(DATA.skillSessionRemaining(sess) === 4, "start 4 unspent");
  assert(DATA.skillAdd(sess, "bash"), "buy bash rank 2 costs 1");
  assert(DATA.skillSessionRank(sess, "bash") === 2 && DATA.skillSessionRemaining(sess) === 3, "spent 1");
  assert(!DATA.skillAdd(sess, "magnum_break"), "magnum still locked");
  assert(DATA.skillSub(sess, "bash"), "refund session rank");
  assert(DATA.skillSessionRank(sess, "bash") === 1 && DATA.skillSessionRemaining(sess) === 4, "refund restored point");
  assert(!DATA.skillSub(sess, "provoke"), "cannot refund locked free root");
}


console.log("swordsman thief trees");
{
  const wids = DATA.SKILL_TREES.warrior.map(function (n) { return n.id; });
  ["bash", "magnum_break", "provoke", "endure", "sword_mastery", "twohand_mastery", "increase_hp_recovery"].forEach(function (id) {
    assert(wids.indexOf(id) >= 0, "warrior tree has " + id);
    assert(!!DATA.SKILLS[id], "DATA.SKILLS has " + id);
  });
  const aids = DATA.SKILL_TREES.assassin.map(function (n) { return n.id; });
  ["double_attack", "improve_dodge", "steal", "hiding", "envenom", "detoxify"].forEach(function (id) {
    assert(aids.indexOf(id) >= 0, "assassin tree has " + id);
    assert(!!DATA.SKILLS[id], "DATA.SKILLS has " + id);
  });
  assert(!DATA.skillUnlocked("magnum_break", { bash: 4 }, "warrior"), "magnum locked until bash 5");
  assert(DATA.skillUnlocked("magnum_break", { bash: 5 }, "warrior"), "magnum unlocked at bash 5");
  assert(!DATA.skillUnlocked("endure", { provoke: 4 }, "warrior"), "endure locked until provoke 5");
  assert(DATA.skillUnlocked("endure", { provoke: 5 }, "warrior"), "endure unlocked at provoke 5");
  assert(!DATA.skillUnlocked("hiding", { steal: 4 }, "assassin"), "hiding locked until steal 5");
  assert(DATA.skillUnlocked("hiding", { steal: 5 }, "assassin"), "hiding unlocked at steal 5");
  assert(!DATA.skillUnlocked("detoxify", { envenom: 2 }, "assassin"), "detoxify locked until envenom 3");
  assert(DATA.skillUnlocked("detoxify", { envenom: 3 }, "assassin"), "detoxify unlocked at envenom 3");
  assert(!DATA.skillUnlocked("twohand_mastery", { sword_mastery: 0 }, "warrior"), "twohand locked until sword_mastery 1");
  assert(DATA.skillUnlocked("twohand_mastery", { sword_mastery: 1 }, "warrior"), "twohand unlocked at sword_mastery 1");

  const wr = DATA.defaultSkillRanks("warrior");
  assert(wr.bash === 1 && wr.provoke === 1, "warrior roots bash+provoke=1");
  ["magnum_break", "endure", "sword_mastery", "twohand_mastery", "increase_hp_recovery"].forEach(function (id) {
    assert(wr[id] === 0, "warrior " + id + " default 0");
  });
  const ar = DATA.defaultSkillRanks("assassin");
  assert(ar.double_attack === 1 && ar.steal === 1, "assassin roots double_attack+steal=1");
  ["improve_dodge", "hiding", "envenom", "detoxify"].forEach(function (id) {
    assert(ar[id] === 0, "assassin " + id + " default 0");
  });

  assert(almost(STATS.bashMod(1), 1.3), "bashMod 1 → 1.3");
  assert(almost(STATS.bashMod(10), 4.0), "bashMod 10 → 4.0");
  assert(almost(STATS.magnumBreakMod(1), 1.2), "magnum 1 → 1.2");
  assert(almost(STATS.magnumBreakMod(10), 3.0), "magnum 10 → 3.0");
  assert(STATS.swordMasteryAtk(10) === 40, "swordMasteryAtk(10)===40");
  assert(STATS.twohandMasteryAtk(10) === 40, "twohandMasteryAtk(10)===40");
  assert(STATS.improveDodgeFlee(10) === 30, "improveDodgeFlee(10)===30");
  assert(almost(STATS.doubleAttackChance(10), 0.5), "doubleAttackChance(10)===0.5");
  assert(DATA.SKILLS.detoxify.maxRank === 1, "detoxify maxRank 1");
  assert(DATA.HEROES.warrior.skills.indexOf("bash") >= 0, "HEROES.warrior has bash");
  assert(DATA.HEROES.assassin.skills.indexOf("envenom") >= 0, "HEROES.assassin has envenom");
  assert(DATA.SKILLS.attack && DATA.SKILLS.stab, "old skill defs kept");
  assert(!!DATA.ITEMS.weapon_claymore && DATA.ITEMS.weapon_claymore.twoHand === true, "claymore 2H sword in shop");
  assert(DATA.ITEMS.weapon_claymore.weaponClass === "sword" && DATA.ITEMS.weapon_claymore.weaponAtk === 140, "claymore numbers");
  assert(DATA.ITEMS.weapon_short.twoHand !== true, "1H swords stay 1H");
  const hidTree = DATA.SKILL_TREES.hunter.map(function (n) { return n.id; });
  assert(hidTree.indexOf("owl_eye") >= 0 && hidTree.indexOf("double_strafe") >= 0, "hunter tree untouched");
  ["owl_eye", "vulture_eye", "double_strafe", "arrow_shower", "improve_concentration", "arrow_repel"].forEach(function (id) {
    assert(hidTree.indexOf(id) >= 0, "hunter tree has " + id);
    assert(DATA.HEROES.hunter.skills.indexOf(id) >= 0, "HEROES.hunter has " + id);
  });
  ["arrowshot", "powershot", "focus", "soularrow", "rain", "mark"].forEach(function (id) {
    assert(hidTree.indexOf(id) < 0, "hunter tree must not include " + id);
    assert(DATA.HEROES.hunter.skills.indexOf(id) < 0, "HEROES.hunter must not include " + id);
  });
  assert(!DATA.skillUnlocked("vulture_eye", { owl_eye: 2 }, "hunter"), "vulture locked until owl 3");
  assert(DATA.skillUnlocked("vulture_eye", { owl_eye: 3 }, "hunter"), "vulture unlocked at owl 3");
  assert(!DATA.skillUnlocked("double_strafe", { vulture_eye: 9 }, "hunter"), "double_strafe locked until vulture 10");
  assert(DATA.skillUnlocked("double_strafe", { vulture_eye: 10 }, "hunter"), "double_strafe unlocked at vulture 10");
  assert(!DATA.skillUnlocked("arrow_shower", { double_strafe: 4 }, "hunter"), "arrow_shower locked until DS 5");
  assert(DATA.skillUnlocked("arrow_shower", { double_strafe: 5 }, "hunter"), "arrow_shower unlocked at DS 5");
  assert(!DATA.skillUnlocked("arrow_repel", { improve_concentration: 0 }, "hunter"), "arrow_repel locked until conc 1");
  assert(DATA.skillUnlocked("arrow_repel", { improve_concentration: 1 }, "hunter"), "arrow_repel unlocked at conc 1");
  const hr = DATA.defaultSkillRanks("hunter");
  assert(hr.owl_eye === 1 && hr.improve_concentration === 1, "hunter roots owl_eye+improve_concentration=1");
  ["vulture_eye", "double_strafe", "arrow_shower", "arrow_repel"].forEach(function (id) {
    assert(hr[id] === 0, "hunter " + id + " default 0");
  });
  assert(DATA.SKILLS.arrow_repel.maxRank === 1, "arrow_repel maxRank 1");
  assert(STATS.vultureEyeRange(3) === 1, "vultureEyeRange(3)===1");
  assert(STATS.vultureEyeRange(10) === 5, "vultureEyeRange(10)===5");
  assert(STATS.vultureEyeHit(3) === 3 && STATS.vultureEyeHit(10) === 10, "vultureEyeHit stays lv");

  const mig = { heroId: "hunter", skillRanks: { arrowshot: 3, powershot: 4, rain: 2, focus: 5, soularrow: 2, mark: 6, arrow_repel: 4, owl_eye: 1 }, autoFarmCfg: { skills: ["powershot", "rain", "owl_eye", "focus"] } };
  PVE.migrateSkillRanks(mig);
  assert(mig.skillRanks.double_strafe === 4, "migrate powershot→DS, got " + mig.skillRanks.double_strafe);
  assert(mig.skillRanks.arrow_shower === 2, "migrate rain→shower, got " + mig.skillRanks.arrow_shower);
  assert(mig.skillRanks.improve_concentration === 5, "migrate focus→conc, got " + mig.skillRanks.improve_concentration);
  assert(mig.skillRanks.owl_eye === 5, "migrate soularrow/arrowshot→owl, got " + mig.skillRanks.owl_eye);
  assert(mig.skillRanks.vulture_eye === 6, "migrate mark→vulture, got " + mig.skillRanks.vulture_eye);
  assert(mig.skillRanks.arrow_repel === 1, "migrate cap arrow_repel 1, got " + mig.skillRanks.arrow_repel);
  assert(!mig.skillRanks.powershot && !mig.skillRanks.arrowshot, "old hunter ranks stripped");
  assert(mig.autoFarmCfg.skills[0] === "double_strafe" && mig.autoFarmCfg.skills[1] === "arrow_shower", "farm ids remapped");
  assert(mig.autoFarmCfg.skills[2] === null, "farm palette drops passive owl_eye");
  const farm = PVE.createSave("hunter", DATA.emptyAllocated());
  assert(farm.autoFarmCfg.skills[0] === "double_strafe", "hunter farm default double_strafe");
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
  assert(MAP.VIEW_W === 45 && MAP.VIEW_H === 33, "camera 45x33");
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
  bd.flee = 0;
  bd.perfectDodge = 0;
  const boss = COMBAT.createUnit(bd, "right");
  boss.def = 0;
  boss.softDef = 0;
  boss.dodge = 0;
  boss.flee = 0;
  boss.perfectDodge = 0;
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
  boss2.flee = 0;
  boss2.perfectDodge = 0;
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
  assert(houseN >= 36 && houseN <= 160, "airy house lots, got " + houseN);
  assert(wallN >= 100, "city walls present, got " + wallN);
  assert(spawn.x === 40 && spawn.y === 51, "spawn at 40,51, got " + spawn.x + "," + spawn.y);
  assert(cg.cells["24,40"] === "W", "weapon cell 24,40 is W, got " + cg.cells["24,40"]);
  assert(cg.cells["56,40"] === "P", "potion cell 56,40 is P, got " + cg.cells["56,40"]);
  const kafraAt = findCell("S");
  assert(kafraAt && MAP.isWalkable(kafraAt.x, kafraAt.y), "kafra S on a walkable tile, got " + (kafraAt ? kafraAt.x + "," + kafraAt.y : "none"));
  assert(cg.cells["40,16"] === "K" && MAP.isWalkable(40, 16), "castle K at 40,16 walkable");
  assert(cg.cells["78,40"] === "G" && MAP.isWalkable(78, 40), "gate G at 78,40 walkable");
  [["weapon", 24, 40], ["potion", 56, 40], ["kafra", kafraAt.x, kafraAt.y], ["castle", 40, 16], ["gate", 78, 40]].forEach(function (row) {
    const at = { x: row[1], y: row[2] };
    assert(MAP.isWalkable(at.x, at.y), row[0] + " walkable");
    const path = MAP.path(spawn, at);
    assert(path.length > 0, row[0] + " reachable from spawn (" + at.x + "," + at.y + ")");
  });
  let extraG = 0;
  let extraK = 0;
  Object.keys(cg.cells).forEach(function (k) {
    const ch = cg.cells[k];
    const p = k.split(",");
    const x = Number(p[0]);
    const y = Number(p[1]);
    if (ch === "G") {
      if (k !== "78,40") extraG += 1;
      const npc = MAP.npcAt(x, y);
      assert(npc && npc.id === "field", "G tile " + k + " npcAt field");
      assert(MAP.gateAt(x, y) === "field", "G tile " + k + " gateAt field");
      assert(MAP.isWalkable(x, y), "G tile " + k + " walkable");
    }
    if (ch === "K") {
      if (k !== "40,16") extraK += 1;
      const npc = MAP.npcAt(x, y);
      assert(npc && npc.id === "castle", "K tile " + k + " npcAt castle");
      assert(MAP.gateAt(x, y) === "bosses", "K tile " + k + " gateAt bosses");
      assert(MAP.isWalkable(x, y), "K tile " + k + " walkable");
    }
  });
  assert(extraG >= 4, "G pad has extra tiles, got " + extraG);
  assert(extraK >= 4, "K pad has extra tiles, got " + extraK);
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
  ["poring", "fabre", "lunatic", "willow", "condor", "wolf", "poporing", "chonchon", "roda_frog", "spore", "rocker", "steel_chonchon", "savage_babe", "elder_willow", "skeleton"].forEach(function (id) {
    assert(kinds[id], id + " present on field");
    assert(MAP.isWalkable(kinds[id].x, kinds[id].y), id + " walkable");
    const path = MAP.path(fz.spawn, { x: kinds[id].x, y: kinds[id].y });
    assert(path.length > 0, id + " reachable from spawn");
  });
  let xN = 0;
  Object.keys(fz.grid.cells).forEach(function (k) {
    if (fz.grid.cells[k] !== "X") return;
    xN += 1;
    const p = k.split(",");
    const x = Number(p[0]);
    const y = Number(p[1]);
    assert(MAP.isWalkable(x, y), "X tile " + k + " walkable");
    assert(MAP.gateAt(x, y) === "city", "X tile " + k + " gateAt city");
  });
  assert(xN >= 6, "field X pad has several tiles, got " + xN);
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

console.log("berserk potion + potion ASPD buffs");
{
  const bz = DATA.POTIONS.berserk;
  assert(!!bz, "DATA.POTIONS.berserk exists");
  assert(bz.aspdMod === 0.20, "berserk aspdMod === 0.20, got " + bz.aspdMod);
  assert(bz.durationMs === 30 * 60 * 1000, "berserk durationMs === 30min, got " + bz.durationMs);
  assert(bz.price === 250, "berserk price === 250, got " + bz.price);
  assert(DATA.POTION_ORDER.indexOf("berserk") !== -1, "POTION_ORDER includes berserk");
  const empty = DATA.emptyPotions();
  assert(empty.berserk === 0, "emptyPotions has berserk: 0");
  const save = PVE.createSave("warrior", DATA.emptyAllocated());
  PVE.syncVitals(save);
  const hp0 = save.hp;
  const mp0 = save.mp;
  save.potions.berserk = 1;
  const now = Date.now();
  const r = PVE.usePotion(save, "berserk");
  assert(r.ok, "usePotion berserk ok");
  assert(save.hp === hp0 && save.mp === mp0, "berserk does not change HP/MP");
  assert(save.potionBuffs && save.potionBuffs.berserk, "potionBuffs.berserk applied");
  const until = save.potionBuffs.berserk.until;
  const delta = until - now;
  assert(delta > 30 * 60 * 1000 - 2000 && delta < 30 * 60 * 1000 + 2000, "until ~ now+30min, delta=" + delta);
  assert(DATA.activePotionAspdMod(save.potionBuffs) === 0.20, "activePotionAspdMod === 0.20 while active");
  assert(DATA.activePotionAspdMod({ berserk: { until: now - 1, aspdMod: 0.20 } }, now) === 0, "expired buff → 0");
  assert(!(DATA.START_POTIONS && DATA.START_POTIONS.berserk), "not given in START_POTIONS");
}

console.log("field monsters + field rewards");
{
  const fieldIds = ["poring", "fabre", "lunatic", "willow", "condor", "wolf", "poporing", "chonchon", "roda_frog", "spore", "rocker", "steel_chonchon", "savage_babe", "elder_willow", "skeleton"];
  assert(DATA.MONSTERS.length === 15, "exactly 15 field monsters, got " + DATA.MONSTERS.length);
  assert(DATA.MONSTERS.map(function (m) { return m.id; }).join(",") === fieldIds.join(","), "15 field ids in roster order");
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
  assert(almost(st.hardDef, 46) && almost(st.hardMdef, 46), "computeHeroStats hard 46");
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
  save.materials = { ore_phracon: 5, ore_elunium: 5, ore_oridecon: 5 };
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
  assert(m.hardDef === 0 && m.hardMdef === 0 && m.softDef === 2 && m.softMdef === 1, "poring Soft DEF 2 / Soft MDEF 1 / Hard 0");
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

console.log("field monster drops + refine ore");
{
  assert(!!DATA.MATERIALS.ore_phracon && DATA.MATERIALS.ore_phracon.name === "แร่ไฟคอน", "ore_phracon Thai name");
  assert(!!DATA.MATERIALS.ore_elunium && DATA.MATERIALS.ore_elunium.name === "เอลูเนียม", "ore_elunium Thai name");
  assert(!!DATA.MATERIALS.ore_oridecon && DATA.MATERIALS.ore_oridecon.name === "โอริเดคอน", "ore_oridecon Thai name");

  const banned = { helm_abyss: 1, armor_ruin: 1, weapon_void: 1, acc_triad: 1 };
  DATA.MONSTERS.forEach(function (m) {
    assert(m.drops && m.drops.length === 3, m.id + " has exactly 3 drops");
    const byKind = {};
    m.drops.forEach(function (d) {
      byKind[d.kind] = d;
      assert(d && d.kind && d.id && d.chance != null, m.id + " drop row shape");
    });
    assert(byKind.material && byKind.material.chance === 5, m.id + " material 5%");
    assert(byKind.item && byKind.item.chance === 1, m.id + " item 1%");
    assert(byKind.potion && (byKind.potion.chance === 3 || byKind.potion.chance === 4), m.id + " potion 3 or 4");
    assert(!banned[byKind.item.id], m.id + " wearable is not high-tier " + (byKind.item && byKind.item.id));
  });

  const win = { chance: function () { return true; } };
  const saveNo = PVE.createSave("warrior", DATA.emptyAllocated());
  saveNo.owned.helm_leather = true;
  saveNo.zeno = 5000;
  const zNo = saveNo.zeno;
  const noOre = PVE.attemptRefine(saveNo, "helm_leather", win);
  assert(!noOre.ok && noOre.reason === "แร่ไม่พอ", "+1 helm without phracon → แร่ไม่พอ");
  assert(saveNo.zeno === zNo, "no ore leaves zeno unchanged");

  saveNo.materials.ore_phracon = 2;
  const plus1 = PVE.attemptRefine(saveNo, "helm_leather", win);
  assert(plus1.ok && plus1.success && saveNo.refine.helm_leather === 1, "+1 helm with phracon succeeds");
  assert(saveNo.materials.ore_phracon === 1, "+1 helm spends 1 phracon");

  const saveHelm = PVE.createSave("warrior", DATA.emptyAllocated());
  saveHelm.owned.helm_leather = true;
  saveHelm.refine.helm_leather = 4;
  saveHelm.zeno = 10000;
  saveHelm.materials = { ore_phracon: 5, ore_elunium: 3, ore_oridecon: 4 };
  const helm5 = PVE.attemptRefine(saveHelm, "helm_leather", win);
  assert(helm5.ok && helm5.success && saveHelm.refine.helm_leather === 5, "+5 helm succeeds");
  assert(saveHelm.materials.ore_elunium === 2, "+5 helm spends elunium");
  assert(saveHelm.materials.ore_oridecon === 4, "+5 helm does not spend oridecon");
  assert(saveHelm.materials.ore_phracon === 5, "+5 helm does not spend phracon");

  const saveWep = PVE.createSave("warrior", DATA.emptyAllocated());
  saveWep.owned.weapon_short = true;
  saveWep.refine.weapon_short = 4;
  saveWep.zeno = 10000;
  saveWep.materials = { ore_phracon: 5, ore_elunium: 3, ore_oridecon: 4 };
  const wep5 = PVE.attemptRefine(saveWep, "weapon_short", win);
  assert(wep5.ok && wep5.success && saveWep.refine.weapon_short === 5, "+5 weapon succeeds");
  assert(saveWep.materials.ore_oridecon === 3, "+5 weapon spends oridecon");
  assert(saveWep.materials.ore_elunium === 3, "+5 weapon does not spend elunium");

  const dropSave = PVE.createSave("warrior", DATA.emptyAllocated());
  const red0 = dropSave.potions.red || 0;
  const always = { next: function () { return 0; }, chance: function () { return true; } };
  const r1 = PVE.applyFieldRewards(dropSave, "poring", always);
  assert(dropSave.potions.red === red0 + 1, "poring always-true red++");
  assert(dropSave.materials.ore_phracon === 1, "poring always-true ore_phracon++");
  assert(dropSave.owned.helm_leather === true, "poring always-true owned helm_leather");
  assert(r1.loot && r1.loot.indexOf("red") >= 0 && r1.loot.indexOf("ore_phracon") >= 0 && r1.loot.indexOf("helm_leather") >= 0, "poring loot lists all 3 ids");
  PVE.applyFieldRewards(dropSave, "poring", always);
  assert(dropSave.owned.helm_leather === true, "second apply owned stays true");
  assert(dropSave.potions.red === red0 + 2, "second apply red++ again");
  assert(dropSave.materials.ore_phracon === 2, "second apply phracon++ again");
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

console.log("hunter range 10 / warrior range 1");
{
  const WORLD = ctx.WORLD;
  assert(WORLD && WORLD.HUNTER_RANGE === 10, "HUNTER_RANGE 10, got " + (WORLD && WORLD.HUNTER_RANGE));
  assert(WORLD.WARRIOR_RANGE === 1, "WARRIOR_RANGE 1, got " + WORLD.WARRIOR_RANGE);
  const hunter = { unit: { heroId: "hunter" } };
  const warrior = { unit: { heroId: "warrior" } };
  assert(WORLD.skillRange(hunter, "arrowshot") === 10, "hunter arrowshot range 10");
  assert(WORLD.skillRange(hunter, "powershot") === 10, "hunter powershot range 10");
  assert(WORLD.skillRange(hunter, "soularrow") === 10, "hunter soularrow range 10");
  assert(WORLD.skillRange(hunter, "double_strafe") === 10, "hunter double_strafe range 10");
  assert(WORLD.skillRange(warrior, "bash") === 1, "warrior bash range 1");
  assert(WORLD.skillRange(warrior, "magnum_break") === 1, "warrior magnum_break range 1");
  assert(WORLD.skillRange(warrior, "provoke") === 9, "warrior provoke range 9");
  const assassin = { unit: { heroId: "assassin" } };
  assert(WORLD.skillRange(assassin, "envenom") === 1, "assassin envenom range 1");
  assert(WORLD.skillRange(assassin, "steal") === 1, "assassin steal range 1");
  assert(WORLD.AGGRO_LEASH === 14, "AGGRO_LEASH 14, got " + WORLD.AGGRO_LEASH);
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
  const w1 = FX.spriteSrc("warrior", { heroId: "warrior", facing: "s", walkFrame: 1 });
  const w2 = FX.spriteSrc("warrior", { heroId: "warrior", facing: "s", walkFrame: 2 });
  assert(w1 === "assets/chars/warrior_s_w1.png", "south walk 1, got " + w1);
  assert(w2 === "assets/chars/warrior_s_w2.png", "south walk 2, got " + w2);
  const idle = FX.spriteSrc("warrior", { heroId: "warrior", facing: "s" });
  assert(idle === "assets/chars/warrior_s.png", "idle south, got " + idle);
  const nWalk = FX.spriteSrc("hunter", { heroId: "hunter", facing: "n", walkFrame: 1 });
  assert(nWalk === "assets/chars/hunter_n.png", "north walk keeps 8-dir sprite, got " + nWalk);
}

console.log("8-dir mob facing");
{
  const FX = ctx.FX;
  const ne = FX.mobFacingArt("ne");
  assert(ne.base === "ne" && !ne.flip, "mob ne is ne no flip");
  const nw = FX.mobFacingArt("nw");
  assert(nw.base === "ne" && nw.flip, "mob nw flips ne");
  const w = FX.mobFacingArt("w");
  assert(w.base === "e" && w.flip, "mob w flips e");
  const sw = FX.mobFacingArt("sw");
  assert(sw.base === "se" && sw.flip, "mob sw flips se");
  const idle = FX.mobFacingArt();
  assert(idle.base === "s" && !idle.flip, "mob default facing s");
  const empty = FX.mobFacingArt("");
  assert(empty.base === "s" && !empty.flip, "mob empty facing s");
  assert(FX.facingArt("ne").base === "n" && !FX.facingArt("ne").flip, "hero ne still uses n");
  assert(FX.facingArt("nw").base === "n" && FX.facingArt("nw").flip, "hero nw still flips n");

  const eSrc = FX.spriteSrc("poring", { isMonster: true, facing: "e" });
  assert(eSrc === "assets/mobs/poring_e.png", "poring e dir path, got " + eSrc);
  const wSrc = FX.spriteSrc("poring", { isMonster: true, facing: "w" });
  assert(wSrc === "assets/mobs/poring_e.png", "poring w uses e file, got " + wSrc);
  const neSrc = FX.spriteSrc("poring", { isMonster: true, facing: "ne" });
  assert(neSrc === "assets/mobs/poring_ne.png", "poring ne dir path, got " + neSrc);
  const nwSrc = FX.spriteSrc("poring", { isMonster: true, facing: "nw" });
  assert(nwSrc === "assets/mobs/poring_ne.png", "poring nw uses ne file, got " + nwSrc);
  const sSrc = FX.spriteSrc("poring", { isMonster: true, facing: "s" });
  assert(sSrc === "assets/mobs/poring_s.png", "poring s dir path, got " + sSrc);

  const ids = ["poring", "fabre", "lunatic", "willow", "condor", "wolf", "poporing", "chonchon", "roda_frog", "spore", "rocker", "steel_chonchon", "savage_babe", "elder_willow", "skeleton"];
  ids.forEach(function (id) {
    const src = FX.spriteSrc(id, { isMonster: true, facing: "s" });
    assert(src === "assets/mobs/" + id + "_s.png", id + " s prefers dir path, got " + src);
    ["s", "n", "e", "se", "ne"].forEach(function (d) {
      assert(existsSync(join(root, "assets/mobs/" + id + "_" + d + ".png")), id + " " + d + " png exists");
    });
    assert(existsSync(join(root, "assets/mobs/" + id + ".png")), id + " fallback png exists");
  });

  FX.noteMob404("assets/mobs/poring_e.png");
  const after = FX.spriteSrc("poring", { isMonster: true, facing: "e" });
  assert(after === "assets/mobs/poring.png", "after 404 e falls back to still, got " + after);
  const afterSpr = FX.spriteSrc("poring", { isMonster: true, facing: "e", sprite: "assets/mobs/custom.png" });
  assert(afterSpr === "assets/mobs/custom.png", "after 404 uses unit.sprite if set, got " + afterSpr);
}

console.log("audio helper");
{
  const AUDIO = ctx.AUDIO;
  assert(!!AUDIO, "AUDIO exists");
  assert(AUDIO.sfxUrl("hit_slash") === "assets/sfx/hit_slash.ogg", "hit_slash path");
  assert(AUDIO.sfxUrl("ui_refine_hit") === "assets/sfx/ui_refine_hit.ogg", "refine hit path");
  assert(AUDIO.sfxUrl("ui_refine_ok") === "assets/sfx/ui_refine_ok.ogg", "refine ok path");
  assert(AUDIO.sfxUrl("ui_refine_fail") === "assets/sfx/ui_refine_fail.ogg", "refine fail path");
  assert(AUDIO.bgmUrl("city") === "assets/bgm/city.ogg", "city bgm path");
  assert(AUDIO.bgmUrl("field") === "assets/bgm/field.ogg", "field bgm path");
  assert(AUDIO.isMeleeHero("warrior") === true, "warrior melee");
  assert(AUDIO.isMeleeHero("assassin") === true, "assassin melee");
  assert(AUDIO.isMeleeHero("hunter") === false, "hunter not melee");
  assert(AUDIO.mobAttackId("poring") === "mob_poring_attack", "poring attack id");
  assert(AUDIO.mobAttackId("steel_chonchon") === "mob_steel_chonchon_attack", "steel_chonchon attack id");
  assert(AUDIO.mobAttackId("unknown") === "", "unknown mob silent");
  const hit = AUDIO.onHitFx({ kind: "dmg", amount: 12 }, { attacker: "hero", heroId: "warrior" });
  assert(hit === "hit_slash", "melee connect plays hit_slash");
  const miss = AUDIO.onHitFx({ kind: "miss", amount: 0 }, { attacker: "hero", heroId: "warrior" });
  assert(miss === false, "miss is silent");
  const bow = AUDIO.onHitFx({ kind: "dmg", amount: 12 }, { attacker: "hero", heroId: "hunter" });
  assert(bow === "hit_arrow", "hunter connect plays hit_arrow");
  const bowCrit = AUDIO.onHitFx({ kind: "dmg", amount: 12, crit: true }, { attacker: "hero", heroId: "hunter" });
  assert(bowCrit === "hit_arrow_crit", "hunter crit plays hit_arrow_crit");
  const bowMiss = AUDIO.onHitFx({ kind: "miss", amount: 0 }, { attacker: "hero", heroId: "hunter" });
  assert(bowMiss === false, "hunter miss is silent");
  const mob = AUDIO.onHitFx({ kind: "dmg", amount: 8 }, { attacker: "mob", monsterId: "poring" });
  assert(mob === "mob_poring_attack", "poring land plays mob attack");
  const poison = AUDIO.onHitFx({ kind: "dmg", amount: 5, poison: true }, { attacker: "mob", monsterId: "poporing" });
  assert(poison === false, "poison tick silent");
}

console.log("wearable Hard DEF + job gates");
{
  const helm = DATA.ITEMS.helm_leather;
  assert(helm.bonuses.hardDef === 1, "helm_leather hardDef 1");
  assert(Object.keys(helm.bonuses).length === 1 && helm.bonuses.hardDef === 1, "helm_leather bonuses only hardDef");
  assert(helm.jobs === "all" && helm.defTier === "low", "helm_leather jobs all / low");
  assert(DATA.canJobWear("warrior", helm) && DATA.canJobWear("assassin", helm) && DATA.canJobWear("hunter", helm), "all heroes wear helm_leather");

  const chain = DATA.ITEMS.armor_chain;
  assert(chain.bonuses.hardDef === 5, "armor_chain hardDef 5");
  assert(!DATA.canJobWear("warrior", chain), "warrior cannot wear armor_chain");
  assert(DATA.canJobWear("assassin", chain) && DATA.canJobWear("hunter", chain), "assassin/hunter wear armor_chain");

  const knight = DATA.ITEMS.armor_knight;
  assert(knight.bonuses.hardDef === 8, "armor_knight hardDef 8");
  assert(!DATA.canJobWear("hunter", knight), "hunter cannot wear armor_knight");
  assert(DATA.canJobWear("warrior", knight) && DATA.canJobWear("assassin", knight), "warrior/assassin wear armor_knight");

  ["armor_robe", "helm_leather", "shield_wood"].forEach(function (id) {
    const it = DATA.ITEMS[id];
    const keys = Object.keys(it.bonuses);
    assert(keys.length === 1 && keys[0] === "hardDef", id + " has no extra bonus keys besides hardDef");
  });

  const w = PVE.createSave("warrior", DATA.emptyAllocated());
  w.owned.armor_chain = true;
  const deny = PVE.equipItem(w, "armor", "armor_chain");
  assert(!deny.ok && deny.reason === "อาชีพนี้ใส่ไม่ได้", "warrior + armor_chain not ok");

  w.owned.armor_knight = true;
  const allow = PVE.equipItem(w, "armor", "armor_knight");
  assert(allow.ok && w.equip.armor === "armor_knight", "warrior + armor_knight ok after owned");

  const h = PVE.createSave("hunter", DATA.emptyAllocated());
  h.owned.armor_knight = true;
  h.equip.armor = "armor_knight";
  PVE.ensureProgress(h);
  assert(h.equip.armor == null, "ensureProgress strips hunter wearing armor_knight");

  assert(DATA.heroJob("warrior") === "swordsman" && DATA.heroJob("assassin") === "thief" && DATA.heroJob("hunter") === "archer", "hero job map");
  assert(DATA.jobsText(helm) === "ทุกอาชีพ", "jobsText all");
  assert(DATA.jobsText(chain) === "Thief / Archer / Acolyte", "jobsText mid");
  assert(DATA.jobsText(knight) === "Swordsman / Thief / Merchant", "jobsText heavy");
}

console.log("ui lock camera + name + hotkeys");
{
  assert(MAP.VIEW_W === 45 && MAP.VIEW_H === 33, "walk camera 45x33, got " + MAP.VIEW_W + "x" + MAP.VIEW_H);
  assert(PVE.CHAR_NAME_MAX === 24, "CHAR_NAME_MAX 24, got " + PVE.CHAR_NAME_MAX);
  assert(PVE.validateCharName("ก").ok === true, "1 Thai grapheme ok");
  const thai24 = "กขคงจฉชซฌญฎฏฐฑฒณดตถทนบปผ";
  assert(PVE.countNameChars(thai24) === 24, "24 Thai graphemes counted");
  assert(PVE.validateCharName(thai24).ok === true, "24 Thai graphemes accepted");
  assert(PVE.validateCharName(thai24 + "ร").ok === false, "25 Thai graphemes rejected");
}

console.log("weapon catalog v1");
{
  const ids = ["weapon_short","weapon_long","weapon_void","weapon_knife","weapon_dirk","weapon_shadow","weapon_bow","weapon_oakbow","weapon_hawk","weapon_staff","weapon_arch","weapon_sage","weapon_hatchet","weapon_battleaxe","weapon_waraxe","weapon_club","weapon_mace","weapon_holy"];
  ids.forEach(function (id) {
    const it = DATA.ITEMS[id];
    assert(!!it, id + " exists");
    assert(it.element === "none", id + " element none");
    assert(!it.bonuses || Object.keys(it.bonuses).length === 0, id + " empty bonuses");
    assert(it.weaponClass, id + " has weaponClass");
  });
  const w = DATA.ITEMS.weapon_short;
  assert(w.weaponAtk === 70 && w.weaponMatk === 0 && w.reqLevel === 1 && w.price === 200, "short 70/1/200");
  assert(DATA.ITEMS.weapon_void.weaponAtk === 200 && DATA.ITEMS.weapon_void.tier === "high", "void 200 high");
  const stf = DATA.ITEMS.weapon_staff;
  assert(stf.weaponAtk === 0 && stf.weaponMatk === 100, "staff MATK only");
  assert(DATA.ITEMS.weapon_sage.weaponMatk === 260, "sage MATK 260");
  assert(DATA.ITEMS.weapon_waraxe.weaponAtk === 250, "waraxe 250");
  assert(DATA.canJobWear("warrior", DATA.ITEMS.weapon_short), "warrior sword ok");
  assert(DATA.canJobWear("warrior", DATA.ITEMS.weapon_hatchet), "warrior axe ok");
  assert(!DATA.canJobWear("warrior", DATA.ITEMS.weapon_bow), "warrior bow no");
  assert(!DATA.canJobWear("warrior", DATA.ITEMS.weapon_staff), "warrior staff no");
  assert(DATA.canJobWear("assassin", DATA.ITEMS.weapon_knife), "assassin dagger ok");
  assert(!DATA.canJobWear("assassin", DATA.ITEMS.weapon_short), "assassin sword no");
  assert(DATA.canJobWear("hunter", DATA.ITEMS.weapon_bow) && DATA.canJobWear("hunter", DATA.ITEMS.weapon_dirk), "hunter bow+dagger");
  assert(!DATA.canJobWear("hunter", DATA.ITEMS.weapon_short), "hunter sword no");
  const line = DATA.itemStatLine(DATA.ITEMS.weapon_oakbow);
  assert(line.indexOf("Weapon ATK 100") >= 0, "line Weapon ATK, got " + line);
  assert(line.indexOf("Archer") >= 0 && line.indexOf("ต้องการ Lv 12") >= 0, "line jobs+lv");
  assert(line.indexOf("ธาตุ") < 0 && line.toLowerCase().indexOf("element") < 0, "line no element");
  const staffLine = DATA.itemStatLine(DATA.ITEMS.weapon_arch);
  assert(staffLine.indexOf("Weapon MATK 170") >= 0, "staff line MATK");
  const save = PVE.createSave("hunter", DATA.emptyAllocated());
  save.owned.weapon_short = true;
  const deny = PVE.equipItem(save, "weapon", "weapon_short");
  assert(!deny.ok && deny.reason === "อาชีพนี้ใส่ไม่ได้", "hunter sword denied");
  save.equip.weapon = "weapon_short";
  PVE.ensureProgress(save);
  assert(save.equip.weapon == null, "hunter sword stripped");
}


console.log("username save/load");
{
  if (typeof ctx.localStorage === "undefined") {
    const mem = {};
    const ls = {
      getItem(k) { return mem[k] || null; },
      setItem(k, v) { mem[k] = String(v); },
      removeItem(k) { delete mem[k]; },
    };
    ctx.localStorage = ls;
    if (typeof global !== "undefined" && typeof global.localStorage === "undefined") {
      global.localStorage = ls;
    }
  }
  assert(PVE.validateUsername("สมชาย").ok === true, "Thai username ok");
  assert(PVE.validateUsername("hero_01").ok === true, "latin+digit+_ username ok");
  assert(PVE.validateUsername("").ok === false, "empty username rejected");
  assert(PVE.validateUsername("   ").ok === false, "whitespace username rejected");
  assert(PVE.validateUsername("---").ok === false, "punctuation-only username rejected");
  const thai24 = "กขคงจฉชซฌญฎฏฐฑฒณดตถทนบปผ";
  assert(PVE.countNameChars(thai24) === 24, "24 Thai graphemes for username");
  assert(PVE.validateUsername(thai24).ok === true, "24 Thai username accepted");
  assert(PVE.validateUsername(thai24 + "ร").ok === false, ">24 username rejected");
  const save = PVE.createSave("warrior", DATA.emptyAllocated(), "นักรบทดสอบ");
  save.baseLevel = 7;
  save.jobLevel = 3;
  save.zeno = 123;
  const wr = PVE.writeAccount("ผู้เล่น1", save);
  assert(wr.ok === true && wr.name === "ผู้เล่น1", "writeAccount ok");
  const loaded = PVE.readAccount("ผู้เล่น1");
  assert(!!loaded, "readAccount found");
  assert(loaded.charName === "นักรบทดสอบ", "readAccount charName");
  assert(loaded.heroId === "warrior", "readAccount heroId");
  assert(loaded.baseLevel === 7 && loaded.jobLevel === 3, "readAccount levels");
  assert(loaded.username === "ผู้เล่น1", "readAccount username");
  const listed = PVE.listAccounts();
  assert(listed.some(function (a) { return a.username === "ผู้เล่น1" && a.charName === "นักรบทดสอบ"; }), "listAccounts includes saved");
  assert(PVE.lastUsername() === "ผู้เล่น1", "lastUsername remembered");
  assert(PVE.readAccount("ไม่มีคนนี้") === null, "missing username is null");
  assert(PVE.writeAccount("", save).ok === false, "writeAccount empty rejected");
}

console.log("locked HIT / FLEE / Perfect Dodge book examples");
{
  assert(STATS.playerHit(99, 99, 1, 0) === 373, "Lv99 DEX99 LUK1 HIT 373, got " + STATS.playerHit(99, 99, 1, 0));
  assert(STATS.playerFlee(99, 99, 1, 0) === 298, "Lv99 AGI99 LUK1 FLEE 298, got " + STATS.playerFlee(99, 99, 1, 0));
  assert(almost(STATS.perfectDodge(1, 0), 1.1), "LUK1 PD 1.1, got " + STATS.perfectDodge(1, 0));

  const heroHit = STATS.computeHeroStats("warrior", { str: 0, vit: 0, int: 0, agi: 0, dex: 99, luk: 1 }, DATA.emptyEquip(), 99);
  assert(heroHit.hit === 373, "computeHeroStats HIT 373, got " + heroHit.hit);
  const heroFlee = STATS.computeHeroStats("warrior", { str: 0, vit: 0, int: 0, agi: 99, dex: 0, luk: 1 }, DATA.emptyEquip(), 99);
  assert(heroFlee.flee === 298, "computeHeroStats FLEE 298, got " + heroFlee.flee);
  assert(almost(heroFlee.perfectDodge, 1.1), "computeHeroStats PD 1.1, got " + heroFlee.perfectDodge);

  const luk1 = STATS.computeHeroStats("warrior", { str: 0, vit: 0, int: 0, agi: 99, dex: 99, luk: 1 }, DATA.emptyEquip(), 99);
  assert(luk1.hit === 373 && luk1.flee === 298 && almost(luk1.perfectDodge, 1.1), "Lv99 DEX99/AGI99 LUK1 book row HIT 373 FLEE 298 PD 1.1, got " + luk1.hit + "/" + luk1.flee + "/" + luk1.perfectDodge);


  const mob40Flee = STATS.monsterFlee(99, 40);
  assert(mob40Flee === 239, "mob Lv99 AGI40 FLEE 239, got " + mob40Flee);
  assert(STATS.hitChance(373, 239) === 100, "vs AGI40 HitChance 100, got " + STATS.hitChance(373, 239));

  const mob99Flee = STATS.monsterFlee(99, 99);
  assert(mob99Flee === 298, "mob Lv99 AGI99 FLEE 298, got " + mob99Flee);
  assert(STATS.hitChance(373, 298) === 75, "vs AGI99 HitChance 75, got " + STATS.hitChance(373, 298));

  const mobHit50 = STATS.monsterHit(99, 50);
  assert(mobHit50 === 319, "mob Lv99 DEX50 HIT 319, got " + mobHit50);
  assert(STATS.hitChance(319, 298) === 21, "mob HIT 319 vs FLEE 298 → 21, got " + STATS.hitChance(319, 298));
  assert(100 - STATS.hitChance(319, 298) === 79, "dodge chance 79");

  const mobHit99 = STATS.monsterHit(99, 99);
  assert(mobHit99 === 368, "mob Lv99 DEX99 HIT 368, got " + mobHit99);
  assert(STATS.hitChance(368, 298) === 70, "mob HIT 368 vs FLEE 298 → 70, got " + STATS.hitChance(368, 298));

  const act4 = STATS.actualFlee(298, 0, 4);
  assert(almost(act4, 258.4), "surround 4 actual FLEE 258.4, got " + act4);
  const hc4 = STATS.hitChance(319, act4);
  assert(almost(hc4, 60.6), "surround 4 vs HIT 319 HitChance 60.6 (not 61), got " + hc4);

  const act6 = STATS.actualFlee(298, 0, 6);
  assert(almost(act6, 218.8), "surround 6 actual FLEE 218.8, got " + act6);
  assert(STATS.hitChance(319, act6) === 100, "surround 6 vs HIT 319 HitChance 100, got " + STATS.hitChance(319, act6));

  assert(almost(STATS.actualFlee(298, 0, 1), 298), "surround 1 no shrink");
  assert(almost(STATS.actualFlee(298, 0, 2), 298), "surround 2 no shrink");
  assert(almost(STATS.actualFlee(298, 7, 12), 107), "12+ mobs: 100 + SkillBonus 7");
  assert(almost(STATS.actualFlee(298, 7, 4), 265.4), "surround 4 SkillBonus outside shrink: 100+7+198*0.8");

  const mob = STATS.computeMonsterStats({ id: "x", name: "x", emoji: "x", color: "#000", level: 99, agi: 40, dex: 50, hp: 1, mp: 0, atk: 1, matk: 0, def: 0, mdef: 0, crit: 0, critMult: 50, skills: [] });
  assert(mob.hit === 319 && mob.flee === 239 && mob.perfectDodge === 0, "computeMonsterStats HIT/FLEE/PD from lv+dex+agi");

  const bossPd = STATS.computeBossStats(Object.assign({}, DATA.BOSSES[0], { level: 10, dex: 5, agi: 8, perfectDodge: 3.5 }));
  assert(bossPd.hit === 185 && bossPd.flee === 118 && almost(bossPd.perfectDodge, 3.5), "boss explicit PD, HIT/FLEE from lv+dex+agi");

  const missing = STATS.computeMonsterStats({ id: "y", name: "y", emoji: "y", color: "#000", level: 1, hp: 1, mp: 0, atk: 1, matk: 0, def: 0, mdef: 0, crit: 0, critMult: 50, skills: [] });
  assert(missing.hit === 171 && missing.flee === 101 && missing.perfectDodge === 0, "missing agi/dex count as 0");

  const book = [
    ["poring", 175, 106, 2, 1, 0, 0],
    ["fabre", 177, 108, 5, 2, 1, 0],
    ["lunatic", 180, 116, 3, 2, 0, 0],
    ["willow", 179, 107, 7, 8, 8, 6],
    ["condor", 184, 115, 4, 3, 2, 0],
    ["wolf", 198, 132, 13, 7, 8, 2],
    ["poporing", 193, 123, 15, 16, 4, 8],
    ["chonchon", 202, 148, 11, 9, 2, 4],
    ["roda_frog", 195, 121, 25, 10, 22, 5],
    ["spore", 198, 124, 15, 25, 6, 12],
    ["rocker", 211, 147, 14, 12, 6, 4],
    ["steel_chonchon", 206, 144, 20, 12, 48, 8],
    ["savage_babe", 203, 133, 22, 10, 18, 3],
    ["elder_willow", 202, 126, 24, 29, 20, 22],
    ["skeleton", 212, 134, 23, 14, 30, 6],
  ];
  book.forEach(function (row) {
    const def = DATA.findMonster(row[0]);
    assert(def.str != null && def.agi != null && def.vit != null && def.int != null && def.dex != null && def.luk != null, row[0] + " has primaries");
    const st = STATS.computeMonsterStats(def);
    assert(st.hit === row[1], row[0] + " HIT " + row[1] + " got " + st.hit);
    assert(st.flee === row[2], row[0] + " FLEE " + row[2] + " got " + st.flee);
    assert(st.softDef === row[3], row[0] + " SoftDEF " + row[3] + " got " + st.softDef);
    assert(st.softMdef === row[4], row[0] + " SoftMDEF " + row[4] + " got " + st.softMdef);
    assert(st.hardDef === row[5], row[0] + " HardDEF " + row[5] + " got " + st.hardDef);
    assert(st.hardMdef === row[6], row[0] + " HardMDEF " + row[6] + " got " + st.hardMdef);
  });
  assert(STATS.monsterSoftMdef(2, 1) === 1 && STATS.monsterSoftMdef(36, 14) === 25, "monsterSoftMdef floor((INT+lv)/2)");

  const unit = COMBAT.createUnit(heroHit, "left");
  assert(unit.hit === 373 && unit.flee === heroHit.flee && almost(unit.perfectDodge, heroHit.perfectDodge), "createUnit copies HIT/FLEE/PD");

  const mage = dummy({ hit: 1, matk: 100, crit: 100 });
  const tgt = dummy({ flee: 999, perfectDodge: 100, isHero: false });
  const always = { chance: function () { return true; } };
  const mag = COMBAT.rollConnect(mage, tgt, always, { atkRatio: 0, matkRatio: 1 });
  assert(mag.hit === true && mag.crit === false && mag.pd === false, "magic skips PD/FLEE/crit connect");

  const physPd = COMBAT.rollConnect(dummy({ hit: 400, crit: 100, isHero: true }), tgt, always, { atkRatio: 1, matkRatio: 0 });
  assert(physPd.hit === false && physPd.pd === true, "PD first even if would crit");

  const never = { chance: function () { return false; } };
  const critConn = COMBAT.rollConnect(dummy({ hit: 1, crit: 100, isHero: true }), dummy({ flee: 999, perfectDodge: 0, isHero: false }), { chance: function (p) { return p >= 100; } }, { atkRatio: 1, forceCrit: true });
  assert(critConn.hit === true && critConn.crit === true, "crit skips FLEE");

  const fleeConn = COMBAT.rollConnect(dummy({ hit: 319, crit: 0, isHero: false }), dummy({ flee: 298, perfectDodge: 0, isHero: true }), never, { atkRatio: 1, surround: 1 });
  assert(fleeConn.hit === false && fleeConn.crit === false, "HitChance 21 with never-rng misses");

  const s4 = STATS.actualFlee(298, 0, 4);
  assert(almost(COMBAT.hitChance(dummy({ hit: 319 }), dummy({ flee: 298, isHero: true }), false, 4), 60.6), "COMBAT.hitChance surround 4 = 60.6");

  assert(COMBAT.surroundCount({}) === 1, "ATB default surround 1");
  assert(COMBAT.surroundCount({ foes: [{ hp: 10 }, { hp: 10 }, { dead: true }, { hp: 0 }, { unit: { hp: 5 } }] }) === 3, "surroundCount living foes");

  const gd = STATS.computeHeroStats("warrior", { str: 0, vit: 0, int: 0, agi: 0, dex: 0, luk: 0 }, DATA.emptyEquip(), 1);
  assert(gd.gearDelta.hit === 0 && gd.gearDelta.flee === 0 && gd.gearDelta.perfectDodge === 0, "empty gearDelta includes hit/flee/PD");
}

console.log("auto farm cfg + inventory materials");
{
  const fresh = PVE.createSave("warrior", DATA.emptyAllocated());
  assert(!!fresh.autoFarmCfg, "createSave has autoFarmCfg");
  assert(fresh.autoFarmCfg.sitHp === 30 && fresh.autoFarmCfg.sitMp === 20, "createSave sit percents");
  assert(Array.isArray(fresh.autoFarmCfg.skills) && fresh.autoFarmCfg.skills.length === 4, "createSave skills length 4");
  assert(Array.isArray(fresh.autoFarmCfg.pots) && fresh.autoFarmCfg.pots.length === 3, "createSave pots length 3");
  assert(fresh.materials && typeof fresh.materials === "object" && !Array.isArray(fresh.materials), "createSave materials {}");
  assert(Object.keys(fresh.materials).length === 0, "createSave materials empty");

  const bare = { heroId: "warrior" };
  const cfg = PVE.ensureAutoFarmCfg(bare);
  assert(cfg.sitHpOn === true && cfg.sitHp === 30 && cfg.sitMpOn === true && cfg.sitMp === 20, "ensureAutoFarmCfg fills sit defaults");
  assert(cfg.skills.length === 4 && cfg.skills.every(function (x) { return x == null; }), "ensureAutoFarmCfg skills [null x4]");
  assert(cfg.pots.length === 3 && cfg.pots[0].when === "hp" && cfg.pots[0].pct === 40, "ensureAutoFarmCfg pot0 hp 40");
  assert(cfg.pots[1].when === "mp" && cfg.pots[1].pct === 20, "ensureAutoFarmCfg pot1 mp 20");
  assert(cfg.pots[2].when === "hp" && cfg.pots[2].pct === 50, "ensureAutoFarmCfg pot2 hp 50");
  bare.autoFarmCfg = { sitHp: 0, sitMp: 140, skills: ["attack"], pots: [{ id: "red", when: "hp", pct: 3 }] };
  const clamped = PVE.ensureAutoFarmCfg(bare);
  assert(clamped.sitHp === 1 && clamped.sitMp === 99, "ensureAutoFarmCfg clamps sit percents 1–99");
  assert(clamped.skills.length === 4 && clamped.pots.length === 3, "ensureAutoFarmCfg pads skills/pots");

  const save = PVE.createSave("warrior", DATA.emptyAllocated());
  const unlearned = PVE.setFarmSkill(save, 0, "magnum_break");
  assert(!unlearned.ok, "setFarmSkill rejects unlearned magnum_break");
  const unknown = PVE.setFarmSkill(save, 0, "not_a_skill");
  assert(!unknown.ok, "setFarmSkill rejects unknown skill");
  const night = PVE.setFarmSkill(save, 0, "nightfall");
  assert(!night.ok, "setFarmSkill rejects other-job skill");
  const okSk = PVE.setFarmSkill(save, 0, "bash");
  assert(okSk.ok && save.autoFarmCfg.skills[0] === "bash", "setFarmSkill accepts learned bash");
  const clr = PVE.setFarmSkill(save, 0, null);
  assert(clr.ok && save.autoFarmCfg.skills[0] == null, "setFarmSkill clears with null");

  PVE.setFarmPot(save, 0, { id: "blue", when: "mp", pct: 200 });
  assert(save.autoFarmCfg.pots[0].pct === 99, "setFarmPot clamps pct high to 99");
  PVE.setFarmPot(save, 0, { id: "blue", when: "mp", pct: 0 });
  assert(save.autoFarmCfg.pots[0].pct === 1, "setFarmPot clamps pct low to 1");
  PVE.setFarmPot(save, 0, { id: "blue", when: "mp", pct: 50 });
  assert(save.autoFarmCfg.pots[0].id === "blue" && save.autoFarmCfg.pots[0].when === "mp", "setFarmPot stores blue/mp");

  save.potions = { red: 0, orange: 0, white: 0, blue: 1, berserk: 0 };
  const unit = { hp: 100, maxHp: 100, mp: 10, maxMp: 100 };
  const used = PVE.maybeAutoPotion(save, unit);
  assert(used && used.ok && used.id === "blue", "maybeAutoPotion uses configured blue on low MP");
  assert(save.potions.blue === 0, "configured blue consumed");

  const oldSave = PVE.createSave("warrior", DATA.emptyAllocated());
  oldSave.potions = { red: 1, orange: 0, white: 0, blue: 0, berserk: 0 };
  const lowHp = { hp: 10, maxHp: 100, mp: 50, maxMp: 50 };
  const fallback = PVE.maybeAutoPotion(oldSave, lowHp);
  assert(fallback && fallback.id === "red", "maybeAutoPotion falls back to hardcoded orange/red/white when pots empty");

  PVE.setFarmSit(save, { sitHpOn: true, sitHp: 40, sitMpOn: false, sitMp: 20 });
  save.autoFarm = true;
  const sitLow = { hp: 30, maxHp: 100, mp: 100, maxMp: 100 };
  assert(PVE.shouldSit(save, sitLow) === true, "shouldSit true when hp below sitHp");
  sitLow.hp = 50;
  assert(PVE.shouldSit(save, sitLow) === false, "shouldSit false when hp above sitHp");
  save.autoFarm = false;
  sitLow.hp = 10;
  assert(PVE.shouldSit(save, sitLow) === false, "shouldSit false when autoFarm off");

  const noMat = {};
  PVE.ensureProgress(noMat);
  assert(noMat.materials && typeof noMat.materials === "object" && Object.keys(noMat.materials).length === 0, "materials default {}");
  assert(!!DATA.MATERIALS.jellopy && DATA.MATERIALS.jellopy.name === "เจลลอปี้", "DATA.MATERIALS.jellopy");
}

console.log("auto farm sit regen + skill order");
{
  const WORLD = ctx.WORLD;
  assert(!!WORLD && typeof WORLD.applySitRegen === "function", "WORLD.applySitRegen exported");
  assert(WORLD.SIT_REGEN_MULT === 2, "sit regen labeled 2× stand");

  const sitSave = PVE.createSave("warrior", DATA.emptyAllocated());
  PVE.setFarmSit(sitSave, { sitHpOn: true, sitHp: 40, sitMpOn: false, sitMp: 20 });
  sitSave.autoFarm = true;
  const sitUnit = { hp: 30, maxHp: 100, mp: 80, maxMp: 100 };
  assert(PVE.shouldSit(sitSave, sitUnit) === true, "shouldSit true when autoFarm and hp below sitHp");
  sitUnit.hp = 50;
  assert(PVE.shouldSit(sitSave, sitUnit) === false, "shouldSit false when hp and mp above thresholds");

  const regenU = { hp: 40, maxHp: 200, mp: 5, maxMp: 80, hpRegen: 10, mpRegen: 3, isHero: true };
  assert(WORLD.applySitRegen(regenU, 500) === 0, "sit regen accumulates under 1000ms");
  assert(regenU.hp === 40 && regenU.mp === 5, "no heal before 1000ms");
  assert(WORLD.applySitRegen(regenU, 500) === 1, "sit regen ticks at ~1000ms");
  assert(regenU.hp === 60, "sitting tick heals 2× hpRegen (10*2=20), got " + regenU.hp);
  assert(regenU.mp === 11, "sitting tick restores 2× mpRegen (3*2=6), got " + regenU.mp);

  const farm = PVE.createSave("warrior", DATA.emptyAllocated());
  farm.skillRanks = Object.assign(DATA.defaultSkillRanks("warrior"), { bash: 5, magnum_break: 1, provoke: 5, endure: 1 });
  PVE.ensureProgress(farm);
  const setG = PVE.setFarmSkill(farm, 0, "endure");
  const setA = PVE.setFarmSkill(farm, 1, "bash");
  const setM = PVE.setFarmSkill(farm, 2, "magnum_break");
  assert(setG.ok && setA.ok && setM.ok, "farm slots accept learned endure/bash/magnum_break");
  const hero = PVE.buildHeroUnit(farm);
  hero.cds = {};
  const me = { x: 5, y: 5, unit: hero };
  const foe = { x: 6, y: 5, dead: false, unit: { hp: 10, maxHp: 10 } };
  assert(WORLD.pickFarmSkill(farm, me, foe) === "endure", "farm skill order picks first configured ready skill (endure)");
  hero.cds.endure = 5000;
  assert(WORLD.pickFarmSkill(farm, me, foe) === "bash", "farm skill order skips unready and casts next configured");
  farm.autoFarmCfg.skills = [null, null, "magnum_break", "bash"];
  hero.cds = {};
  assert(WORLD.pickFarmSkill(farm, me, foe) === "magnum_break", "farm skill order skips empties");
  hero.cds.magnum_break = 1;
  hero.cds.bash = 1;
  assert(WORLD.pickFarmSkill(farm, me, foe) === null, "all empty/unready → null (fallback to existing endure/bash)");

  const casts = [];
  const origCast = WORLD.cast;
  WORLD.cast = function (id) { casts.push(id); return true; };
  farm.autoFarmCfg.skills = ["endure", "bash", null, null];
  hero.cds = {};
  const used = WORLD.tryFarmSkills(farm, me, foe);
  WORLD.cast = origCast;
  assert(used === true && casts[0] === "endure", "tryFarmSkills casts first configured ready skill");
}

console.log("field near hunting plain");
{
  MAP.setZone("field");
  const fz = MAP.ZONES.field;
  const g = fz.grid;
  const spawn = fz.spawn;
  function manh(x, y) {
    return Math.abs(x - spawn.x) + Math.abs(y - spawn.y);
  }
  function isPlainTile(x, y) {
    if (x <= 50 && y >= 70) return true;
    return manh(x, y) < 32;
  }
  const n = g.cols;
  let camTiles = 0;
  let camWalk = 0;
  let camMarks = 0;
  for (let y = 78; y < n - 1; y++) {
    for (let x = 1; x <= 44; x++) {
      camTiles += 1;
      if (g.walkable[y][x]) camWalk += 1;
      if (g.decorAt && g.decorAt[x + "," + y]) camMarks += 1;
    }
  }
  const camPct = camWalk / camTiles;
  assert(camMarks <= 2, "first-camera landmarks 0-2, got " + camMarks);
  assert(camPct >= 0.95, "first-camera almost all walkable, " + (camPct * 100).toFixed(1) + "%");

  let landmarkN = 0;
  (g.decor || []).forEach(function (d) {
    if (isPlainTile(d.x, d.y)) landmarkN += 1;
  });
  assert(landmarkN >= 4 && landmarkN <= 8, "landmarks 4-8, got " + landmarkN);

  let midTiles = 0;
  let midDec = 0;
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      const d = manh(x, y);
      if (d >= 30 && d < 52 && !isPlainTile(x, y)) midTiles += 1;
    }
  }
  (g.decor || []).forEach(function (d) {
    const dist = manh(d.x, d.y);
    if (dist >= 30 && dist < 52 && !isPlainTile(d.x, d.y)) midDec += 1;
  });
  const midDens = midDec / midTiles;
  assert(midDens >= 0.45, "mid-band outside rectangle still dense forest, dens " + midDens.toFixed(3));

  const mobs = MAP.listFieldSpawns();
  assert(mobs.length === 48, "48 field mobs, got " + mobs.length);
  const ids = {};
  mobs.forEach(function (m) { ids[m.monsterId] = 1; });
  assert(Object.keys(ids).length === 15, "15 field ids, got " + Object.keys(ids).length);
  const nearIds = { poring: 1, fabre: 1, lunatic: 1, willow: 1, condor: 1 };
  let nearN = 0;
  let nearOnWalk = 0;
  mobs.forEach(function (m) {
    assert(MAP.isWalkable(m.x, m.y), m.monsterId + " walkable");
    assert(!(g.decorAt && g.decorAt[m.x + "," + m.y]), m.monsterId + " not inside tree cell");
    const d = manh(m.x, m.y);
    assert(d >= 8, "no mob manh<8, " + m.monsterId + " at " + d);
    if (d < 30) {
      nearN += 1;
      assert(nearIds[m.monsterId], m.monsterId + " is a near-band id");
      if (g.walkable[m.y][m.x] && !(g.decorAt && g.decorAt[m.x + "," + m.y])) nearOnWalk += 1;
    }
  });
  assert(nearN > 0 && nearOnWalk === nearN, "near mobs stand in the open " + nearOnWalk + "/" + nearN);

  let xN = 0;
  Object.keys(g.cells).forEach(function (k) {
    if (g.cells[k] === "X") xN += 1;
  });
  assert(xN === 9, "9 X-pad tiles, got " + xN);

  const marks = MAP.FIELD_OVER_MARKS || [];
  assert(marks.some(function (m) { return m.kind === "gate"; }), "overlay has gate");
  assert(marks.every(function (m) { return m.kind !== "tree"; }), "overlay has no trees");
  MAP.setZone("bosses");
}


console.log("carry weight");
{
  assert(DATA.maxWeight(0) === 2000, "DATA.maxWeight(0)===2000, got " + DATA.maxWeight(0));
  assert(DATA.maxWeight(1) === 2030, "DATA.maxWeight(1)===2030, got " + DATA.maxWeight(1));
  assert(DATA.maxWeight(10) === 2300, "DATA.maxWeight(10)===2300, got " + DATA.maxWeight(10));
  assert(DATA.itemWeight("red") === 70, "DATA.itemWeight(red)===70, got " + DATA.itemWeight("red"));
  assert(DATA.itemWeight("unknown_id") === 10, "missing weight → 10g");

  const save = PVE.createSave("warrior", DATA.emptyAllocated());
  // START_POTIONS red:5 orange:2 white:0 blue:1 → 5*70+2*10+1*15 = 385g
  // createSave owns no gear and no materials, so carry is potions only.
  const startW = 5 * 70 + 2 * 10 + 0 * 15 + 1 * 15;
  assert(startW === 385, "START_POTIONS grams 385");
  assert(Object.keys(save.owned || {}).filter(function (id) { return save.owned[id]; }).length === 0, "createSave owns no gear");
  assert(!save.materials || !Object.keys(save.materials).some(function (id) { return save.materials[id]; }), "createSave has no materials");
  assert(PVE.carryWeight(save) === 385, "new save carryWeight === 385, got " + PVE.carryWeight(save));
  assert(PVE.maxWeight(save) === 2000, "STR 0 (allocated+equip) maxWeight 2000");

  const room = PVE.maxWeight(save) - PVE.carryWeight(save);
  assert(PVE.canCarry(save, room) === true, "canCarry exact remaining room");
  assert(PVE.canCarry(save, room + 1) === false, "canCarry false when extra would exceed");

  const ws0 = PVE.weightState(save);
  assert(ws0.cur === 385 && ws0.max === 2000, "weightState cur/max");
  assert(ws0.ratio === 385 / 2000, "weightState.ratio = cur/max, got " + ws0.ratio);
  assert(ws0.noRegen === false && ws0.over === false && ws0.full === false, "start save not overweight");
  const pack = PVE.createSave("warrior", DATA.emptyAllocated());
  pack.potions = { red: 21, orange: 0, white: 0, blue: 0, berserk: 0 };
  pack.zeno = 10000;
  const ws70 = PVE.weightState(pack);
  assert(ws70.cur === 1470 && ws70.noRegen === true && ws70.over === false, "21 red = 1470g >=70% noRegen");
  pack.potions.red = 26;
  const ws90 = PVE.weightState(pack);
  assert(ws90.cur === 1820 && ws90.over === true && ws90.full === false, "26 red = 1820g >=90% over");
  pack.potions.red = 29;
  const ws100 = PVE.weightState(pack);
  assert(ws100.cur === 2030 && ws100.full === true, "29 red = 2030g >2000 full");
  assert(PVE.canCarry(pack, 10) === false, "full cannot carry more");
  const shop = PVE.buy(pack, "helm_leather");
  assert(shop.ok === false && /น้ำหนัก/.test(shop.reason || ""), "100% shop blocks extra gear");
  const der = PVE.derived(save);
  assert(der.weight && der.weight.cur === 385 && der.weight.max === 2000, "derived.weight is weightState");
  assert(der.weight.ratio === 385 / 2000, "derived.weight.ratio");
  assert(der.maxWeight === 2000, "derived.maxWeight from total STR");

  const strSave = PVE.createSave("warrior", Object.assign(DATA.emptyAllocated(), { str: 10 }));
  assert(PVE.maxWeight(strSave) === 2300, "allocated STR 10 → maxWeight 2300");

  const fat = PVE.createSave("warrior", DATA.emptyAllocated());
  fat.zeno = 10000;
  fat.potions.red = 30; // 30*70 + 2*10 + 1*15 = 2135 > 2000
  const zenoBefore = fat.zeno;
  const potBlocked = PVE.buyPotion(fat, "orange");
  assert(!potBlocked.ok && potBlocked.reason === "น้ำหนักเต็ม แบกไม่ไหว", "buyPotion overweight reason");
  assert(fat.zeno === zenoBefore, "buyPotion overweight leaves zeno unchanged, got " + fat.zeno);
  assert((fat.potions.orange || 0) === 2, "buyPotion overweight did not add orange");

  const gearBlocked = PVE.buy(fat, "helm_leather");
  assert(!gearBlocked.ok && gearBlocked.reason === "น้ำหนักเต็ม แบกไม่ไหว", "buy gear overweight");
  assert(!fat.owned.helm_leather, "overweight buy did not grant item");

  const okBuy = PVE.createSave("warrior", DATA.emptyAllocated());
  okBuy.zeno = 10000;
  const bought = PVE.buy(okBuy, "helm_leather");
  assert(bought.ok && okBuy.owned.helm_leather, "buy helm_leather ok on new save");
  assert(PVE.carryWeight(okBuy) === 385 + 10, "carry after helm_leather is 395");

  const dropSave = PVE.createSave("warrior", DATA.emptyAllocated());
  dropSave.potions = { red: 100, orange: 0, white: 0, blue: 0, berserk: 0 }; // 7000g, already at max
  dropSave.zeno = 0;
  const always = { next: function () { return 0; }, chance: function () { return true; } };
  const r = PVE.applyFieldRewards(dropSave, "poring", always);
  assert(r.zeno > 0, "overweight field still grants zeno, got " + r.zeno);
  assert(r.baseExp === 45 && r.jobExp === 30, "overweight field still grants exp");
  assert(!(r.loot && r.loot.length), "overweight field skips loot, got " + JSON.stringify(r.loot));
  assert(!dropSave.owned.helm_leather, "overweight skip does not grant helm_leather");
  assert((dropSave.materials.ore_phracon || 0) === 0, "overweight skip does not grant ore");
  assert(dropSave.potions.red === 100, "overweight skip does not add potion");

  const reDrop = PVE.createSave("warrior", DATA.emptyAllocated());
  reDrop.owned.helm_leather = true;
  reDrop.potions = { red: 100, orange: 0, white: 0, blue: 0, berserk: 0 };
  const r2 = PVE.applyFieldRewards(reDrop, "poring", always);
  assert(r2.loot.indexOf("helm_leather") >= 0, "already-owned item re-drop is 0 extra grams so it succeeds");
  assert(r2.loot.indexOf("red") < 0 && r2.loot.indexOf("ore_phracon") < 0, "new pieces still skipped at max weight");
}


console.log("8-dir walk");
{
  MAP.setZone("field");
  const spawn = MAP.ZONES.field.spawn;
  const nbs = MAP.neighbors(spawn.x, spawn.y);
  assert(nbs.some(function (p) { return p.x !== spawn.x && p.y !== spawn.y; }), "neighbors include a diagonal from field spawn");
  const trail = MAP.path(spawn, { x: spawn.x + 4, y: spawn.y + 4 });
  assert(trail.length === 4, "diagonal path to +4,+4 is 4 steps, got " + trail.length);
  const first = trail[0];
  assert(first && first.x !== spawn.x && first.y !== spawn.y, "path to +4,+4 starts with a diagonal step");
}

console.log("farm walk cost + reachable retarget");
{
  const WORLD = ctx.WORLD;
  MAP.setZone("field");
  const g = MAP.ZONES.field.grid;
  const from = { x: 10, y: 90 };
  const behind = { x: 16, y: 90 };
  const open = { x: 10, y: 84 };
  const isolated = { x: 22, y: 90 };
  const wallX = 13;
  const saved = [];
  function remember(x, y) {
    saved.push({ x: x, y: y, walk: !!(g.walkable[y] && g.walkable[y][x]) });
  }
  function setWalk(x, y, on) {
    remember(x, y);
    if (!g.walkable[y]) g.walkable[y] = [];
    g.walkable[y][x] = on;
  }
  try {
    for (let y = 80; y <= 96; y++) {
      for (let x = 8; x <= 24; x++) setWalk(x, y, true);
    }
    for (let y = 85; y <= 95; y++) setWalk(wallX, y, false);
    for (let y = 88; y <= 92; y++) {
      for (let x = 21; x <= 23; x++) setWalk(x, y, false);
    }
    setWalk(isolated.x, isolated.y, true);

    const cheb = Math.max(Math.abs(from.x - behind.x), Math.abs(from.y - behind.y));
    const around = MAP.path(from, behind);
    const last = around[around.length - 1];
    assert(around.length > cheb, "path around wall is longer than chebyshev (" + around.length + " > " + cheb + ")");
    assert(last && last.x === behind.x && last.y === behind.y, "detour path reaches the far side of the wall");

    assert(MAP.adjacentWalkCost(from, { x: from.x + 1, y: from.y }) === 0, "adjacentWalkCost is 0 when already chebyshev<=1");
    const blockedCost = MAP.adjacentWalkCost(from, behind);
    const openCost = MAP.adjacentWalkCost(from, open);
    assert(blockedCost > 0, "blocked mob has a finite detour cost, got " + blockedCost);
    assert(openCost > 0 && openCost < blockedCost, "open mob path " + openCost + " shorter than walled mob " + blockedCost);
    assert(MAP.adjacentWalkCost(from, isolated) === -1, "isolated mob with no adjacent path is -1");
    assert(MAP.walkToAdjacent(from, isolated) === false, "walkToAdjacent returns false when no adjacent path");
    assert(MAP.walkToAdjacent(from, { x: from.x + 1, y: from.y }) === true, "walkToAdjacent returns true when already adjacent");

    const player = { x: from.x, y: from.y, kind: "player" };
    const closeWall = { id: "m-wall", kind: "mob", x: behind.x, y: behind.y, dead: false };
    const farOpen = { id: "m-open", kind: "mob", x: open.x, y: open.y, dead: false };
    const deadClose = { id: "m-dead", kind: "mob", x: from.x + 1, y: from.y, dead: true };
    const boxed = { id: "m-box", kind: "mob", x: isolated.x, y: isolated.y, dead: false };
    const picked = WORLD.pickFarmTarget(player, [player, closeWall, farOpen, deadClose, boxed]);
    assert(picked === farOpen, "pickFarmTarget prefers shorter walk path over manhattan-closer mob behind a wall");
    assert(WORLD.pickFarmTarget(player, [player, boxed]) === null, "pickFarmTarget skips mobs with no adjacent path");
  } finally {
    saved.reverse().forEach(function (c) {
      if (!g.walkable[c.y]) g.walkable[c.y] = [];
      g.walkable[c.y][c.x] = c.walk;
    });
  }
}


console.log("prontera art lock: flowers, houses, 3x3 warps, npcs");
{
  MAP.setZone("city");
  const cg = MAP.ZONES.city.grid;
  assert(cg.cols === 80 && cg.rows === 80, "city still 80x80, got " + cg.cols + "x" + cg.rows);
  assert(cg.houseLots && cg.houseLots.sw === 7 && cg.houseLots.se === 7, "houseLots sw/se unchanged 7/7, got " + JSON.stringify(cg.houseLots));

  let bN = 0;
  let gN = 0;
  let kN = 0;
  let flowerViaHash = 0;
  for (let y = 0; y < cg.rows; y++) {
    for (let x = 0; x < cg.cols; x++) {
      const ch = cg.cells[x + "," + y] || "";
      const walk = !!(cg.walkable[y] && cg.walkable[y][x]);
      if (ch === "B") bN += 1;
      if (ch === "G") {
        gN += 1;
        assert(MAP.gateAt(x, y) === "field", "G " + x + "," + y + " gateAt field");
      }
      if (ch === "K") {
        kN += 1;
        assert(MAP.gateAt(x, y) === "bosses", "K " + x + "," + y + " gateAt bosses");
      }
      const cls = MAP.tileClass(x, y, walk, true);
      if (walk && MAP.flowerAt(x, y) && cls.indexOf("flower") >= 0 && ch !== "B") flowerViaHash += 1;
    }
  }
  assert(flowerViaHash === 0, "city walk tiles do not get flower via flowerAt, got " + flowerViaHash);
  assert(bN >= 4 && bN <= 8, "plaza B in 4..8, got " + bN);
  assert(gN === 9, "G tiles === 9, got " + gN);
  assert(kN === 9, "K tiles === 9, got " + kN);

  MAP._cityMarks = null;
  const marks = MAP.cityLandmarks();
  const houses = marks.filter(function (m) { return m.kind === "house"; });
  assert(houses.length > 0, "cityLandmarks has houses");
  houses.forEach(function (m) {
    assert(m.w >= 9 && m.w <= 11 && m.h >= 13 && m.h <= 15, "house w/h " + m.w + "x" + m.h);
  });
  const seLots = (cg.lotPts && cg.lotPts.se) || [];
  seLots.forEach(function (pt) {
    if (pt[1] > 46) return;
    const house = houses.find(function (h) {
      return Math.abs(h.x - (pt[0] + 1.6)) < 0.05;
    });
    assert(house, "se lot " + pt[0] + "," + pt[1] + " has house");
    assert(house.y - house.h >= 42.5, "se lot " + pt[0] + "," + pt[1] + " roof " + (house.y - house.h) + " off ribbon");
  });
  marks.filter(function (m) { return m.kind === "shop"; }).forEach(function (m) {
    assert(m.w >= 8, "shop w>=8, got " + m.w);
  });
  const castle = marks.find(function (m) { return m.kind === "castle"; });
  assert(castle && castle.w >= 15, "castle w>=15, got " + (castle && castle.w));

  assert(MAP.npcAt(24, 40) && MAP.npcAt(24, 40).id === "gear", "W npcAt gear");
  assert(MAP.npcAt(56, 40) && MAP.npcAt(56, 40).id === "potion", "P npcAt potion");
  const mAt = cg.npcs && cg.npcs.M;
  assert(mAt && MAP.npcAt(mAt.x, mAt.y) && MAP.npcAt(mAt.x, mAt.y).id === "barber", "M npcAt barber");
  let sAt = null;
  Object.keys(cg.cells).forEach(function (k) {
    if (cg.cells[k] === "S") {
      const p = k.split(",");
      sAt = { x: Number(p[0]), y: Number(p[1]) };
    }
  });
  assert(sAt && MAP.npcAt(sAt.x, sAt.y) && MAP.npcAt(sAt.x, sAt.y).id === "kafra", "S npcAt kafra");

  MAP.setZone("field");
  const fg = MAP.ZONES.field.grid;
  let xN = 0;
  Object.keys(fg.cells).forEach(function (k) {
    if (fg.cells[k] !== "X") return;
    xN += 1;
    const p = k.split(",");
    assert(MAP.gateAt(Number(p[0]), Number(p[1])) === "city", "X " + k + " gateAt city");
  });
  assert(xN === 9, "field X tiles === 9, got " + xN);
  MAP.setZone("bosses");
}


console.log("locked Archer bow ATK + 1st-job bow skills");
{
  const WORLD = ctx.WORLD;
  const noBow = STATS.computeBowAtk({ level: 1, str: 1, dex: 1, luk: 1 });
  assert(noBow.ok === false, "no bow → computeBowAtk ok:false, got " + noBow.ok);
  const unarmed = COMBAT.unitBowAtk(dummy({ level: 1 }), {});
  assert(!unarmed.ok, "unarmed unitBowAtk refuses bow pipeline");

  const a = STATS.computeBowAtk({
    level: 1, str: 1, dex: 1, luk: 1,
    baseWeaponAtk: 15, weaponLevel: 1, refine: 0, arrowAtk: 25,
    size: "M", variance: "mid", element: 1,
  });
  assert(a.ok && a.statusAtk === 1, "Lv1 StatusATK 1, got " + a.statusAtk);
  assert(a.weaponAtk === 15, "Lv1 WeaponATK 15, got " + a.weaponAtk);
  assert(a.extraAtk === 25, "Lv1 ExtraATK 25, got " + a.extraAtk);
  assert(a.atk === 42, "Lv1 Bow15 Arrow25 ATK 42, got " + a.atk);
  assert(Number.isInteger(a.atk) && Number.isInteger(a.weaponAtk) && Number.isInteger(a.statusAtk), "Lv1 ATK pieces are integers");

  const b = STATS.computeBowAtk({
    level: 40, str: 20, dex: 50, luk: 10,
    baseWeaponAtk: 29, weaponLevel: 1, refine: 4, arrowAtk: 25,
    size: "M", variance: "mid", element: 1,
  });
  assert(b.statusAtk === 67, "Lv40 StatusATK 67, got " + b.statusAtk);
  assert(b.refineBonus === 8, "WLv1 +4 refine +8, got " + b.refineBonus);
  assert(almost(b.statBonus, 7.25), "StatBonus 29*50/200=7.25, got " + b.statBonus);
  assert(b.weaponAtk === 44, "Composite +4 WeaponATK 44, got " + b.weaponAtk);
  assert(b.extraAtk === 25, "Composite Extra 25, got " + b.extraAtk);
  assert(b.atk === 203, "Lv40 Composite+4 ATK 203, got " + b.atk);
  assert(Number.isInteger(b.atk) && Number.isInteger(b.weaponAtk), "Lv40 ATK integers");

  const cOpts = {
    level: 99, str: 20, dex: 99, luk: 20,
    baseWeaponAtk: 125, weaponLevel: 3, refine: 5, arrowAtk: 30, equipAtk: 50,
    size: "M", variance: "mid", element: 1,
  };
  const c = STATS.computeBowAtk(cOpts);
  assert(c.statusAtk === 133, "Lv99 StatusATK 133, got " + c.statusAtk);
  assert(c.weaponAtk === 211, "Hunter WLv3 +5 WeaponATK 211, got " + c.weaponAtk);
  assert(c.extraAtk === 80, "Extra 50+30=80, got " + c.extraAtk);
  assert(c.atk === 557, "Lv99 Hunter ATK 557, got " + c.atk);
  assert(Number.isInteger(c.atk) && Number.isInteger(c.minAtk) && Number.isInteger(c.maxAtk), "Lv99 ATK integers, no float leak");

  const large = STATS.computeBowAtk(Object.assign({}, cOpts, { size: "L" }));
  assert(large.atk === 504, "same piece vs Large ATK 504, got " + large.atk);

  const vmin = STATS.computeBowAtk(Object.assign({}, cOpts, { variance: "min" }));
  const vmax = STATS.computeBowAtk(Object.assign({}, cOpts, { variance: "max" }));
  assert(c.minAtk === 539 && c.maxAtk === 576, "variance range 539–576 via mid packet, got " + c.minAtk + "-" + c.maxAtk);
  assert(vmin.atk === 539 && vmax.atk === 576, "min/max variance 539/576, got " + vmin.atk + "/" + vmax.atk);
  assert(STATS.bowVariance(3, 125, "mid") === 0, "mid variance is 0");
  assert(STATS.bowVariance(3, 125, "weird") === 0, "unknown mode still 0");
  const amp = STATS.bowVarianceAmp(3, 125);
  assert(almost(amp, 18.75), "amp 0.05*3*125=18.75, got " + amp);
  assert(almost(STATS.bowVariance(3, 125, "min"), -amp), "min is -amp");
  assert(almost(STATS.bowVariance(3, 125, "max"), amp), "max is +amp");
  const r0 = STATS.bowVariance(3, 125, "roll", { next: function () { return 0; } });
  const r1 = STATS.bowVariance(3, 125, "roll", { next: function () { return 0.999999; } });
  assert(almost(r0, -amp), "roll next=0 → -amp, got " + r0);
  assert(r1 > amp * 0.99 && r1 <= amp, "roll next≈1 → near +amp, got " + r1);
  const rr = COMBAT.createRng(7);
  const ra = STATS.bowVariance(3, 125, "roll", rr);
  const rb = STATS.bowVariance(3, 125, "roll", rr);
  assert(ra !== rb, "two seeded rolls differ, got " + ra + " " + rb);
  assert(ra >= -amp && ra <= amp && rb >= -amp && rb <= amp, "rolls stay in [-amp,+amp]");
  const rolled = STATS.computeBowAtk(Object.assign({}, cOpts, { variance: "roll", rng: COMBAT.createRng(3) }));
  assert(rolled.atk >= rolled.minAtk && rolled.atk <= rolled.maxAtk, "roll ATK in [min,max] " + rolled.atk);
  assert(rolled.minAtk === 539 && rolled.maxAtk === 576, "roll packet still reports mid fixture min/max 539–576");

  const tgt = dummy({ hardDef: 200, softDef: 103, def: 103 });
  const defDmg = COMBAT.applyBowDefense(557, tgt, { crit: false });
  assert(defDmg === 286, "ATK 557 vs Hard200 Soft103 → 286, got " + defDmg);
  const hf = STATS.hardFactor(200);
  assert(almost(hf, 0.7), "hardFactor 200 is 0.7");
  assert(Math.floor(557 * hf) === 389, "floor(557*0.7)=389");

  assert(almost(STATS.doubleStrafeMod(1), 2), "DS1 mod 2.00, got " + STATS.doubleStrafeMod(1));
  assert(almost(STATS.doubleStrafeMod(10), 3.8), "DS10 mod 3.80, got " + STATS.doubleStrafeMod(10));
  assert(almost(STATS.arrowShowerMod(1), 1.6), "AS1 mod 1.60, got " + STATS.arrowShowerMod(1));
  assert(almost(STATS.arrowShowerMod(10), 2.5), "AS10 mod 2.50, got " + STATS.arrowShowerMod(10));
  assert(STATS.arrowShowerAoe(1) === 3 && STATS.arrowShowerAoe(5) === 3, "AS AoE 3x3 at Lv1–5");
  assert(STATS.arrowShowerAoe(6) === 5 && STATS.arrowShowerAoe(10) === 5, "AS AoE 5x5 at Lv6–10");
  assert(almost(STATS.arrowRepelMod(1), 1.5), "Arrow Repel 150%");

  const ds10raw = COMBAT.bowRaw(557, { skillMod: STATS.doubleStrafeMod(10) });
  const ds10 = COMBAT.applyBowDefense(ds10raw, tgt);
  assert(ds10raw === 2116, "DS10 Raw 2116, got " + ds10raw);
  assert(ds10 === 1378, "DS10 after DEF 1378, got " + ds10);

  const as10raw = COMBAT.bowRaw(557, { skillMod: STATS.arrowShowerMod(10) });
  const as10 = COMBAT.applyBowDefense(as10raw, tgt);
  assert(as10raw === 1392, "AS10 Raw 1392, got " + as10raw);
  assert(as10 === 871, "AS10 after DEF 871, got " + as10);

  const ds1raw = COMBAT.bowRaw(557, { skillMod: STATS.doubleStrafeMod(1) });
  const ds1 = COMBAT.applyBowDefense(ds1raw, tgt);
  assert(ds1raw === 1114, "DS1 Raw 1114, got " + ds1raw);
  assert(ds1 === 676, "DS1 after DEF 676, got " + ds1);

  const rpraw = COMBAT.bowRaw(557, { skillMod: STATS.arrowRepelMod(1) });
  const rp = COMBAT.applyBowDefense(rpraw, tgt);
  assert(rpraw === 835, "Arrow Repel Raw 835, got " + rpraw);
  assert(rp === 481, "Arrow Repel after DEF 481, got " + rp);

  assert(STATS.owlEyeDex(5) === 5, "Owl 5 → +5 DEX helper");
  const owlOpts = { level: 99, str: 20, dex: 99, luk: 20, baseWeaponAtk: 125, weaponLevel: 3, refine: 5, arrowAtk: 30, equipAtk: 50, variance: "mid" };
  owlOpts.dex += STATS.owlEyeDex(5);
  assert(owlOpts.dex === 104, "Owl 5 added to opts.dex → 104, got " + owlOpts.dex);
  const owlAtk = STATS.computeBowAtk(owlOpts);
  assert(owlAtk.statusAtk === 138, "Owl 5 feeds StatusATK 133+5=138, got " + owlAtk.statusAtk);
  assert(Number.isInteger(owlAtk.atk), "owl ATK integer");

  assert(STATS.arrowAtkFrom({}) === 0, "arrowAtkFrom empty is 0 (no invented Arrow25)");
  assert(STATS.hasBowAmmo({}) === false, "hasBowAmmo empty is false");
  assert(STATS.hasBowAmmo({ arrowCount: 3 }) === true, "hasBowAmmo count>0");
  assert(STATS.arrowAtkFrom({ ammo: { arrowAtk: 25 } }) === 0, "arrowAtkFrom leftover ammo is 0");

  const gateNoArrow = COMBAT.bowSkillGate({ equip: { weapon: "weapon_bow" } });
  assert(gateNoArrow.ok, "bow without arrows still shoots, got " + JSON.stringify(gateNoArrow));
  const gateNoBow = COMBAT.bowSkillGate({ equip: {} });
  assert(!gateNoBow.ok && gateNoBow.reason === "no-bow", "no bow → combat refuses, got " + JSON.stringify(gateNoBow));
  const gateOk = COMBAT.bowSkillGate({ equip: { weapon: "weapon_bow" }, arrowCount: 1 });
  assert(gateOk.ok, "bow + ammo count gates ok");
  const gateOpt = COMBAT.bowSkillGate({ weaponClass: "bow" }, { arrowAtk: 25 });
  assert(gateOpt.ok, "opts.arrowAtk counts as ammo for tests");

  const h = PVE.createSave("hunter", DATA.emptyAllocated());
  h.owned.weapon_bow = true;
  h.owned.shield_wood = true;
  const eqBow = PVE.equipItem(h, "weapon", "weapon_bow");
  assert(eqBow.ok && h.equip.weapon === "weapon_bow", "equip bow ok");
  const eqShield = PVE.equipItem(h, "shield", "shield_wood");
  assert(!eqShield.ok, "shield rejected while bow on, reason " + (eqShield && eqShield.reason));
  assert(!h.equip.shield, "shield slot stays empty");

  const h2 = PVE.createSave("hunter", DATA.emptyAllocated());
  h2.owned.weapon_bow = true;
  h2.owned.shield_wood = true;
  const shFirst = PVE.equipItem(h2, "shield", "shield_wood");
  assert(shFirst.ok && h2.equip.shield === "shield_wood", "shield alone ok");
  const bowAfter = PVE.equipItem(h2, "weapon", "weapon_bow");
  assert(!bowAfter.ok, "bow rejected while shield on");
  assert(h2.equip.weapon == null, "weapon slot stays empty");

  assert(DATA.ITEMS.weapon_bow.weaponAtk === 60 && DATA.ITEMS.weapon_oakbow.weaponAtk === 100 && DATA.ITEMS.weapon_hawk.weaponAtk === 150, "shop bow ATK unchanged");
  assert(DATA.ITEMS.weapon_bow.twoHand === true && DATA.ITEMS.weapon_bow.weaponLevel === 1, "bows twoHand + WLv1");
  assert(!DATA.ITEMS.weapon_hunter && !DATA.ITEMS.hunter_bow, "no invented Hunter Bow 125 item");
  assert(!!DATA.SKILLS.double_strafe && !!DATA.SKILLS.arrow_shower && !!DATA.SKILLS.arrow_repel, "new skill ids in DATA.SKILLS");
  assert(!!DATA.SKILLS.owl_eye && !!DATA.SKILLS.vulture_eye && !!DATA.SKILLS.improve_concentration, "passives in DATA.SKILLS");
  assert(!!DATA.SKILLS.arrowshot, "old hunter skills kept");
  assert(DATA.HEROES.hunter.skills.indexOf("arrowshot") < 0, "HEROES.hunter must not include arrowshot");
  const officialH = ["owl_eye", "vulture_eye", "double_strafe", "arrow_shower", "improve_concentration", "arrow_repel"];
  officialH.forEach(function (id) {
    assert(DATA.HEROES.hunter.skills.indexOf(id) >= 0, "HEROES.hunter has " + id);
  });
  const treeIds = DATA.SKILL_TREES.hunter.map(function (n) { return n.id; });
  officialH.forEach(function (id) {
    assert(treeIds.indexOf(id) >= 0, "tree has " + id);
  });
  ["arrowshot", "powershot", "focus", "soularrow", "rain", "mark"].forEach(function (id) {
    assert(treeIds.indexOf(id) < 0, "tree must not include " + id);
    assert(!!DATA.SKILLS[id], "old def " + id + " kept in DATA.SKILLS");
  });

  const kb = { x: 10, y: 10 };
  const delta = COMBAT.knockbackTiles(kb, { x: 8, y: 10 }, 2);
  assert(delta.dx === 2 && delta.dy === 0 && kb.x === 12, "knockback 2 tiles away, got " + delta.dx + "," + delta.dy + " pos " + kb.x);
  const blocked = COMBAT.knockbackTiles({ x: 5, y: 5 }, { x: 4, y: 5 }, 6, function (x) { return x <= 7; });
  assert(blocked.dx === 2, "knockback stops when unwalkable, dx " + blocked.dx);
  assert(typeof WORLD.knockback === "function", "WORLD.knockback exists");

  const hd = STATS.computeHeroStats("hunter", DATA.emptyAllocated(), DATA.emptyEquip(), 1);
  hd.skillRanks = { double_strafe: 10 };
  hd.skills = ["double_strafe"];
  const hero = COMBAT.createUnit(hd, "left");
  hero.mp = 200;
  const bd = STATS.computeBossStats(DATA.BOSSES[0]);
  const boss = COMBAT.createUnit(bd, "right");
  const st = COMBAT.createState(hero, boss, { seed: 1 });
  const refused = COMBAT.heroSkill(st, hero, "double_strafe");
  assert(!refused.ok && refused.reason === "no-bow", "DS without bow refused, got " + JSON.stringify(refused));

  const eq = DATA.emptyEquip();
  eq.weapon = "weapon_bow";
  const bowed = STATS.computeHeroStats("hunter", DATA.emptyAllocated(), eq, 1, {}, { skillRanks: { owl_eye: 5 }, arrowAtk: 25 });
  assert(bowed.bowAtk && bowed.bowAtk.ok, "computeHeroStats bow sets bowAtk");
  assert(bowed.owlDex === 5, "Owl 5 on computeHeroStats extra, got " + bowed.owlDex);
  assert(typeof bowed.atk === "number", "legacy atk still present");
  assert(DATA.ITEMS.weapon_bow.weaponAtk === 60, "weapon_bow ATK still 60");

  assert(almost(STATS.improveConcentrationPct(1), 0.03), "Conc Lv1 +3%");
  assert(STATS.improveConcentrationDuration(1) === 60, "Conc Lv1 60s");
  assert(almost(STATS.improveConcentrationPct(10), 0.12) && STATS.improveConcentrationDuration(10) === 240, "Conc Lv10 +12% / 240s");
}

console.log("arrow catalog v1");
{
  assert(DATA.ITEMS.arrow.arrowAtk === 25, "arrow.arrowAtk 25, got " + DATA.ITEMS.arrow.arrowAtk);
  assert(DATA.ITEMS.arrow_steel.arrowAtk === 40, "arrow_steel.arrowAtk 40, got " + DATA.ITEMS.arrow_steel.arrowAtk);
  assert(DATA.ITEMS.arrow_oridecon.arrowAtk === 50, "arrow_oridecon.arrowAtk 50, got " + DATA.ITEMS.arrow_oridecon.arrowAtk);
  ["arrow", "arrow_steel", "arrow_oridecon"].forEach(function (id) {
    const it = DATA.ITEMS[id];
    assert(it.type === "ammo" && it.element === "none" && it.stack === true, id + " shape ammo/none/stack");
    assert(it.jobs === DATA.JOB_BOW, id + " jobs JOB_BOW");
    assert(it.arrowAtk > 0, id + " arrowAtk not 0");
    assert(DATA.itemWeight(id) === 1, id + " weight 1g, got " + DATA.itemWeight(id));
  });
  assert(DATA.ITEMS.arrow.reqLevel === 1 && DATA.ITEMS.arrow.price === 1 && DATA.ITEMS.arrow.name === "ลูกธนู", "arrow name/lv/price");
  assert(DATA.ITEMS.arrow_steel.reqLevel === 12 && DATA.ITEMS.arrow_steel.price === 4, "steel lv/price");
  assert(DATA.ITEMS.arrow_oridecon.reqLevel === 32 && DATA.ITEMS.arrow_oridecon.price === 10, "oridecon lv/price");
  assert(DATA.ITEMS.weapon_bow.weaponAtk === 60 && DATA.ITEMS.weapon_oakbow.weaponAtk === 100 && DATA.ITEMS.weapon_hawk.weaponAtk === 150, "bows still 60/100/150");
  assert(DATA.ITEMS.weapon_bow.twoHand === true && DATA.ITEMS.weapon_oakbow.twoHand === true && DATA.ITEMS.weapon_hawk.twoHand === true, "bows twoHand");
  assert(DATA.ITEMS.weapon_bow.weaponLevel === 1 && DATA.ITEMS.weapon_oakbow.weaponLevel === 1 && DATA.ITEMS.weapon_hawk.weaponLevel === 1, "bows WLv1");
  assert(!DATA.ITEMS.weapon_hunter && !DATA.ITEMS.hunter_bow, "no Hunter Bow 125");
  const ammoIds = Object.keys(DATA.ITEMS).filter(function (id) { return DATA.ITEMS[id].type === "ammo"; });
  assert(ammoIds.length === 3, "no extra arrow ids, got " + ammoIds.join(","));
  assert(!DATA.ITEMS.arrow_fire && !DATA.ITEMS.arrow_silver && !DATA.ITEMS.arrow_holy, "no element arrows");

  const hunter = PVE.createSave("hunter", DATA.emptyAllocated());
  assert(hunter.ammo && hunter.ammo.id === "arrow" && hunter.ammo.count === 100, "hunter createSave ammo 100, got " + JSON.stringify(hunter.ammo));
  assert(hunter.arrowCount === 100, "hunter arrowCount 100");
  assert(STATS.arrowAtkFrom(hunter) === 0, "hunter start arrowAtkFrom 0, got " + STATS.arrowAtkFrom(hunter));
  assert(STATS.arrowCountFrom(hunter) === 100, "hunter start arrowCountFrom 100");
  assert(STATS.hasBowAmmo(hunter) === true, "hunter start hasBowAmmo true");

  const warrior = PVE.createSave("warrior", DATA.emptyAllocated());
  assert(STATS.hasBowAmmo(warrior) === false, "warrior createSave hasBowAmmo false");
  assert(STATS.arrowAtkFrom(warrior) === 0, "warrior arrowAtkFrom 0, got " + STATS.arrowAtkFrom(warrior));

  hunter.owned.weapon_bow = true;
  const eq = PVE.equipItem(hunter, "weapon", "weapon_bow");
  assert(eq.ok, "hunter equip weapon_bow");
  const der = PVE.derived(hunter);
  assert(der.bowAtk && der.bowAtk.ok, "derived bowAtk ok");
  assert(der.bowAtk.extraAtk === 0, "hunter start + weapon_bow ExtraATK 0, got " + der.bowAtk.extraAtk);
  const mid = STATS.computeBowAtk({
    weapon: "weapon_bow",
    level: hunter.level || 1,
    str: 0,
    dex: 0,
    luk: 0,
    arrowAtk: 25,
    variance: "mid",
    size: "M",
  });
  assert(mid.ok && mid.extraAtk === 25, "computeBowAtk mid Medium ExtraATK 25, got " + mid.extraAtk);
  assert(der.bowAtk.extraAtk === 0, "hunter-save ExtraATK is 0");

  const spent = PVE.createSave("hunter", DATA.emptyAllocated());
  spent.ammo.count = 7;
  spent.arrowCount = 7;
  PVE.ensureProgress(spent);
  assert(spent.ammo.count === 7 && spent.arrowCount === 7, "ensureProgress does not refill spent arrows");
  const missing = { heroId: "hunter", allocated: DATA.emptyAllocated(), equip: DATA.emptyEquip() };
  PVE.ensureProgress(missing);
  assert(missing.ammo && missing.ammo.id === "arrow" && missing.ammo.count === 100, "ensureProgress fills missing hunter ammo to 100");

  const buyH = PVE.createSave("hunter", DATA.emptyAllocated());
  const z0 = buyH.zeno;
  const c0 = buyH.ammo.count;
  const b1 = PVE.buyAmmo(buyH, "arrow", 1);
  assert(!b1.ok && /ลูกธนู/.test(b1.reason || ""), "shop no longer sells arrows");
  assert(buyH.zeno === z0 && buyH.ammo.count === c0, "buyAmmo blocked leaves zeno/count");
  assert(DATA.AMMO_ORDER.length === 0, "AMMO_ORDER empty so shop lists no arrows");
  assert(COMBAT.hasBowAmmoForCombat({ arrowCount: 0 }) === true, "archer fires with 0 arrows");
  const noConsume = COMBAT.consumeBowAmmo({ arrowCount: 5 });
  assert(noConsume.ok && noConsume.skipped, "consumeBowAmmo is a no-op");
  const worldSrc = readFileSync(join(root, "js", "world.js"), "utf8");
  assert(worldSrc.indexOf("ไม่มีลูกธนู") < 0, "world.js has no ไม่มีลูกธนู toast");
  assert(COMBAT.bowSkillGate({ weaponClass: "bow", arrowCount: 0 }).ok === true, "bowSkillGate bow+0 arrows ok");
  assert(COMBAT.bowSkillGate({}).reason === "no-bow", "bowSkillGate empty reason no-bow");
}

console.log("field mob respawn 20-30s");
{
  assert(DATA.FIELD_RESPAWN_MS_MIN === 20000, "FIELD_RESPAWN_MS_MIN 20000, got " + DATA.FIELD_RESPAWN_MS_MIN);
  assert(DATA.FIELD_RESPAWN_MS_MAX === 30000, "FIELD_RESPAWN_MS_MAX 30000, got " + DATA.FIELD_RESPAWN_MS_MAX);
  assert(DATA.BOSS_RESPAWN_MS === 8000, "BOSS_RESPAWN_MS still 8000, got " + DATA.BOSS_RESPAWN_MS);
  assert(typeof DATA.fieldRespawnMs === "function", "fieldRespawnMs helper exists");

  const rng = COMBAT.createRng(1);
  let allIntInRange = true;
  const seen = {};
  for (let i = 0; i < 200; i++) {
    const v = DATA.fieldRespawnMs(rng);
    if (typeof v !== "number" || v !== (v | 0) || v < 20000 || v > 30000) allIntInRange = false;
    seen[v] = (seen[v] || 0) + 1;
  }
  assert(allIntInRange, "200 seeded rolls are integers in [20000, 30000]");
  assert(Object.keys(seen).length > 1, "seeded rolls show variance, unique=" + Object.keys(seen).length);

  const lo = DATA.fieldRespawnMs({ next: function () { return 0; } });
  const hi = DATA.fieldRespawnMs({ next: function () { return 0.999999; } });
  assert(lo === 20000, "rng.next 0 → 20000, got " + lo);
  assert(hi === 30000, "rng.next 0.999999 → 30000, got " + hi);

  const seq = COMBAT.createRng(1);
  const a = DATA.fieldRespawnMs(seq);
  const b = DATA.fieldRespawnMs(seq);
  assert(a !== b, "two sequential seeded rolls differ, got " + a + " and " + b);

  MAP.resetField();
  MAP.setZone("field");
  const mobs = MAP.listFieldSpawns();
  assert(mobs.length > 0, "field has mobs after reset/list, got " + mobs.length);
  const m = mobs[0];
  const t0 = Date.now();
  MAP.markMobDead(m.x, m.y);
  const t1 = Date.now();
  const after = MAP.listFieldSpawns().find(function (s) { return s.uid === m.uid || (s.x === m.x && s.y === m.y); });
  assert(after && after.deadUntil, "markMobDead set deadUntil, got " + (after && after.deadUntil));
  const du = after.deadUntil;
  assert(du >= t0 + 20000 && du <= t1 + 30000, "deadUntil in [now+20000, now+30000], delta=" + (du - t0) + " window=[" + (t0 + 20000) + "," + (t1 + 30000) + "]");
  assert(MAP.monsterAt(m.x, m.y) === null, "marked mob is not living at tile");

  const worldSrc = readFileSync(join(root, "js", "world.js"), "utf8");
  const mapSrc = readFileSync(join(root, "js", "map.js"), "utf8");
  assert(worldSrc.indexOf("DATA.fieldRespawnMs(S.rng)") >= 0, "world.js onDeath calls fieldRespawnMs(S.rng)");
  assert(mapSrc.indexOf("DATA.fieldRespawnMs()") >= 0, "map.js markMobDead calls fieldRespawnMs()");
  assert(!/FIELD_RESPAWN_MS\s*===\s*4000/.test(worldSrc) && !/FIELD_RESPAWN_MS\s*\|\|\s*4000/.test(worldSrc), "world.js has no FIELD_RESPAWN_MS === 4000 / || 4000");
  assert(!/FIELD_RESPAWN_MS\s*===\s*4000/.test(mapSrc) && !/FIELD_RESPAWN_MS\s*\|\|\s*4000/.test(mapSrc), "map.js has no FIELD_RESPAWN_MS === 4000 / || 4000");
  MAP.setZone("bosses");
}

console.log("auto farm mob picker");
{
  const save = PVE.createSave("warrior", DATA.emptyAllocated());
  assert(Array.isArray(save.autoFarmCfg.mobIds) && save.autoFarmCfg.mobIds.length === 0, "createSave mobIds []");
  assert(save.autoFarmCfg.mobNone === false, "createSave mobNone false");
  assert(PVE.farmAllowsMob(save, "poring") === true, "farmAllowsMob true when mobIds empty");
  assert(PVE.farmAllowsMob(save, "fabre") === true, "farmAllowsMob true for any when empty");

  PVE.toggleFarmMob(save, "poring");
  assert(save.autoFarmCfg.mobIds.length === 1 && save.autoFarmCfg.mobIds[0] === "poring", "toggleFarmMob stores [poring]");
  assert(save.autoFarmCfg.mobNone === false, "toggleFarmMob clears mobNone");
  assert(PVE.farmAllowsMob(save, "poring") === true, "after toggleFarmMob(poring) only poring allowed");
  assert(PVE.farmAllowsMob(save, "fabre") === false, "after toggleFarmMob(poring) fabre denied");

  PVE.setFarmMobsAll(save);
  assert(save.autoFarmCfg.mobIds.length === 0 && save.autoFarmCfg.mobNone === false, "setFarmMobsAll restores allow-all");
  assert(PVE.farmAllowsMob(save, "fabre") === true, "setFarmMobsAll allows all");

  PVE.setFarmMobsNone(save);
  assert(save.autoFarmCfg.mobNone === true && save.autoFarmCfg.mobIds.length === 0, "setFarmMobsNone sets mobNone");
  assert(PVE.farmAllowsMob(save, "poring") === false, "setFarmMobsNone allows none");
  assert(PVE.farmAllowsMob(save, "skeleton") === false, "setFarmMobsNone denies every id");

  PVE.toggleFarmMob(save, "lunatic");
  assert(save.autoFarmCfg.mobNone === false && save.autoFarmCfg.mobIds[0] === "lunatic", "toggle after none adds lunatic");

  const ids = PVE.fieldMonsterIds();
  const need = ["poring", "fabre", "lunatic", "willow", "condor", "wolf", "poporing", "chonchon", "roda_frog", "spore", "rocker", "steel_chonchon", "savage_babe", "elder_willow", "skeleton"];
  assert(need.every(function (id) { return ids.indexOf(id) >= 0; }), "fieldMonsterIds includes Prontera field bands");
  assert(ids.length === new Set(ids).size, "fieldMonsterIds unique");

  const cat = PVE.farmMobCatalog(save);
  assert(Array.isArray(cat) && cat.length >= need.length, "farmMobCatalog returns field list");
  const poring = cat.find(function (m) { return m.id === "poring"; });
  assert(!!poring && !!poring.portrait && !!poring.name, "farmMobCatalog poring has portrait+name");
  assert(poring.name === "โปริ่ง", "farmMobCatalog poring Thai name");

  const dirty = PVE.createSave("warrior", DATA.emptyAllocated());
  dirty.autoFarmCfg.mobIds = ["poring", "poring", "not_a_mob", "fabre", "__none__"];
  const cleaned = PVE.ensureAutoFarmCfg(dirty);
  assert(cleaned.mobIds.join(",") === "poring,fabre", "ensureAutoFarmCfg unique + strip unknown");
  assert(cleaned.mobNone === false, "real ids clear __none__ sentinel / mobNone");

  const bossSave = PVE.createSave("warrior", DATA.emptyAllocated());
  bossSave.mapId = "bosses";
  const bosses = PVE.farmMobCatalog(bossSave);
  assert(bosses.length === DATA.BOSSES.length && bosses[0].id === DATA.BOSSES[0].id, "farmMobCatalog bosses map uses DATA.BOSSES");

  const all = PVE.createSave("warrior", DATA.emptyAllocated());
  PVE.fieldMonsterIds().forEach(function (id) { PVE.toggleFarmMob(all, id); });
  assert(all.autoFarmCfg.mobIds.length === 0 && all.autoFarmCfg.mobNone === false, "selecting full catalog stores [] (all)");
  assert(PVE.farmAllowsMob(all, "poring") === true, "full catalog selection allows all");
}

console.log("pickFarmTarget honors farmAllowsMob");
{
  const WORLD = ctx.WORLD;
  MAP.setZone("field");
  const g = MAP.ZONES.field.grid;
  const saved = [];
  function setWalk(x, y, on) {
    saved.push({ x: x, y: y, walk: !!(g.walkable[y] && g.walkable[y][x]) });
    if (!g.walkable[y]) g.walkable[y] = [];
    g.walkable[y][x] = on;
  }
  try {
    for (let y = 88; y <= 92; y++) {
      for (let x = 8; x <= 14; x++) setWalk(x, y, true);
    }
    const player = { x: 10, y: 90, kind: "player" };
    const poring = { id: "m-poring", kind: "mob", monsterId: "poring", x: 13, y: 90, dead: false };
    const fabre = { id: "m-fabre", kind: "mob", monsterId: "fabre", x: 11, y: 90, dead: false };
    const save = PVE.createSave("warrior", DATA.emptyAllocated());
    assert(WORLD.pickFarmTarget(player, [poring, fabre], save) === fabre, "empty mobIds picks nearest (fabre)");
    PVE.toggleFarmMob(save, "poring");
    assert(WORLD.pickFarmTarget(player, [poring, fabre], save) === poring, "poring-only skips closer fabre");
    PVE.setFarmMobsNone(save);
    assert(WORLD.pickFarmTarget(player, [poring, fabre], save) === null, "mobNone picks nobody");
    PVE.setFarmMobsAll(save);
    assert(WORLD.pickFarmTarget(player, [poring, fabre], save) === fabre, "all types picks nearest fabre again");
  } finally {
    saved.reverse().forEach(function (c) {
      if (!g.walkable[c.y]) g.walkable[c.y] = [];
      g.walkable[c.y][c.x] = c.walk;
    });
  }
}

console.log("farm idle does not wait CD");
{
  const WORLD = ctx.WORLD;
  assert(typeof WORLD.tryFarmBasic === "function", "WORLD.tryFarmBasic exported");
  assert(typeof WORLD.pickFarmTarget === "function", "pickFarmTarget exported");

  MAP.setZone("field");
  const g = MAP.ZONES.field.grid;
  const saved = [];
  function setWalk(x, y, on) {
    saved.push({ x: x, y: y, walk: !!(g.walkable[y] && g.walkable[y][x]) });
    if (!g.walkable[y]) g.walkable[y] = [];
    g.walkable[y][x] = on;
  }
  try {
    for (let y = 88; y <= 92; y++) {
      for (let x = 8; x <= 16; x++) setWalk(x, y, true);
    }
    const player = { x: 10, y: 90, kind: "player" };
    const a = { id: "m-a", kind: "mob", monsterId: "poring", x: 12, y: 90, dead: false };
    const b = { id: "m-b", kind: "mob", monsterId: "poring", x: 15, y: 90, dead: false };
    const save = PVE.createSave("warrior", DATA.emptyAllocated());
    assert(WORLD.pickFarmTarget(player, [a, b], save) === a, "nearest is a");
    const skip = { "m-a": true };
    assert(WORLD.pickFarmTarget(player, [a, b], save, skip) === b, "skip a picks b");
    assert(WORLD.pickFarmTarget(player, [a], save, skip) === null, "skip only candidate is empty");
  } finally {
    saved.reverse().forEach(function (c) {
      if (!g.walkable[c.y]) g.walkable[c.y] = [];
      g.walkable[c.y][c.x] = c.walk;
    });
  }

  const host = { querySelector: function () { return null; } };
  const farm = PVE.createSave("hunter", DATA.emptyAllocated());
  farm.mapId = "field";
  farm.autoFarm = true;
  PVE.ensureAutoFarmCfg(farm);
  farm.autoFarmCfg.skills = ["double_strafe", null, null, null];
  try {
    WORLD.mount(host, farm);
    const unit = WORLD.playerUnit();
    assert(!!unit, "mounted hunter unit");
    if (unit) {
      unit.cds = unit.cds || {};
      unit.cds.double_strafe = 9999;
    }
    const p = WORLD.playerEntity && WORLD.playerEntity();
    const picked = WORLD.pickFarmSkill(farm, p || { unit: unit, x: 5, y: 94 }, { x: 6, y: 94, unit: { hp: 1 } });
    assert(picked == null, "farm skill on CD is not picked");
    if (p) p.atkReadyAt = Date.now() + 5000;
    assert(WORLD.tryFarmBasic(p || { unit: unit, atkReadyAt: Date.now() + 5000 }) === false, "tryFarmBasic respects atkReadyAt");
  } finally {
    WORLD.teardown();
  }
}

console.log("auto farm yields to manual input");
{
  const WORLD = ctx.WORLD;
  assert(typeof MAP.markManual === "function" && typeof MAP.isManual === "function", "MAP.markManual / isManual exported");
  assert(typeof WORLD.noteManual === "function" && typeof WORLD.isManual === "function", "WORLD.noteManual / isManual exported");
  MAP.markManual(2000);
  assert(MAP.isManual() === true, "markManual(2000) is manual immediately");
  MAP.markManual(0);
  assert(MAP.isManual() === false, "markManual(0) is not manual");
  MAP.markManual(-5);
  assert(MAP.isManual() === false, "expired manual window is not manual");
  MAP.markManual(1800);
  assert(MAP.isManual() === true, "default-length 1800 window is manual");
  MAP.markManual(0);
}


console.log("WORLD.syncLiveHero live snapshot");
{
  const WORLD = ctx.WORLD;
  const host = { querySelector: function () { return null; } };
  MAP.setZone("field");

  const save = PVE.createSave("hunter", DATA.emptyAllocated());
  save.mapId = "field";
  save.skillRanks = Object.assign(DATA.defaultSkillRanks("hunter"), save.skillRanks || {});
  try {
    WORLD.mount(host, save);
    const unit0 = WORLD.playerUnit();
    assert(!!unit0, "mount builds player unit");
    const oldHit = unit0.hit;
    const oldAtk = unit0.atk;
    const oldRange = WORLD.skillRange(WORLD.playerEntity(), "arrowshot");
    assert(oldRange === 10, "pre-sync bow range 10, got " + oldRange);
    const oldOwl = (unit0.skillRanks && unit0.skillRanks.owl_eye) || 0;
    assert(oldOwl === 0 || oldOwl < 5, "pre-sync owl_eye below 5, got " + oldOwl);

    unit0.hp = Math.max(1, Math.floor(unit0.maxHp / 2));
    const keepHp = unit0.hp;
    save.skillRanks.owl_eye = 5;
    save.skillRanks.vulture_eye = 3;
    save.allocated.dex = (save.allocated.dex || 0) + 10;

    const ok = WORLD.syncLiveHero(save);
    assert(ok === true, "syncLiveHero returns true");
    const unit1 = WORLD.playerUnit();
    assert(unit1 && unit1 !== unit0, "sync replaces unit object");
    assert(unit1.skillRanks.owl_eye === 5, "skillRanks.owl_eye === 5, got " + unit1.skillRanks.owl_eye);
    assert(unit1.hit > oldHit, "hit increased " + oldHit + " → " + unit1.hit);
    assert(unit1.atk !== oldAtk, "atk changed " + oldAtk + " → " + unit1.atk);
    const newRange = WORLD.skillRange(WORLD.playerEntity(), "arrowshot");
    assert(newRange === 11, "range 10→11 with vulture 3, got " + oldRange + " → " + newRange);
    assert(unit1.hp === keepHp, "hp preserved at " + keepHp + ", got " + unit1.hp);

    unit1.cds.double_strafe = 2;
    unit1.poisons = [{ damage: 1, turns: 2, src: "x" }];
    const ok2 = WORLD.syncLiveHero(save);
    assert(ok2 === true, "second syncLiveHero returns true");
    const unit2 = WORLD.playerUnit();
    assert(unit2 !== unit1, "second sync replaces unit object");
    assert(unit2.cds && unit2.cds.double_strafe === 2, "cds.double_strafe preserved, got " + (unit2.cds && unit2.cds.double_strafe));
    assert(Array.isArray(unit2.poisons) && unit2.poisons.length === 1 && unit2.poisons[0].src === "x", "poisons preserved");
    assert(unit2.poisons[0].damage === 1 && unit2.poisons[0].turns === 2, "poison payload intact");
  } finally {
    WORLD.teardown();
  }

  const wsave = PVE.createSave("warrior", DATA.emptyAllocated());
  wsave.mapId = "field";
  PVE.ensureAutoFarmCfg(wsave);
  wsave.autoFarmCfg.skills = [null, null, null, null];
  const setAtk = PVE.setFarmSkill(wsave, 0, "bash");
  assert(setAtk.ok, "setFarmSkill bash ok, " + (setAtk.reason || ""));
  try {
    WORLD.mount(host, wsave);
    const ok3 = WORLD.syncLiveHero(wsave);
    assert(ok3 === true, "warrior syncLiveHero returns true");
    const wu = WORLD.playerUnit();
    assert(wu.skills && wu.skills.indexOf("bash") >= 0, "new unit.skills includes learned bash");
    const pent = WORLD.playerEntity();
    const foe = { x: pent.x + 1, y: pent.y, dead: false, unit: { hp: 10, maxHp: 10 } };
    const picked = WORLD.pickFarmSkill(wsave, pent, foe);
    assert(picked === "bash", "pickFarmSkill sees learned bash from new unit, got " + picked);
  } finally {
    WORLD.teardown();
  }
}

console.log("sit pose sprites");
{
  const FX = ctx.FX;
  const WORLD = ctx.WORLD;
  const heroes = ["warrior", "assassin", "hunter"];
  const dirs = ["s", "se", "e", "n"];
  heroes.forEach(function (hid) {
    dirs.forEach(function (d) {
      const rel = "assets/chars/" + hid + "_sit_" + d + ".png";
      assert(existsSync(join(root, rel)), "exists " + rel);
    });
  });
  const wSitS = FX.spriteSrc("warrior", { heroId: "warrior", facing: "s", sitting: true });
  assert(wSitS === "assets/chars/warrior_sit_s.png", "warrior sitting s, got " + wSitS);
  const aSitW = FX.spriteSrc("assassin", { heroId: "assassin", facing: "w", sitting: true });
  assert(aSitW === "assets/chars/assassin_sit_e.png", "assassin sitting w flips to e, got " + aSitW);
  const hSitNw = FX.spriteSrc("hunter", { heroId: "hunter", facing: "nw", sitting: true });
  assert(hSitNw === "assets/chars/hunter_sit_n.png", "hunter sitting nw uses n, got " + hSitNw);
  const hSitSe = FX.spriteSrc("hunter", { heroId: "hunter", facing: "se", sitting: true });
  assert(hSitSe === "assets/chars/hunter_sit_se.png", "hunter sitting se, got " + hSitSe);
  const wStand = FX.spriteSrc("warrior", { heroId: "warrior", facing: "s" });
  assert(wStand === "assets/chars/warrior_s.png", "standing warrior s not sit, got " + wStand);
  assert(typeof WORLD.setSitting === "function", "WORLD.setSitting exists");
  assert(typeof MAP.setSitting === "function", "MAP.setSitting exists");
  const css = readFileSync(join(root, "css/style.css"), "utf8");
  assert(css.indexOf("sitRest") >= 0, "css contains sitRest");
  assert(/1\.6s/.test(css), "css contains 1.6s");
  const sitRule = css.match(/\.map-avatar\.sitting[^{]*\{[^}]*\}/);
  assert(!!sitRule, "css has .map-avatar.sitting rule");
  assert(sitRule && sitRule[0].indexOf("scaleY") < 0, "sitting rule has no scaleY squash");
  const sitKf = css.match(/@keyframes sitRest\s*\{[\s\S]*?\n\}/);
  assert(!!sitKf, "css has sitRest keyframes");
  assert(sitKf && sitKf[0].indexOf("scaleY") < 0, "sitRest keyframes have no scaleY");
}

console.log("swordsman sprites, ready stance, barber hair");
{
  const FX = ctx.FX;
  const WORLD = ctx.WORLD;
  const nWalk = FX.spriteSrc("warrior", { heroId: "warrior", facing: "n", walkFrame: 1 });
  assert(nWalk === "assets/chars/warrior_n_w1.png", "warrior north walk uses n_w1, got " + nWalk);
  const eWalk = FX.spriteSrc("warrior", { heroId: "warrior", facing: "e", walkFrame: 2 });
  assert(eWalk === "assets/chars/warrior_e_w2.png", "warrior east walk uses e_w2, got " + eWalk);
  const idleN = FX.spriteSrc("warrior", { heroId: "warrior", facing: "n" });
  assert(idleN === "assets/chars/warrior_n.png", "warrior idle north unarmed, got " + idleN);
  const ready = FX.spriteSrc("warrior", { heroId: "warrior", facing: "s", pose: "ready" });
  assert(ready === "assets/chars/warrior_ready_s.png", "ready pose s, got " + ready);
  const readyE = FX.spriteSrc("warrior", { heroId: "warrior", facing: "e", pose: "ready" });
  assert(readyE === "assets/chars/warrior_ready_e.png", "ready pose e, got " + readyE);
  const hit = FX.spriteSrc("warrior", { heroId: "warrior", facing: "s", pose: "hit", poseUntil: Date.now() + 400 });
  assert(hit === "assets/chars/warrior_hit_s.png", "hit pose, got " + hit);
  const skill = FX.spriteSrc("warrior", { heroId: "warrior", facing: "s", pose: "skill", poseUntil: Date.now() + 400 });
  assert(skill === "assets/chars/warrior_skill_s.png", "skill pose, got " + skill);
  const afterHit = FX.spriteSrc("warrior", {
    heroId: "warrior",
    facing: "s",
    pose: "hit",
    poseUntil: Date.now() - 10,
    combatUntil: Date.now() + 2000,
  });
  assert(afterHit === "assets/chars/warrior_ready_s.png", "expired hit while in combat → ready, got " + afterHit);
  const files = [
    "warrior_s.png", "warrior_e.png", "warrior_n.png", "warrior_se.png",
    "warrior_s_w1.png", "warrior_s_w2.png", "warrior_e_w1.png", "warrior_n_w1.png",
    "warrior_sit_s.png", "warrior_sit_e.png", "warrior_sit_n.png",
    "warrior_hit_s.png", "warrior_skill_s.png",
    "warrior_ready_s.png", "warrior_ready_e.png", "warrior_ready_n.png",
    "warrior_ready_w.png",
    "warrior_atk_s.png", "warrior_atk_1.png", "warrior_atk_2.png",
  ];
  files.forEach(function (name) {
    assert(existsSync(join(root, "assets/chars/" + name)), "exists assets/chars/" + name);
  });
  const save = PVE.createSave("warrior", {}, "Tester");
  assert(save.hairColor === "blonde", "new save default hair blonde, got " + save.hairColor);
  save.hairColor = "blue";
  PVE.ensureProgress(save);
  assert(save.hairColor === "blue", "ensureProgress keeps hairColor");
  const unit = PVE.buildHeroUnit(save);
  assert(unit.hairColor === "blue", "buildHeroUnit copies hairColor");
  assert(DATA.HAIR_COLOR_IDS.length >= 6, "at least 6 hair colors");
  assert(DATA.defaultHairColor("nope") === "blonde", "invalid hair falls back to blonde");
  assert(FX.hairColorOf({ hairColor: "red" }) === "red", "hairColorOf red");
  assert(FX.SPRITE_VER === "ui3-swordsman-2", "sprite cache bump ui3-swordsman-2");
  assert(typeof WORLD.setCombatPose === "function" && typeof WORLD.clearCombatPose === "function", "WORLD pose helpers");
}

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exit(1);

console.log("sell and drop");
{
  assert(DATA.sellZeno(100) === 50, "sellZeno(100)===50, got " + DATA.sellZeno(100));
  assert(DATA.sellZeno(1) === 1, "sellZeno(1)===1, got " + DATA.sellZeno(1));
  assert(DATA.sellZeno(3) === 1, "sellZeno(3)===1, got " + DATA.sellZeno(3));
  assert(DATA.sellZeno(0) === 0, "sellZeno(0)===0, got " + DATA.sellZeno(0));
  assert(DATA.sellZeno(-5) === 0, "sellZeno(-5)===0, got " + DATA.sellZeno(-5));
  assert(DATA.sellZeno(undefined) === 0, "sellZeno(undefined)===0, got " + DATA.sellZeno(undefined));

  assert(PVE.inProntera({}) === true, "inProntera missing mapId true");
  assert(PVE.inProntera({ mapId: "city" }) === true, "inProntera city true");
  assert(PVE.inProntera({ mapId: "field" }) === false, "inProntera field false");
  assert(PVE.inProntera({ mapId: "bosses" }) === false, "inProntera bosses false");

  const w = PVE.createSave("warrior", DATA.emptyAllocated());
  w.zeno = 10000;
  w.owned.helm_leather = true;
  w.equip.helm = "helm_leather";
  w.refine.helm_leather = 2;
  const wBefore = PVE.carryWeight(w);
  const z0 = w.zeno;
  const soldHelm = PVE.sellItem(w, "helm_leather", 1);
  assert(soldHelm.ok === true, "sell helm_leather ok");
  assert(soldHelm.kind === "gear" && soldHelm.qty === 1, "sell gear kind/qty");
  assert(soldHelm.zeno === 40, "helm_leather price 80 → +40 zeno, got " + soldHelm.zeno);
  assert(w.zeno === z0 + 40, "save.zeno increased by 40");
  assert(!w.owned.helm_leather, "owned.helm_leather cleared");
  assert(w.refine.helm_leather == null, "refine.helm_leather gone");
  assert(w.equip.helm !== "helm_leather", "unequipped from helm slot");
  assert(PVE.carryWeight(w) === wBefore - DATA.itemWeight("helm_leather"), "weight down after sell gear");
  assert(soldHelm.toast === "ขาย " + DATA.lootName("helm_leather") + " ×1 · +40 Zeno", "gear sell toast");

  const w7 = PVE.createSave("warrior", DATA.emptyAllocated());
  w7.zeno = 10000;
  w7.owned.helm_leather = true;
  w7.refine.helm_leather = 7;
  const sold7 = PVE.sellItem(w7, "helm_leather");
  assert(sold7.ok && sold7.zeno === 40, "+7 refined helm still pays 40 not more, got " + sold7.zeno);

  const noOwn = PVE.createSave("warrior", DATA.emptyAllocated());
  noOwn.zeno = 10000;
  const zNo = noOwn.zeno;
  const miss = PVE.sellItem(noOwn, "helm_leather");
  assert(!miss.ok && miss.reason === "ไม่มี", "cannot sell unowned gear, reason " + miss.reason);
  assert(noOwn.zeno === zNo, "unowned sell leaves zeno unchanged");

  const pot = PVE.createSave("warrior", DATA.emptyAllocated());
  pot.zeno = 10000;
  assert((pot.potions.orange || 0) === 2, "warrior starts with 2 orange");
  const pw = PVE.carryWeight(pot);
  const pz = pot.zeno;
  const soldOrange = PVE.sellItem(pot, "orange", 2);
  assert(soldOrange.ok === true, "sell 2 orange ok");
  assert(soldOrange.zeno === 80, "2 orange × 40 = +80, got " + soldOrange.zeno);
  assert(pot.zeno === pz + 80, "zeno +80 after orange");
  assert((pot.potions.orange || 0) === 0, "potions.orange -= 2");
  assert(PVE.carryWeight(pot) === pw - 2 * DATA.itemWeight("orange"), "weight down after sell orange");

  const over = PVE.createSave("warrior", DATA.emptyAllocated());
  over.zeno = 10000;
  const oz = over.zeno;
  const oc = over.potions.orange;
  const tooMany = PVE.sellItem(over, "orange", 99);
  assert(!tooMany.ok, "sell more than owned fails");
  assert(over.zeno === oz && over.potions.orange === oc, "over-sell leaves counts/zeno unchanged");

  const h = PVE.createSave("hunter", DATA.emptyAllocated());
  h.zeno = 10000;
  assert(h.ammo && h.ammo.id === "arrow" && h.ammo.count === 100, "hunter start 100 arrows");
  const hz = h.zeno;
  const hw = PVE.carryWeight(h);
  const arrowPrice = DATA.ITEMS.arrow.price;
  const unitArrow = DATA.sellZeno(arrowPrice);
  const soldArrows = PVE.sellItem(h, "arrow", 10);
  assert(soldArrows.ok === true, "sell 10 arrows ok");
  assert(soldArrows.zeno === unitArrow * 10, "arrow zeno " + soldArrows.zeno);
  assert(h.zeno === hz + unitArrow * 10, "hunter zeno increased");
  assert(h.ammo.count === 90, "ammo.count 90, got " + h.ammo.count);
  assert(h.arrowCount === 90, "arrowCount synced 90, got " + h.arrowCount);
  assert(h.ammo.count >= 0 && h.arrowCount >= 0, "ammo never negative");
  assert(PVE.carryWeight(h) === hw - 10 * DATA.itemWeight("arrow"), "weight down after sell arrows");

  const wrongAmmo = PVE.sellItem(h, "arrow_steel", 1);
  assert(!wrongAmmo.ok && wrongAmmo.reason === "ไม่มี", "sell other arrow type fails ไม่มี");

  const mat = PVE.createSave("warrior", DATA.emptyAllocated());
  mat.zeno = 10000;
  mat.materials.ore_phracon = 5;
  const mz = mat.zeno;
  const mw = PVE.carryWeight(mat);
  const soldMat = PVE.sellItem(mat, "ore_phracon", 3);
  assert(soldMat.ok === true, "sell material ok");
  assert(soldMat.zeno === 0, "ore_phracon sellZeno 0, got " + soldMat.zeno);
  assert(mat.zeno === mz, "material sell adds 0 zeno");
  assert((mat.materials.ore_phracon || 0) === 2, "materials -= 3, got " + mat.materials.ore_phracon);
  assert(PVE.carryWeight(mat) === mw - 3 * DATA.itemWeight("ore_phracon"), "weight down after sell ore");

  const dg = PVE.createSave("warrior", DATA.emptyAllocated());
  dg.zeno = 10000;
  dg.owned.helm_leather = true;
  dg.equip.helm = "helm_leather";
  dg.refine.helm_leather = 4;
  const dz = dg.zeno;
  const dw = PVE.carryWeight(dg);
  const droppedGear = PVE.dropItem(dg, "helm_leather", 1);
  assert(droppedGear.ok === true, "drop gear ok");
  assert(droppedGear.zeno === 0 && dg.zeno === dz, "drop gear zeno unchanged");
  assert(!dg.owned.helm_leather && dg.refine.helm_leather == null, "drop clears owned+refine");
  assert(dg.equip.helm !== "helm_leather", "drop unequips");
  assert(droppedGear.needsConfirm === true, "drop gear needsConfirm");
  assert(droppedGear.toast === "โยนทิ้ง " + DATA.lootName("helm_leather") + " ×1", "drop gear toast");
  assert(PVE.carryWeight(dg) === dw - DATA.itemWeight("helm_leather"), "weight down after drop gear");

  const dp = PVE.createSave("warrior", DATA.emptyAllocated());
  const red0 = dp.potions.red;
  const drop1 = PVE.dropItem(dp, "red", 1);
  assert(drop1.ok === true, "drop 1 potion ok");
  assert(drop1.needsConfirm === false, "qty===1 stack needsConfirm false");
  assert((dp.potions.red || 0) === red0 - 1, "red decremented");
  const dropMany = PVE.dropItem(dp, "red", 2);
  assert(dropMany.ok === true && dropMany.needsConfirm === true, "qty>1 stack needsConfirm true");

  const dn = PVE.createSave("warrior", DATA.emptyAllocated());
  const redN = dn.potions.red;
  const dropNeg = PVE.dropItem(dn, "red", 999);
  assert(!dropNeg.ok, "drop more than owned fails");
  assert(dn.potions.red === redN, "drop cannot go negative, count unchanged");

  const w70 = PVE.createSave("warrior", DATA.emptyAllocated());
  w70.potions = { red: 21, orange: 0, white: 0, blue: 0, berserk: 0 };
  const ws70b = PVE.weightState(w70);
  assert(ws70b.cur === 1470 && ws70b.noRegen === true && ws70b.over === false, "70% noRegen unchanged");
  w70.potions.red = 26;
  const ws90b = PVE.weightState(w70);
  assert(ws90b.cur === 1820 && ws90b.over === true && ws90b.full === false, "90% over unchanged");
  w70.potions.red = 29;
  const ws100b = PVE.weightState(w70);
  assert(ws100b.cur === 2030 && ws100b.full === true, "100% full unchanged");

  const appSrc = readFileSync(join(root, "js", "app.js"), "utf8");
  const uiSrc = readFileSync(join(root, "js", "ui.js"), "utf8");
  const pveSrc = readFileSync(join(root, "js", "pve.js"), "utf8");
  assert(appSrc.indexOf("App.sellItem") >= 0, "app.js has App.sellItem");
  assert(appSrc.indexOf("App.dropItem") >= 0, "app.js has App.dropItem");
  assert(appSrc.indexOf("ขาย") >= 0, "app.js toast string ขาย");
  assert(appSrc.indexOf("โยนทิ้ง") >= 0, "app.js toast string โยนทิ้ง");
  assert(uiSrc.indexOf(">1<") >= 0 || uiSrc.indexOf(';"1<') >= 0 || uiSrc.indexOf(">1</button>") >= 0, "ui qty strip has 1");
  assert(uiSrc.indexOf(">10<") >= 0 || uiSrc.indexOf(">10</button>") >= 0, "ui qty strip has 10");
  assert(uiSrc.indexOf("ทั้งหมด") >= 0, "ui qty strip has ทั้งหมด");
  assert(uiSrc.indexOf("App.sellItem") >= 0, "ui.js sell hook");
  assert(uiSrc.indexOf("App.dropItem") >= 0, "ui.js drop hook");
  assert(!/MAP\.(dropItem|placeItem|setTileItem)/.test(pveSrc), "pve.js does not write items onto map tiles");
  const mapSrc2 = readFileSync(join(root, "js", "map.js"), "utf8");
  const worldSrc2 = readFileSync(join(root, "js", "world.js"), "utf8");
  assert(mapSrc2.indexOf("PVE.sellItem") < 0 && worldSrc2.indexOf("PVE.sellItem") < 0, "no sell/drop added to MAP/WORLD");
}

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exit(1);
