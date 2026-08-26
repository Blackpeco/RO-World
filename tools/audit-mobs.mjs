import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { console, Math, Date, Object, Array, Number, String, Boolean, Error };
vm.createContext(ctx);
for (const f of ["data.js", "stats.js", "combat.js", "pve.js", "map.js", "world.js", "audio.js", "fx.js"]) {
  vm.runInContext(readFileSync(join(root, "js", f), "utf8"), ctx, { filename: f });
}
const { DATA, STATS, MAP } = ctx;
const wantStats = {
  poring: { lv: 1, str: 5, agi: 5, vit: 4, int: 2, dex: 4, luk: 8, hit: 175, flee: 106, soft: 2, softm: 1, hd: 0, hm: 0 },
  fabre: { lv: 2, str: 6, agi: 6, vit: 8, int: 3, dex: 5, luk: 4, hit: 177, flee: 108, soft: 5, softm: 2, hd: 1, hm: 0 },
  lunatic: { lv: 2, str: 7, agi: 14, vit: 5, int: 2, dex: 8, luk: 10, hit: 180, flee: 116, soft: 3, softm: 2, hd: 0, hm: 0 },
  willow: { lv: 3, str: 8, agi: 4, vit: 12, int: 14, dex: 6, luk: 3, hit: 179, flee: 107, soft: 7, softm: 8, hd: 8, hm: 6 },
  condor: { lv: 3, str: 9, agi: 12, vit: 6, int: 3, dex: 11, luk: 5, hit: 184, flee: 115, soft: 4, softm: 3, hd: 2, hm: 0 },
  wolf: { lv: 10, str: 28, agi: 22, vit: 16, int: 4, dex: 18, luk: 8, hit: 198, flee: 132, soft: 13, softm: 7, hd: 8, hm: 2 },
  poporing: { lv: 11, str: 14, agi: 12, vit: 20, int: 22, dex: 12, luk: 10, hit: 193, flee: 123, soft: 15, softm: 16, hd: 4, hm: 8 },
  chonchon: { lv: 12, str: 12, agi: 36, vit: 10, int: 6, dex: 20, luk: 8, hit: 202, flee: 148, soft: 11, softm: 9, hd: 2, hm: 4 },
  roda_frog: { lv: 13, str: 18, agi: 8, vit: 38, int: 8, dex: 12, luk: 4, hit: 195, flee: 121, soft: 25, softm: 10, hd: 22, hm: 5 },
  spore: { lv: 14, str: 10, agi: 10, vit: 16, int: 36, dex: 14, luk: 6, hit: 198, flee: 124, soft: 15, softm: 25, hd: 6, hm: 12 },
  rocker: { lv: 15, str: 16, agi: 32, vit: 14, int: 10, dex: 26, luk: 18, hit: 211, flee: 147, soft: 14, softm: 12, hd: 6, hm: 4 },
  steel_chonchon: { lv: 16, str: 18, agi: 28, vit: 24, int: 8, dex: 20, luk: 6, hit: 206, flee: 144, soft: 20, softm: 12, hd: 48, hm: 8 },
  savage_babe: { lv: 17, str: 36, agi: 16, vit: 28, int: 4, dex: 16, luk: 8, hit: 203, flee: 133, soft: 22, softm: 10, hd: 18, hm: 3 },
  elder_willow: { lv: 18, str: 16, agi: 8, vit: 30, int: 40, dex: 14, luk: 6, hit: 202, flee: 126, soft: 24, softm: 29, hd: 20, hm: 22 },
  skeleton: { lv: 20, str: 34, agi: 14, vit: 26, int: 8, dex: 22, luk: 4, hit: 212, flee: 134, soft: 23, softm: 14, hd: 30, hm: 6 },
};
const wantDrop = {
  poring: [["material", "ore_phracon", 5], ["item", "helm_leather", 1], ["potion", "red", 4]],
  fabre: [["material", "ore_phracon", 5], ["item", "armor_rough", 1], ["potion", "red", 4]],
  lunatic: [["material", "ore_phracon", 5], ["item", "cloak_travel", 1], ["potion", "orange", 3]],
  willow: [["material", "ore_phracon", 5], ["item", "boots_leather", 1], ["potion", "blue", 4]],
  condor: [["material", "ore_phracon", 5], ["item", "shield_wood", 1], ["potion", "orange", 3]],
  wolf: [["material", "ore_oridecon", 5], ["item", "boots_hunt", 1], ["potion", "orange", 4]],
  poporing: [["material", "ore_phracon", 5], ["item", "cloak_mage", 1], ["potion", "blue", 4]],
  chonchon: [["material", "ore_phracon", 5], ["item", "helm_iron", 1], ["potion", "red", 4]],
  roda_frog: [["material", "ore_elunium", 5], ["item", "shield_iron", 1], ["potion", "orange", 4]],
  spore: [["material", "ore_phracon", 5], ["item", "armor_robe", 1], ["potion", "blue", 4]],
  rocker: [["material", "ore_oridecon", 5], ["item", "acc_life", 1], ["potion", "orange", 3]],
  steel_chonchon: [["material", "ore_elunium", 5], ["item", "shield_iron", 1], ["potion", "orange", 4]],
  savage_babe: [["material", "ore_oridecon", 5], ["item", "armor_chain", 1], ["potion", "orange", 4]],
  elder_willow: [["material", "ore_elunium", 5], ["item", "helm_wizard", 1], ["potion", "blue", 4]],
  skeleton: [["material", "ore_elunium", 5], ["item", "acc_life", 1], ["potion", "white", 3]],
};
const wantCombat = {
  wolf: { hp: 3400, aspeed: 28, atk: 158, matk: 18, baseExp: 240, jobExp: 160, zenoMin: 90, zenoMax: 140, skills: ["mob_wolf_bite", "mob_wolf_howl"] },
  poporing: { hp: 3600, aspeed: 24, atk: 150, matk: 40, baseExp: 265, jobExp: 175, zenoMin: 95, zenoMax: 150, skills: ["mob_pop_hop", "mob_pop_acid"] },
  chonchon: { hp: 2800, aspeed: 34, atk: 155, matk: 20, baseExp: 280, jobExp: 185, zenoMin: 100, zenoMax: 155, skills: ["mob_chon_buzz", "mob_chon_dive"] },
  roda_frog: { hp: 4800, aspeed: 18, atk: 170, matk: 22, baseExp: 310, jobExp: 205, zenoMin: 110, zenoMax: 170, skills: ["mob_frog_tongue", "mob_frog_slam"] },
  spore: { hp: 3900, aspeed: 22, atk: 145, matk: 95, baseExp: 335, jobExp: 220, zenoMin: 115, zenoMax: 180, skills: ["mob_spore_puff", "mob_spore_cloud"] },
  rocker: { hp: 4100, aspeed: 32, atk: 188, matk: 30, baseExp: 365, jobExp: 240, zenoMin: 125, zenoMax: 195, skills: ["mob_rock_strum", "mob_rock_screech"] },
  steel_chonchon: { hp: 3600, aspeed: 30, atk: 195, matk: 24, baseExp: 395, jobExp: 260, zenoMin: 135, zenoMax: 210, skills: ["mob_steel_buzz", "mob_steel_ram"] },
  savage_babe: { hp: 5200, aspeed: 26, atk: 220, matk: 20, baseExp: 430, jobExp: 280, zenoMin: 145, zenoMax: 225, skills: ["mob_babe_gore", "mob_babe_rush"] },
  elder_willow: { hp: 5600, aspeed: 20, atk: 175, matk: 130, baseExp: 470, jobExp: 305, zenoMin: 155, zenoMax: 240, skills: ["mob_elder_hit", "mob_elder_flame"] },
  skeleton: { hp: 6100, aspeed: 24, atk: 245, matk: 35, baseExp: 530, jobExp: 345, zenoMin: 175, zenoMax: 270, skills: ["mob_skel_slash", "mob_skel_bone"] },
};
const drift = [];
const ids = Object.keys(wantStats);
const idsLive = DATA.MONSTERS.map((m) => m.id);
if (idsLive.length !== 15) drift.push("count " + idsLive.length);
ids.forEach((id) => {
  const m = DATA.MONSTERS.find((x) => x.id === id);
  if (!m) { drift.push("MISSING " + id); return; }
  const w = wantStats[id];
  ["str", "agi", "vit", "int", "dex", "luk"].forEach((k) => {
    if (m[k] !== w[k]) drift.push(id + " " + k + " " + m[k]);
  });
  if (m.level !== w.lv) drift.push(id + " lv " + m.level);
  if (m.hardDef !== w.hd) drift.push(id + " hardDef " + m.hardDef);
  if (m.hardMdef !== w.hm) drift.push(id + " hardMdef " + m.hardMdef);
  const st = STATS.computeMonsterStats(m);
  if (st.hit !== w.hit) drift.push(id + " HIT " + st.hit);
  if (st.flee !== w.flee) drift.push(id + " FLEE " + st.flee);
  if (st.softDef !== w.soft) drift.push(id + " SoftDEF " + st.softDef);
  if (st.softMdef !== w.softm) drift.push(id + " SoftMDEF " + st.softMdef);
  const drops = m.drops || [];
  const wd = wantDrop[id];
  if (drops.length !== 3) drift.push(id + " drops " + drops.length);
  wd.forEach((row, i) => {
    const d = drops[i] || {};
    if (d.kind !== row[0] || d.id !== row[1] || d.chance !== row[2]) drift.push(id + " drop " + i + " " + JSON.stringify(d));
  });
  if (!existsSync(join(root, "assets/mobs/" + id + ".png"))) drift.push(id + " no sprite");
  const c = wantCombat[id];
  if (c) {
    ["hp", "aspeed", "atk", "matk", "baseExp", "jobExp", "zenoMin", "zenoMax"].forEach((k) => {
      if (m[k] !== c[k]) drift.push(id + " " + k + " " + m[k] + "!=" + c[k]);
    });
    if (JSON.stringify(m.skills) !== JSON.stringify(c.skills)) drift.push(id + " skills " + JSON.stringify(m.skills));
  }
});
if (DATA.refineOreFor({ type: "helm" }, 1) !== "ore_phracon") drift.push("ore+1");
if (DATA.refineOreFor({ type: "helm" }, 5) !== "ore_elunium") drift.push("ore helm+5");
if (DATA.refineOreFor({ type: "weapon" }, 5) !== "ore_oridecon") drift.push("ore weap+5");
const g = MAP.ZONES.field.grid;
const spawn = g.spawn;
const bands = { near: {}, mid: {}, far: {}, deep: {} };
(g.mobs || []).forEach((m) => {
  const d = Math.abs(m.x - spawn.x) + Math.abs(m.y - spawn.y);
  const b = d < 30 ? "near" : d < 52 ? "mid" : d < 74 ? "far" : "deep";
  bands[b][m.monsterId] = (bands[b][m.monsterId] || 0) + 1;
});
const have = new Set((g.mobs || []).map((m) => m.monsterId));
ids.forEach((id) => { if (!have.has(id)) drift.push("field missing " + id); });
console.log("DRIFT", drift.length);
drift.forEach((d) => console.log(d));
console.log("ROSTER", idsLive.join(","));
console.log("BANDS", JSON.stringify(bands));
console.log("MOBS", (g.mobs || []).length);
