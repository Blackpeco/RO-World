/**
 * RO-World — game data (heroes, bosses, items, constants)
 * Exact numbers from the official spec.
 */
(function (root) {
  const DATA = {};

  DATA.TITLE = "⚔️ RO-World ⚔️";

  DATA.SPEED_MAX = 1000;
  DATA.SPEED_TICK_MS = 20;
  DATA.HERO_SPEED = 25;

  DATA.HERO_CRIT_CAP = 100;
  DATA.HERO_DODGE_CAP = 80;
  DATA.BOSS_DODGE_CAP = 95;

  DATA.STAT_POINTS_TOTAL = 400;
  /* Bonus POINTS granted after defeating boss index 0..6 (bosses 1–7). */
  DATA.BONUS_STAT_POINTS_BY_BOSS = [60, 80, 100, 120, 140, 160, 180];
  DATA.bonusStatPointsFor = function (bossIndex) {
    const n = DATA.BONUS_STAT_POINTS_BY_BOSS[bossIndex];
    return n == null ? 0 : n;
  };
  DATA.STAT_MAX_PER_STAT = 99;

  DATA.SKILL_MAX_RANK = 5;
  DATA.SKILL_POINT_START = 4;
  DATA.SKILL_POINTS_PER_BOSS = 2;
  DATA.SKILL_RANK_COST = 1;

  DATA.START_ZENO = 1000;
  DATA.BOSS_REWARD_ZENO = 500;
  DATA.POST_WIN_RESTORE = 0.25;
  DATA.FIELD_WIN_RESTORE = 0.08;
  DATA.DEFEAT_HP_RATIO = 0.5;
  DATA.BASE_LEVEL_CAP = 99;
  DATA.JOB_LEVEL_CAP = 50;
  DATA.STAT_POINTS_PER_BASE_LEVEL = 10;
  DATA.KAFRA_HEAL_COST = 50;
  DATA.FIELD_RESPAWN_MS_MIN = 20000;
  DATA.FIELD_RESPAWN_MS_MAX = 30000;
  DATA.fieldRespawnMs = function (rng) {
    const min = DATA.FIELD_RESPAWN_MS_MIN;
    const max = DATA.FIELD_RESPAWN_MS_MAX;
    if (root.PVE && typeof root.PVE.rollInt === "function") {
      return root.PVE.rollInt(min, max, rng);
    }
    if (rng && typeof rng.next === "function") {
      return min + Math.floor(rng.next() * (max - min + 1));
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };
  DATA.BOSS_RESPAWN_MS = 8000;
  DATA.WORLD_TICK_MS = 50;
  DATA.CD_TURN_MS = 1600;
  DATA.GLOBAL_CD_MS = 300;
  DATA.ASPD_BASE_MS = 1600;
  DATA.ASPD_PER = 22;
  DATA.ASPD_MIN_MS = 380;
  DATA.ASPD_MAX_MS = 2000;
  /* Locked ASPD (RO-style). Job table TBD — every job uses 156 for now. */
  DATA.JOB_BASE_ASPD = 156;
  DATA.SHIELD_ASPD_PENALTY = -8;
  DATA.ASPD_PENALTY_CAP = 0.96;
  DATA.ASPD_RATE_CAP = 7;
  DATA.ASPD_RATE_NUMERATOR = 50;
  DATA.BERSERK_ASPD_MOD = 0.20;
  DATA.BERSERK_DURATION_MS = 30 * 60 * 1000;
  /* Optional item fields (not on shop items yet): aspdPct (e.g. 0.20), aspdFlat (e.g. +2). */
  DATA.AUTO_POTION_HP = 0.4;
  DATA.AUTO_HEAL_SKILL_HP = 0.35;
  DATA.AUTO_FARM_STOP_HP = 0.15;
  DATA.START_POTIONS = { red: 5, orange: 2, white: 0, blue: 1 };

  DATA.HAIR_COLORS = {
    blonde: { id: "blonde", name: "บลอนด์", nameEn: "Blonde", swatch: "#e8c84a" },
    black: { id: "black", name: "ดำ", nameEn: "Black", swatch: "#1c1c1c" },
    brown: { id: "brown", name: "น้ำตาล", nameEn: "Brown", swatch: "#6b3a14" },
    red: { id: "red", name: "แดง", nameEn: "Red", swatch: "#b22618" },
    blue: { id: "blue", name: "ฟ้า", nameEn: "Blue", swatch: "#2f6ec4" },
    silver: { id: "silver", name: "ขาว/เงิน", nameEn: "Silver", swatch: "#d5d7de" },
  };
  DATA.HAIR_COLOR_IDS = ["blonde", "black", "brown", "red", "blue", "silver"];
  DATA.defaultHairColor = function (id) {
    return DATA.HAIR_COLORS[id] ? id : "blonde";
  };

  DATA.WEIGHT_BASE = 2000;
  DATA.WEIGHT_PER_STR = 30;
  DATA.itemWeight = function (idOrDef) {
    if (idOrDef && typeof idOrDef === "object") return Math.max(0, Number(idOrDef.weight) || 10);
    const id = idOrDef;
    const pot = DATA.POTIONS && DATA.POTIONS[id];
    if (pot) return Math.max(0, Number(pot.weight) || 10);
    const mat = DATA.MATERIALS && DATA.MATERIALS[id];
    if (mat) return Math.max(0, Number(mat.weight) || 10);
    const it = DATA.ITEMS && DATA.ITEMS[id];
    if (it) return Math.max(0, Number(it.weight) || 10);
    return 10;
  };
  DATA.maxWeight = function (str) {
    return DATA.WEIGHT_BASE + (str | 0) * DATA.WEIGHT_PER_STR;
  };

  DATA.baseExpToNext = function (lv) {
    lv = Math.max(1, Math.floor(lv || 1));
    return Math.floor(80 * Math.pow(lv, 1.65));
  };
  DATA.jobExpToNext = function (lv) {
    lv = Math.max(1, Math.floor(lv || 1));
    return Math.floor(50 * Math.pow(lv, 1.55));
  };

  DATA.LEVEL_BONUS = {
    hp: 100,
    mp: 30,
    atk: 5,
    matk: 5,
    def: 2,
    mdef: 2,
  };

  DATA.STAT_KEYS = ["str", "vit", "int", "agi", "dex", "luk"];
  DATA.STAT_LABELS = {
    str: "STR",
    vit: "VIT",
    int: "INT",
    agi: "AGI",
    dex: "DEX",
    luk: "LUK",
  };

  DATA.HERO_BASE_ACCURACY = 100;
  DATA.HERO_BASE_CRIT = 5;
  DATA.HERO_BASE_CRIT_MULT = 50;
  DATA.HERO_BASE_HP_REGEN = 20;
  DATA.HERO_BASE_MP_REGEN = 2;

  DATA.HEROES = {
    warrior: {
      id: "warrior",
      job: "swordsman",
      name: "นักรบผู้กล้า",
      emoji: "⚔️",
      color: "#d4a017",
      accent: "#8b1e1e",
      hp: 3000,
      mp: 200,
      aspeed: 29,
      atk: 160,
      matk: 80,
      def: 30,
      mdef: 15,
      crit: 5,
      critMult: 50,
      hpRegen: 20,
      mpRegen: 2,
      dodge: 0,
      accuracy: 100,
      skills: ["bash","magnum_break","provoke","endure","sword_mastery","twohand_mastery","increase_hp_recovery"],
    },
    assassin: {
      id: "assassin",
      job: "thief",
      name: "มือสังหารเงา",
      emoji: "🥷",
      color: "#7b3fa0",
      accent: "#1a0b24",
      hp: 2800,
      mp: 220,
      aspeed: 31,
      atk: 120,
      matk: 120,
      def: 15,
      mdef: 20,
      crit: 5,
      critMult: 50,
      hpRegen: 20,
      mpRegen: 2,
      dodge: 0,
      accuracy: 100,
      skills: ["double_attack","improve_dodge","steal","hiding","envenom","detoxify"],
    },
    hunter: {
      id: "hunter",
      job: "archer",
      name: "นักล่าผู้ใช้เหยี่ยว",
      emoji: "🦅",
      color: "#3d8b4a",
      accent: "#2a1a0a",
      hp: 2500,
      mp: 250,
      aspeed: 29,
      atk: 150,
      matk: 100,
      def: 10,
      mdef: 10,
      crit: 5,
      critMult: 50,
      hpRegen: 20,
      mpRegen: 2,
      dodge: 0,
      accuracy: 100,
      skills: ["owl_eye","vulture_eye","double_strafe","arrow_shower","improve_concentration","arrow_repel"],
    },
  };

  DATA.JOB_LABEL = { swordsman:"Swordsman", thief:"Thief", merchant:"Merchant", archer:"Archer", acolyte:"Acolyte", mage:"Mage" };
  DATA.JOB_ALL = ["swordsman","thief","merchant","archer","acolyte","mage"];
  DATA.JOB_HEAVY = ["swordsman","thief","merchant"];  // high Hard DEF
  DATA.JOB_MID = ["thief","archer","acolyte"];        // mid Hard DEF
  DATA.JOB_SWORD = ["swordsman"];
  DATA.JOB_DAGGER = ["thief","mage","archer"];
  DATA.JOB_BOW = ["archer"];
  DATA.JOB_STAFF = ["mage","acolyte"];
  DATA.JOB_AXE = ["swordsman","merchant"];
  DATA.JOB_MACE = ["acolyte","merchant"];
  DATA.heroJob = function(heroId){ var h=DATA.HEROES[heroId]; return (h && h.job) || heroId; };
  DATA.itemJobs = function(item){ if(!item || item.jobs==="all" || !item.jobs) return DATA.JOB_ALL; return item.jobs; };
  DATA.canJobWear = function(heroId, item){ return DATA.itemJobs(item).indexOf(DATA.heroJob(heroId))>=0; };
  DATA.jobsText = function(item){ if(!item || item.jobs==="all" || !item.jobs) return "ทุกอาชีพ"; return item.jobs.map(function(j){ return DATA.JOB_LABEL[j]||j; }).join(" / "); };
  DATA.itemStatLine = function (it) {
    if (!it) return "";
    const parts = [];
    if (it.type === "weapon") {
      if (it.weaponMatk) parts.push("Weapon MATK " + it.weaponMatk);
      else parts.push("Weapon ATK " + (it.weaponAtk || 0));
    } else if (it.type === "ammo") {
      parts.push("Arrow ATK " + (it.arrowAtk || 0));
    } else if (it.bonuses && it.bonuses.hardDef) {
      parts.push("Hard DEF " + it.bonuses.hardDef);
    }
    parts.push(DATA.jobsText(it));
    if (it.reqLevel) parts.push("ต้องการ Lv " + it.reqLevel);
    return parts.join(" · ");
  };

  DATA.SKILLS = {
    attack: {
      id: "attack",
      icon: "assets/skills/attack.png",
      name: "ฟันดาบ",
      hero: "warrior",
      cd: 0,
      mp: 0,
      type: "attack",
      button: "ฟันดาบ — ดาเมจ 140% ATK | ไม่มีคูลดาวน์ | ไม่เสีย MP",
    },
    magifireblade: {
      id: "magifireblade",
      icon: "assets/skills/magifireblade.png",
      name: "ดาบเวทย์เพลิงประลัย",
      hero: "warrior",
      cd: 4,
      mp: 40,
      type: "attack",
      button: "ดาบเวทย์เพลิงประลัย — ดาเมจ 200% ATK + 280% MATK | CD 4 | MP 40",
    },
    guard: {
      id: "guard",
      icon: "assets/skills/guard.png",
      name: "เกราะเวทมนตร์",
      hero: "warrior",
      cd: 2,
      mp: 15,
      type: "self",
      button: "เกราะเวทมนตร์ — ลดดาเมจ 80% (ถึงตาถัดไปของตน, หมดฤทธิ์ถ้าไม่โดนตี) หลังโดนตี: คริครั้งถัดไป 25%+1%/LUK | CD 2 | MP 15",
    },
    heal: {
      id: "heal",
      icon: "assets/skills/heal.png",
      name: "คาถารักษา",
      hero: "warrior",
      cd: 3,
      mp: 20,
      type: "self",
      button: "คาถารักษา — ฟื้นฟู HP 300% MATK | CD 3 | MP 20",
    },
    stab: {
      id: "stab",
      icon: "assets/skills/stab.png",
      name: "แทงมีดสั้น",
      hero: "assassin",
      cd: 0,
      mp: 0,
      type: "attack",
      button: "แทงมีดสั้น — ดาเมจ 90% ATK | พิษ 50%+0.5%/AGI นาน 4 เทิร์น (20%+0.4%/AGI) MATK/เทิร์น | ไม่มีคูลดาวน์ | ไม่เสีย MP",
    },
    shadowkill: {
      id: "shadowkill",
      icon: "assets/skills/shadowkill.png",
      name: "สังหารไร้เงา",
      hero: "assassin",
      cd: 3,
      mp: 40,
      type: "attack",
      button: "สังหารไร้เงา — พิษ (70%+1%/INT) MATK/เทิร์น นาน 3 เทิร์น (×2 ถ้าเป้าหมายติดพิษอยู่แล้ว) ไม่มีดาเมจตรง | CD 3 | MP 40",
    },
    veil: {
      id: "veil",
      icon: "assets/skills/veil.png",
      name: "เงาพราง",
      hero: "assassin",
      cd: 5,
      mp: 15,
      type: "self",
      button: "เงาพราง — หลบหลีก 30%+0.5%/AGI นาน 3 เทิร์นของตน + ฟื้นฟู (60%+1%/VIT) MATK/เทิร์น นาน 3 เทิร์น | ไม่ป้องกันคาถาสะกด | CD 5 | MP 15",
    },
    counter: {
      id: "counter",
      icon: "assets/skills/counter.png",
      name: "สวนกลับฉับพลัน",
      hero: "assassin",
      cd: 4,
      mp: 25,
      type: "self",
      button: "สวนกลับฉับพลัน — ลดดาเมจ 60% + สะท้อน 100% ของดาเมจดิบ + ฟื้นฟู HP 50% ของดาเมจดิบ | ถ้าหลบสำเร็จ: ฮีล 200% MATK + MP 10% MATK | CD 4 | MP 25",
    },
    arrowshot: {
      id: "arrowshot",
      icon: "assets/skills/arrowshot.png",
      name: "ยิงลูกธนู",
      hero: "hunter",
      cd: 0,
      mp: 0,
      type: "attack",
      button: "ยิงลูกธนู — ดาเมจ 100% ATK | โอกาส (20%+2%/DEX) อ่อนแอ (−20% ดาเมจศัตรู) นาน 3 เทิร์น | ไม่มีคูลดาวน์ | ไม่เสีย MP",
    },
    powershot: {
      id: "powershot",
      icon: "assets/skills/powershot.png",
      name: "สร้างยิงธนู",
      hero: "hunter",
      cd: 0,
      mp: 12,
      type: "attack",
      button: "สร้างยิงธนู — ดาเมจ 280% ATK | ไม่มีคูลดาวน์ | MP 12",
    },
    focus: {
      id: "focus",
      icon: "assets/skills/focus.png",
      name: "เพ่งสมาธิ",
      hero: "hunter",
      cd: 5,
      mp: 70,
      type: "self",
      button: "เพ่งสมาธิ — +(20%+0.3%/DEX) ความแม่นยำ, +(30+1/DEX) ATK, +(3+0.05/AGI) A.speed, +(25%+0.34%/LUK) คริ นาน 4 เทิร์น (นับตอนศัตรูลงมือ) | CD 5 | MP 70",
    },
    soularrow: {
      id: "soularrow",
      icon: "assets/skills/soularrow.png",
      name: "ลูกศรดูดวิญญาณ",
      hero: "hunter",
      cd: 1,
      mp: 40,
      type: "attack",
      button: "ลูกศรดูดวิญญาณ — ดาเมจ 150% ATK + 250% MATK + ฟื้นฟู HP 35% ของดาเมจ | CD 1 | MP 40",
    },
    blade_storm: {
      id: "blade_storm",
      icon: "assets/skills/blade_storm.png",
      name: "พายดาบพุโฆ",
      hero: "warrior",
      cd: 4,
      mp: 45,
      type: "attack",
      button: "พายดาบพุโฆ — ดาเมจ 180% ATK สองครั้ง | CD 4 | MP 45",
    },
    sanctuary: {
      id: "sanctuary",
      icon: "assets/skills/sanctuary.png",
      name: "วงก์บุญ",
      hero: "warrior",
      cd: 5,
      mp: 35,
      type: "self",
      button: "วงก์บุญ — ฟื้นฟู HP 200% MATK + ลดดาเมจ 40% (1 ครั้ง) | CD 5 | MP 35",
    },
    nightfall: {
      id: "nightfall",
      icon: "assets/skills/nightfall.png",
      name: "ราตรี",
      hero: "assassin",
      cd: 3,
      mp: 30,
      type: "attack",
      button: "ราตรี — ดาเมจ 160% ATK + พิษ 40% MATK/เทิร์น ×3 | CD 3 | MP 30",
    },
    phantom: {
      id: "phantom",
      icon: "assets/skills/phantom.png",
      name: "ภาพผี",
      hero: "assassin",
      cd: 5,
      mp: 40,
      type: "self",
      button: "ภาพผี — หลบ +20% นาน 2 เทิร์น + โจมตีครั้งถัดไป +80% ATK | CD 5 | MP 40",
    },
    rain: {
      id: "rain",
      icon: "assets/skills/rain.png",
      name: "ฟ้าทะนู",
      hero: "hunter",
      cd: 4,
      mp: 40,
      type: "attack",
      button: "ฟ้าทะนู — ดาเมจ 90% ATK × 3 ครั้ง | CD 4 | MP 40",
    },
    mark: {
      id: "mark",
      icon: "assets/skills/mark.png",
      name: "ประทับเหยี่ยว",
      hero: "hunter",
      cd: 5,
      mp: 35,
      type: "self",
      button: "ประทับเหยี่ยว — คริ +15% ความแม่นยำ +20 นาน 4 เทิร์น (นับตอนศัตรูลงมือ) | CD 5 | MP 35",
    },
    double_strafe: {
      id: "double_strafe",
      icon: "assets/skills/powershot.png",
      name: "ยิงสองนัด",
      hero: "hunter",
      cd: 0,
      mp: 12,
      type: "attack",
      bowSkill: true,
      afterCastMs: 300,
      maxRank: 10,
      button: "ยิงสองนัด — 200–380% ATK | After-cast 0.3s | SP 12",
    },
    arrow_shower: {
      id: "arrow_shower",
      icon: "assets/skills/rain.png",
      name: "ฝนธนู",
      hero: "hunter",
      cd: 0,
      mp: 15,
      type: "attack",
      bowSkill: true,
      afterCastMs: 100,
      cdMs: 300,
      knockback: 2,
      maxRank: 10,
      button: "ฝนธนู — 160–250% ATK AoE | After-cast 0.1s | CD 0.3s | SP 15",
    },
    arrow_repel: {
      id: "arrow_repel",
      icon: "assets/skills/arrowshot.png",
      name: "ดีดศร",
      hero: "hunter",
      cd: 0,
      mp: 15,
      type: "attack",
      bowSkill: true,
      knockback: 6,
      maxRank: 1,
      button: "ดีดศร — 150% ATK ดีด 6 ช่อง | SP 15",
    },
    owl_eye: {
      id: "owl_eye",
      icon: "assets/skills/focus.png",
      name: "ตาเหยี่ยว",
      hero: "hunter",
      cd: 0,
      mp: 0,
      type: "passive",
      maxRank: 10,
      button: "ตาเหยี่ยว — DEX +Lv (ติดตัว)",
    },
    vulture_eye: {
      id: "vulture_eye",
      icon: "assets/skills/mark.png",
      name: "ตาแร้ง",
      hero: "hunter",
      cd: 0,
      mp: 0,
      type: "passive",
      maxRank: 10,
      button: "ตาแร้ง — HIT +Lv และระยะธนู +floor(Lv/2) ช่อง (ติดตัว)",
    },
    improve_concentration: {
      id: "improve_concentration",
      icon: "assets/skills/focus.png",
      name: "สมาธิ",
      hero: "hunter",
      cd: 0,
      mp: 25,
      type: "self",
      maxRank: 10,
      button: "สมาธิ — AGI/DEX +(2+Lv)% นาน (40+20Lv) วินาที เปิดเผย 3×3 | SP 25",
    },

    sword_mastery: {
      id: "sword_mastery",
      icon: "assets/skills/attack.png",
      name: "ความชำนาญดาบ",
      hero: "warrior",
      cd: 0,
      mp: 0,
      type: "passive",
      maxRank: 10,
      button: "ความชำนาญดาบ — Weapon ATK +4 ต่อเลเวล (ดาบมือเดียว)",
    },
    twohand_mastery: {
      id: "twohand_mastery",
      icon: "assets/skills/blade_storm.png",
      name: "ความชำนาญดาบสองมือ",
      hero: "warrior",
      cd: 0,
      mp: 0,
      type: "passive",
      maxRank: 10,
      button: "ความชำนาญดาบสองมือ — Weapon ATK +4 ต่อเลเวล (ดาบสองมือ)",
    },
    increase_hp_recovery: {
      id: "increase_hp_recovery",
      icon: "assets/skills/heal.png",
      name: "ฟื้นฟู HP",
      hero: "warrior",
      cd: 0,
      mp: 0,
      type: "passive",
      maxRank: 10,
      button: "ฟื้นฟู HP — ฟื้น HP เพิ่มตามเลเวลสกิล (ติดตัว)",
    },
    bash: {
      id: "bash",
      icon: "assets/skills/attack.png",
      name: "แบช",
      hero: "warrior",
      cd: 0,
      mp: 8,
      type: "attack",
      afterCastMs: 500,
      maxRank: 10,
      button: "แบช — ดาเมจ 130–400% ATK | After-cast 0.5s | SP 8",
    },
    magnum_break: {
      id: "magnum_break",
      icon: "assets/skills/magifireblade.png",
      name: "แมกนัมเบรก",
      hero: "warrior",
      cd: 0,
      mp: 30,
      type: "attack",
      afterCastMs: 2000,
      knockback: 2,
      maxRank: 10,
      button: "แมกนัมเบรก — ไฟ 120–300% ATK AoE ดีด 2 ช่อง | After-cast 2s | SP 30",
    },
    provoke: {
      id: "provoke",
      icon: "assets/skills/guard.png",
      name: "ยั่วยุ",
      hero: "warrior",
      cd: 0,
      mp: 15,
      type: "attack",
      range: 9,
      maxRank: 10,
      button: "ยั่วยุ — −DEF / +ATK เป้าหมาย นาน 30 วินาที | ระยะ 9 | SP 15",
    },
    endure: {
      id: "endure",
      icon: "assets/skills/guard.png",
      name: "เอนเดอร์",
      hero: "warrior",
      cd: 0,
      mp: 10,
      type: "self",
      maxRank: 10,
      button: "เอนเดอร์ — +MDEF ตามเลเวล, ทน 7 ฮิตไม่วูบ นาน 10 วินาที | SP 10",
    },
    double_attack: {
      id: "double_attack",
      icon: "assets/skills/stab.png",
      name: "โจมตีสองครั้ง",
      hero: "assassin",
      cd: 0,
      mp: 0,
      type: "passive",
      maxRank: 10,
      button: "โจมตีสองครั้ง — โอกาส 5%×Lv โจมตีซ้ำ 100% ATK (มีดสั้น)",
    },
    improve_dodge: {
      id: "improve_dodge",
      icon: "assets/skills/veil.png",
      name: "เพิ่มการหลบ",
      hero: "assassin",
      cd: 0,
      mp: 0,
      type: "passive",
      maxRank: 10,
      button: "เพิ่มการหลบ — FLEE +3 ต่อเลเวล (ติดตัว)",
    },
    steal: {
      id: "steal",
      icon: "assets/skills/counter.png",
      name: "ขโมย",
      hero: "assassin",
      cd: 0,
      mp: 10,
      type: "attack",
      maxRank: 10,
      button: "ขโมย — ขโมย Zeno หรือดรอปจากมอนสนาม | SP 10",
    },
    hiding: {
      id: "hiding",
      icon: "assets/skills/veil.png",
      name: "ซ่อน",
      hero: "assassin",
      cd: 0,
      mp: 10,
      type: "self",
      maxRank: 10,
      button: "ซ่อน — ซ่อนตัว มอนไม่จ้อง / เสีย SP ตามเลเวล | SP 10",
    },
    envenom: {
      id: "envenom",
      icon: "assets/skills/stab.png",
      name: "ทาพิษ",
      hero: "assassin",
      cd: 0,
      mp: 15,
      type: "attack",
      maxRank: 10,
      button: "ทาพิษ — 100% ATK + 15×Lv และโอกาสติดพิษ | SP 15",
    },
    detoxify: {
      id: "detoxify",
      icon: "assets/skills/heal.png",
      name: "ถอนพิษ",
      hero: "assassin",
      cd: 0,
      mp: 10,
      type: "self",
      maxRank: 1,
      button: "ถอนพิษ — ล้างพิษบนตัวเอง | SP 10",
    },
  };

  DATA.BOSSES = [
    {
      id: "monster",
      index: 0,
      name: "มอนสเตอร์ร้าย",
      place: "ถ้ำมอนสเตอร์",
      emoji: "🐲",
      level: 1,
      color: "#c23b22",
      hp: 3000,
      mp: 500,
      aspeed: 26,
      atk: 200,
      matk: 150,
      def: 20,
      mdef: 20,
      crit: 5,
      critMult: 50,
      dodge: 2,
      accuracy: 103,
      skills: ["m_basic", "m_power", "m_dragon", "m_silence"],
    },
    {
      id: "golem",
      index: 1,
      name: "โกเลมหิน",
      place: "ซากศิลาโบราณ",
      emoji: "🗿",
      level: 2,
      color: "#7a7464",
      hp: 9000,
      mp: 300,
      aspeed: 24,
      atk: 200,
      matk: 200,
      def: 60,
      mdef: 20,
      crit: 5,
      critMult: 50,
      dodge: 10,
      accuracy: 115,
      skills: ["g_basic", "g_power", "g_landslide", "g_shield"],
    },
    {
      id: "wolf",
      index: 2,
      name: "บอสหมาป่าขนขาว",
      place: "หุบเขาหมาป่า",
      emoji: "🐺",
      level: 3,
      color: "#d8d4c8",
      hp: 7000,
      mp: 400,
      aspeed: 29,
      atk: 200,
      matk: 200,
      def: 25,
      mdef: 25,
      crit: 10,
      critMult: 50,
      dodge: 20,
      accuracy: 120,
      skills: ["w_basic", "w_claw", "w_fog", "w_fang"],
    },
    {
      id: "knight",
      index: 3,
      name: "อัศวินเหล็กสีเลือด",
      place: "ปราสาทโลหิต",
      emoji: "🗡️",
      level: 4,
      color: "#8b1212",
      hp: 11000,
      mp: 550,
      aspeed: 28,
      atk: 220,
      matk: 150,
      def: 50,
      mdef: 20,
      crit: 8,
      critMult: 60,
      dodge: 30,
      accuracy: 130,
      skills: ["k_basic", "k_thunder", "k_rage", "k_death"],
    },
    {
      id: "demon",
      index: 4,
      name: "ราชันปีศาจแห่งนรก",
      place: "ประตูนรก",
      emoji: "👹",
      level: 5,
      color: "#ff4d00",
      hp: 24000,
      mp: 700,
      aspeed: 31,
      atk: 280,
      matk: 200,
      def: 40,
      mdef: 50,
      crit: 12,
      critMult: 60,
      dodge: 50,
      accuracy: 150,
      skills: ["d_basic", "d_hellfire", "d_curse", "d_apocalypse"],
    },
    {
      id: "angel",
      index: 5,
      name: "นางฟ้ามงกุ่มมรณะ",
      place: "วิหารมรณะ",
      emoji: "👼",
      level: 6,
      color: "#c8b6ff",
      hp: 32000,
      mp: 850,
      aspeed: 33,
      atk: 320,
      matk: 280,
      def: 55,
      mdef: 70,
      crit: 15,
      critMult: 70,
      dodge: 55,
      accuracy: 160,
      skills: ["a_basic", "a_storm", "a_veil", "a_ult"],
    },
    {
      id: "dragon",
      index: 6,
      name: "พระผู้สร้างโลก",
      place: "บัลลังก์ผู้สร้าง",
      emoji: "🐉",
      level: 7,
      color: "#ff4500",
      hp: 45000,
      mp: 1000,
      aspeed: 35,
      atk: 380,
      matk: 320,
      def: 70,
      mdef: 80,
      crit: 18,
      critMult: 80,
      dodge: 60,
      accuracy: 170,
      skills: ["dr_basic", "dr_ruin", "dr_wrath", "dr_ult"],
    },
  ];

  DATA.MONSTERS = [
    {
      id: "poring",
      sprite: "assets/mobs/poring.png",
      portrait: "assets/mobs/poring.png",
      name: "โปริ่ง",
      emoji: "🩷",
      place: "ป่าสงบ",
      level: 1,
      str: 5,
      agi: 5,
      vit: 4,
      int: 2,
      dex: 4,
      luk: 8,
      hardDef: 0,
      hardMdef: 0,
      color: "#ff8ab8",
      hp: 800,
      mp: 40,
      aspeed: 22,
      atk: 48,
      matk: 12,
      def: 4,
      mdef: 4,
      crit: 2,
      critMult: 50,
      dodge: 4,
      accuracy: 95,
      skills: ["mob_hop", "mob_bounce"],
      baseExp: 45,
      jobExp: 30,
      zenoMin: 20,
      zenoMax: 40,
      drops: [
        { kind: "material", id: "ore_phracon", chance: 5 },
        { kind: "item", id: "helm_leather", chance: 1 },
        { kind: "potion", id: "red", chance: 4 },
      ],
    },
    {
      id: "fabre",
      sprite: "assets/mobs/fabre.png",
      portrait: "assets/mobs/fabre.png",
      name: "ฟาเบร์",
      emoji: "🐛",
      place: "ป่าสงบ",
      level: 2,
      str: 6,
      agi: 6,
      vit: 8,
      int: 3,
      dex: 5,
      luk: 4,
      hardDef: 1,
      hardMdef: 0,
      color: "#7cb342",
      hp: 1000,
      mp: 50,
      aspeed: 24,
      atk: 58,
      matk: 16,
      def: 8,
      mdef: 6,
      crit: 3,
      critMult: 50,
      dodge: 6,
      accuracy: 98,
      skills: ["mob_bite", "mob_leaf"],
      baseExp: 60,
      jobExp: 40,
      zenoMin: 25,
      zenoMax: 50,
      drops: [
        { kind: "material", id: "ore_phracon", chance: 5 },
        { kind: "item", id: "armor_rough", chance: 1 },
        { kind: "potion", id: "red", chance: 4 },
      ],
    },
    {
      id: "lunatic",
      sprite: "assets/mobs/lunatic.png",
      portrait: "assets/mobs/lunatic.png",
      name: "ลูนาติก",
      emoji: "🐰",
      place: "ป่าสงบ",
      level: 2,
      str: 7,
      agi: 14,
      vit: 5,
      int: 2,
      dex: 8,
      luk: 10,
      hardDef: 0,
      hardMdef: 0,
      color: "#f4e4c8",
      hp: 1200,
      mp: 45,
      aspeed: 32,
      atk: 62,
      matk: 14,
      def: 6,
      mdef: 5,
      crit: 6,
      critMult: 50,
      dodge: 12,
      accuracy: 105,
      skills: ["mob_scratch", "mob_kick"],
      baseExp: 75,
      jobExp: 50,
      zenoMin: 30,
      zenoMax: 55,
      drops: [
        { kind: "material", id: "ore_phracon", chance: 5 },
        { kind: "item", id: "cloak_travel", chance: 1 },
        { kind: "potion", id: "orange", chance: 3 },
      ],
    },
    {
      id: "willow",
      sprite: "assets/mobs/willow.png",
      portrait: "assets/mobs/willow.png",
      name: "วิลโลว์",
      emoji: "🌳",
      place: "ป่าขอบเมือง",
      level: 3,
      str: 8,
      agi: 4,
      vit: 12,
      int: 14,
      dex: 6,
      luk: 3,
      hardDef: 8,
      hardMdef: 6,
      color: "#6b4f2a",
      hp: 1500,
      mp: 70,
      aspeed: 20,
      atk: 70,
      matk: 40,
      def: 12,
      mdef: 10,
      crit: 3,
      critMult: 50,
      dodge: 3,
      accuracy: 100,
      skills: ["mob_hit", "mob_root"],
      baseExp: 95,
      jobExp: 65,
      zenoMin: 40,
      zenoMax: 70,
      drops: [
        { kind: "material", id: "ore_phracon", chance: 5 },
        { kind: "item", id: "boots_leather", chance: 1 },
        { kind: "potion", id: "blue", chance: 4 },
      ],
    },
    {
      id: "condor",
      sprite: "assets/mobs/condor.png",
      portrait: "assets/mobs/condor.png",
      name: "คอนดอร์",
      emoji: "🦅",
      place: "ป่าสงบ",
      level: 3,
      str: 9,
      agi: 12,
      vit: 6,
      int: 3,
      dex: 11,
      luk: 5,
      hardDef: 2,
      hardMdef: 0,
      color: "#8d6e4c",
      hp: 1400,
      mp: 55,
      aspeed: 30,
      atk: 75,
      matk: 18,
      def: 8,
      mdef: 6,
      crit: 8,
      critMult: 50,
      dodge: 10,
      accuracy: 110,
      skills: ["mob_peck", "mob_dive"],
      baseExp: 90,
      jobExp: 60,
      zenoMin: 35,
      zenoMax: 65,
      drops: [
        { kind: "material", id: "ore_phracon", chance: 5 },
        { kind: "item", id: "shield_wood", chance: 1 },
        { kind: "potion", id: "orange", chance: 3 },
      ],
    },
    {
      id: "wolf",
      sprite: "assets/mobs/wolf.png",
      portrait: "assets/mobs/wolf.png",
      name: "วูล์ฟ",
      emoji: "🐺",
      place: "ทุ่งหญ้าโพรนเทรา",
      level: 10,
      str: 28,
      agi: 22,
      vit: 16,
      int: 4,
      dex: 18,
      luk: 8,
      hardDef: 8,
      hardMdef: 2,
      color: "#6d5a4a",
      hp: 3400,
      mp: 70,
      aspeed: 28,
      atk: 158,
      matk: 18,
      def: 16,
      mdef: 8,
      crit: 8,
      critMult: 50,
      dodge: 10,
      accuracy: 118,
      skills: ["mob_wolf_bite", "mob_wolf_howl"],
      baseExp: 240,
      jobExp: 160,
      zenoMin: 90,
      zenoMax: 140,
      drops: [
        { kind: "material", id: "ore_oridecon", chance: 5 },
        { kind: "item", id: "boots_hunt", chance: 1 },
        { kind: "potion", id: "orange", chance: 4 },
      ],
    },
    {
      id: "poporing",
      sprite: "assets/mobs/poporing.png",
      portrait: "assets/mobs/poporing.png",
      name: "โปโปริ่ง",
      emoji: "💚",
      place: "ป่าขอบเมือง",
      level: 11,
      str: 14,
      agi: 12,
      vit: 20,
      int: 22,
      dex: 12,
      luk: 10,
      hardDef: 4,
      hardMdef: 8,
      color: "#4caf6a",
      hp: 3600,
      mp: 90,
      aspeed: 24,
      atk: 150,
      matk: 40,
      def: 14,
      mdef: 16,
      crit: 3,
      critMult: 50,
      dodge: 6,
      accuracy: 110,
      skills: ["mob_pop_hop", "mob_pop_acid"],
      baseExp: 265,
      jobExp: 175,
      zenoMin: 95,
      zenoMax: 150,
      drops: [
        { kind: "material", id: "ore_phracon", chance: 5 },
        { kind: "item", id: "cloak_mage", chance: 1 },
        { kind: "potion", id: "blue", chance: 4 },
      ],
    },
    {
      id: "chonchon",
      sprite: "assets/mobs/chonchon.png",
      portrait: "assets/mobs/chonchon.png",
      name: "ชอนชอน",
      emoji: "🪰",
      place: "ทุ่งหญ้าโพรนเทรา",
      level: 12,
      str: 12,
      agi: 36,
      vit: 10,
      int: 6,
      dex: 20,
      luk: 8,
      hardDef: 2,
      hardMdef: 4,
      color: "#c4a35a",
      hp: 2800,
      mp: 60,
      aspeed: 34,
      atk: 155,
      matk: 20,
      def: 10,
      mdef: 8,
      crit: 6,
      critMult: 50,
      dodge: 18,
      accuracy: 122,
      skills: ["mob_chon_buzz", "mob_chon_dive"],
      baseExp: 280,
      jobExp: 185,
      zenoMin: 100,
      zenoMax: 155,
      drops: [
        { kind: "material", id: "ore_phracon", chance: 5 },
        { kind: "item", id: "helm_iron", chance: 1 },
        { kind: "potion", id: "red", chance: 4 },
      ],
    },
    {
      id: "roda_frog",
      sprite: "assets/mobs/roda_frog.png",
      portrait: "assets/mobs/roda_frog.png",
      name: "โรด้าฟร็อก",
      emoji: "🐸",
      place: "บึงน้ำเขียว",
      level: 13,
      str: 18,
      agi: 8,
      vit: 38,
      int: 8,
      dex: 12,
      luk: 4,
      hardDef: 22,
      hardMdef: 5,
      color: "#3d8b5a",
      hp: 4800,
      mp: 80,
      aspeed: 18,
      atk: 170,
      matk: 22,
      def: 28,
      mdef: 14,
      crit: 2,
      critMult: 50,
      dodge: 3,
      accuracy: 108,
      skills: ["mob_frog_tongue", "mob_frog_slam"],
      baseExp: 310,
      jobExp: 205,
      zenoMin: 110,
      zenoMax: 170,
      drops: [
        { kind: "material", id: "ore_elunium", chance: 5 },
        { kind: "item", id: "shield_iron", chance: 1 },
        { kind: "potion", id: "orange", chance: 4 },
      ],
    },
    {
      id: "spore",
      sprite: "assets/mobs/spore.png",
      portrait: "assets/mobs/spore.png",
      name: "สปอร์",
      emoji: "🍄",
      place: "ป่าพายอน",
      level: 14,
      str: 10,
      agi: 10,
      vit: 16,
      int: 36,
      dex: 14,
      luk: 6,
      hardDef: 6,
      hardMdef: 12,
      color: "#e8d5a3",
      hp: 3900,
      mp: 120,
      aspeed: 22,
      atk: 145,
      matk: 95,
      def: 14,
      mdef: 22,
      crit: 4,
      critMult: 50,
      dodge: 5,
      accuracy: 115,
      skills: ["mob_spore_puff", "mob_spore_cloud"],
      baseExp: 335,
      jobExp: 220,
      zenoMin: 115,
      zenoMax: 180,
      drops: [
        { kind: "material", id: "ore_phracon", chance: 5 },
        { kind: "item", id: "armor_robe", chance: 1 },
        { kind: "potion", id: "blue", chance: 4 },
      ],
    },
    {
      id: "rocker",
      sprite: "assets/mobs/rocker.png",
      portrait: "assets/mobs/rocker.png",
      name: "ร็อกเกอร์",
      emoji: "🦗",
      place: "ทุ่งหญ้าโพรนเทรา",
      level: 15,
      str: 16,
      agi: 32,
      vit: 14,
      int: 10,
      dex: 26,
      luk: 18,
      hardDef: 6,
      hardMdef: 4,
      color: "#8fbf4a",
      hp: 4100,
      mp: 85,
      aspeed: 32,
      atk: 188,
      matk: 30,
      def: 16,
      mdef: 12,
      crit: 10,
      critMult: 50,
      dodge: 14,
      accuracy: 128,
      skills: ["mob_rock_strum", "mob_rock_screech"],
      baseExp: 365,
      jobExp: 240,
      zenoMin: 125,
      zenoMax: 195,
      drops: [
        { kind: "material", id: "ore_oridecon", chance: 5 },
        { kind: "item", id: "acc_life", chance: 1 },
        { kind: "potion", id: "orange", chance: 3 },
      ],
    },
    {
      id: "steel_chonchon",
      sprite: "assets/mobs/steel_chonchon.png",
      portrait: "assets/mobs/steel_chonchon.png",
      name: "สตีลชอนชอน",
      emoji: "⚙️",
      place: "ทุ่งหินตะวันตก",
      level: 16,
      str: 18,
      agi: 28,
      vit: 24,
      int: 8,
      dex: 20,
      luk: 6,
      hardDef: 48,
      hardMdef: 8,
      color: "#8a8f96",
      hp: 3600,
      mp: 70,
      aspeed: 30,
      atk: 195,
      matk: 24,
      def: 32,
      mdef: 16,
      crit: 7,
      critMult: 50,
      dodge: 12,
      accuracy: 125,
      skills: ["mob_steel_buzz", "mob_steel_ram"],
      baseExp: 395,
      jobExp: 260,
      zenoMin: 135,
      zenoMax: 210,
      drops: [
        { kind: "material", id: "ore_elunium", chance: 5 },
        { kind: "item", id: "shield_iron", chance: 1 },
        { kind: "potion", id: "orange", chance: 4 },
      ],
    },
    {
      id: "savage_babe",
      sprite: "assets/mobs/savage_babe.png",
      portrait: "assets/mobs/savage_babe.png",
      name: "เซเวจเบบี้",
      emoji: "🐗",
      place: "ป่าลึก",
      level: 17,
      str: 36,
      agi: 16,
      vit: 28,
      int: 4,
      dex: 16,
      luk: 8,
      hardDef: 18,
      hardMdef: 3,
      color: "#b07a48",
      hp: 5200,
      mp: 75,
      aspeed: 26,
      atk: 220,
      matk: 20,
      def: 22,
      mdef: 12,
      crit: 9,
      critMult: 50,
      dodge: 8,
      accuracy: 124,
      skills: ["mob_babe_gore", "mob_babe_rush"],
      baseExp: 430,
      jobExp: 280,
      zenoMin: 145,
      zenoMax: 225,
      drops: [
        { kind: "material", id: "ore_oridecon", chance: 5 },
        { kind: "item", id: "armor_chain", chance: 1 },
        { kind: "potion", id: "orange", chance: 4 },
      ],
    },
    {
      id: "elder_willow",
      sprite: "assets/mobs/elder_willow.png",
      portrait: "assets/mobs/elder_willow.png",
      name: "เอลเดอร์วิลโลว์",
      emoji: "🔥",
      place: "ป่าพายอน",
      level: 18,
      str: 16,
      agi: 8,
      vit: 30,
      int: 40,
      dex: 14,
      luk: 6,
      hardDef: 20,
      hardMdef: 22,
      color: "#c45c2a",
      hp: 5600,
      mp: 140,
      aspeed: 20,
      atk: 175,
      matk: 130,
      def: 24,
      mdef: 28,
      crit: 4,
      critMult: 50,
      dodge: 4,
      accuracy: 120,
      skills: ["mob_elder_hit", "mob_elder_flame"],
      baseExp: 470,
      jobExp: 305,
      zenoMin: 155,
      zenoMax: 240,
      drops: [
        { kind: "material", id: "ore_elunium", chance: 5 },
        { kind: "item", id: "helm_wizard", chance: 1 },
        { kind: "potion", id: "blue", chance: 4 },
      ],
    },
    {
      id: "skeleton",
      sprite: "assets/mobs/skeleton.png",
      portrait: "assets/mobs/skeleton.png",
      name: "สเกเลตัน",
      emoji: "💀",
      place: "ถ้ำหินพายอน",
      level: 20,
      str: 34,
      agi: 14,
      vit: 26,
      int: 8,
      dex: 22,
      luk: 4,
      hardDef: 30,
      hardMdef: 6,
      color: "#d8d0c0",
      hp: 6100,
      mp: 90,
      aspeed: 24,
      atk: 245,
      matk: 35,
      def: 30,
      mdef: 10,
      crit: 8,
      critMult: 50,
      dodge: 6,
      accuracy: 130,
      skills: ["mob_skel_slash", "mob_skel_bone"],
      baseExp: 530,
      jobExp: 345,
      zenoMin: 175,
      zenoMax: 270,
      drops: [
        { kind: "material", id: "ore_elunium", chance: 5 },
        { kind: "item", id: "acc_life", chance: 1 },
        { kind: "potion", id: "white", chance: 3 },
      ],
    },
  ];

  DATA.findMonster = function (id) {
    return DATA.MONSTERS.find(function (m) { return m.id === id; }) || DATA.MONSTERS[0];
  };

  DATA.BOSS_SKILLS = {
    mob_hop: { id: "mob_hop", name: "กระโดดชน", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.0, matkRatio: 0 },
    mob_bounce: { id: "mob_bounce", name: "เด้งใส่", cd: 3, mp: 8, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 1.5, matkRatio: 0 },
    mob_bite: { id: "mob_bite", name: "กัดใบไม้", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.1, matkRatio: 0 },
    mob_leaf: { id: "mob_leaf", name: "ใบมีด", cd: 3, mp: 10, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 1.6, matkRatio: 0 },
    mob_scratch: { id: "mob_scratch", name: "ข่วน", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.0, matkRatio: 0 },
    mob_kick: { id: "mob_kick", name: "เตะกระต่าย", cd: 3, mp: 10, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 1.7, matkRatio: 0 },
    mob_hit: { id: "mob_hit", name: "เหวี่ยงกิ่ง", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.2, matkRatio: 0 },
    mob_root: { id: "mob_root", name: "รากพัน", cd: 4, mp: 16, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 0.8, matkRatio: 0.8 },
    mob_peck: { id: "mob_peck", name: "จิก", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.15, matkRatio: 0 },
    mob_dive: { id: "mob_dive", name: "โฉบลง", cd: 4, mp: 14, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 1.9, matkRatio: 0 },
    mob_wolf_bite: { id: "mob_wolf_bite", name: "กัด", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.15, matkRatio: 0 },
    mob_wolf_howl: { id: "mob_wolf_howl", name: "คำรามฝูง", cd: 4, mp: 14, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 1.8, matkRatio: 0 },
    mob_pop_hop: { id: "mob_pop_hop", name: "กระโดดชน", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.0, matkRatio: 0 },
    mob_pop_acid: { id: "mob_pop_acid", name: "น้ำเมือกเปรี้ยว", cd: 3, mp: 12, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 0.6, matkRatio: 1.1, poison: 0.25, poisonTurns: 3 },
    mob_chon_buzz: { id: "mob_chon_buzz", name: "ชนปีก", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.05, matkRatio: 0 },
    mob_chon_dive: { id: "mob_chon_dive", name: "โฉบลง", cd: 3, mp: 10, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 1.7, matkRatio: 0 },
    mob_frog_tongue: { id: "mob_frog_tongue", name: "แลบลิ้น", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.1, matkRatio: 0 },
    mob_frog_slam: { id: "mob_frog_slam", name: "กระโดดทับ", cd: 4, mp: 16, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 1.9, matkRatio: 0 },
    mob_spore_puff: { id: "mob_spore_puff", name: "พ่นสปอร์", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 0.4, matkRatio: 0.9 },
    mob_spore_cloud: { id: "mob_spore_cloud", name: "หมอกละออง", cd: 4, mp: 18, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 0.3, matkRatio: 1.4 },
    mob_rock_strum: { id: "mob_rock_strum", name: "ดีดขา", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.1, matkRatio: 0 },
    mob_rock_screech: { id: "mob_rock_screech", name: "กรีดร้อง", cd: 3, mp: 14, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 1.75, matkRatio: 0 },
    mob_steel_buzz: { id: "mob_steel_buzz", name: "ชนเกราะ", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.2, matkRatio: 0 },
    mob_steel_ram: { id: "mob_steel_ram", name: "พุ่งชนเหล็ก", cd: 4, mp: 16, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 1.85, matkRatio: 0 },
    mob_babe_gore: { id: "mob_babe_gore", name: "ขวิด", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.2, matkRatio: 0 },
    mob_babe_rush: { id: "mob_babe_rush", name: "พุ่งชน", cd: 4, mp: 16, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 2.0, matkRatio: 0 },
    mob_elder_hit: { id: "mob_elder_hit", name: "เหวี่ยงกิ่งไฟ", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 0.8, matkRatio: 0.6 },
    mob_elder_flame: { id: "mob_elder_flame", name: "ไฟลามใบ", cd: 4, mp: 20, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 0.4, matkRatio: 1.5 },
    mob_skel_slash: { id: "mob_skel_slash", name: "ฟันดาบกระดูก", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png", atkRatio: 1.2, matkRatio: 0 },
    mob_skel_bone: { id: "mob_skel_bone", name: "ขว้างกระดูก", cd: 3, mp: 14, type: "attack", kind: "special", icon: "assets/skills/boss_special.png", atkRatio: 1.8, matkRatio: 0 },
    m_basic: { id: "m_basic", name: "โจมตีธรรมดา", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png" },
    m_power: { id: "m_power", name: "โจมตีสุดพลัง", cd: 4, mp: 60, type: "attack", kind: "special", icon: "assets/skills/boss_special.png" },
    m_dragon: { id: "m_dragon", name: "ลมปราณมังกร", cd: 5, mp: 90, type: "self", kind: "ultimate", icon: "assets/skills/boss_ult.png", hpPct: 0.2 },
    m_silence: { id: "m_silence", name: "คาถาสะกด", cd: 4, mp: 40, type: "attack", kind: "special", icon: "assets/skills/boss_special.png" },
    g_basic: { id: "g_basic", name: "โจมตีธรรมดา", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png" },
    g_power: { id: "g_power", name: "โจมตีสุดพลัง", cd: 3, mp: 20, type: "attack", kind: "special", icon: "assets/skills/boss_special.png" },
    g_landslide: { id: "g_landslide", name: "ท่าไม้ตายหินถล่ม", cd: 5, mp: 50, type: "attack", kind: "ultimate", icon: "assets/skills/boss_ult.png", hpFlat: 2000 },
    g_shield: { id: "g_shield", name: "โล่หินผา", cd: 7, mp: 40, type: "self", kind: "special", icon: "assets/skills/boss_buff.png" },
    w_basic: { id: "w_basic", name: "เขี้ยวเล็บสังหาร", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png" },
    w_claw: { id: "w_claw", name: "กรงเล็บหมื่นพิษ", cd: 2, mp: 50, type: "attack", kind: "special", icon: "assets/skills/boss_special.png" },
    w_fog: { id: "w_fog", name: "ขนขาวสายหมอก", cd: 7, mp: 70, type: "self", kind: "special", icon: "assets/skills/boss_buff.png" },
    w_fang: { id: "w_fang", name: "ท่าไม้ตายเขี้ยวขาว", cd: 7, mp: 90, type: "attack", kind: "ultimate", icon: "assets/skills/boss_ult.png", hpFlat: 1500 },
    k_basic: { id: "k_basic", name: "ฟันดาบสังหาร", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png" },
    k_thunder: { id: "k_thunder", name: "ฟาดฟันสายฟ้า", cd: 4, mp: 70, type: "attack", kind: "special", icon: "assets/skills/boss_special.png" },
    k_rage: { id: "k_rage", name: "โกรธเกรี้ยว", cd: 6, mp: 90, type: "self", kind: "special", icon: "assets/skills/boss_buff.png" },
    k_death: { id: "k_death", name: "ท่าไม้ตายอัศวินมรณะ", cd: 7, mp: 120, type: "attack", kind: "ultimate", icon: "assets/skills/boss_ult.png", hpPct: 0.2 },
    d_basic: { id: "d_basic", name: "กรงเล็บปีศาจ", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png" },
    d_hellfire: { id: "d_hellfire", name: "เปลวเพลิงนรก", cd: 4, mp: 80, type: "attack", kind: "special", icon: "assets/skills/boss_special.png" },
    d_curse: { id: "d_curse", name: "สาปมรณะ", cd: 6, mp: 100, type: "self", kind: "special", icon: "assets/skills/boss_buff.png" },
    d_apocalypse: { id: "d_apocalypse", name: "ท่าไม้ตายวันสิ้นโลก", cd: 8, mp: 150, type: "attack", kind: "ultimate", icon: "assets/skills/boss_ult.png", hpPct: 0.15 },
    a_basic: { id: "a_basic", name: "ปีกปกรรมณ์", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png" },
    a_storm: { id: "a_storm", name: "พรหพยุคะ", cd: 3, mp: 70, type: "attack", kind: "special", icon: "assets/skills/boss_special.png" },
    a_veil: { id: "a_veil", name: "ปกปกาศ", cd: 6, mp: 90, type: "self", kind: "special", icon: "assets/skills/boss_buff.png" },
    a_ult: { id: "a_ult", name: "ท่าไม้ตายวินาศ", cd: 7, mp: 140, type: "attack", kind: "ultimate", icon: "assets/skills/boss_ult.png", hpPct: 0.18 },
    dr_basic: { id: "dr_basic", name: "กรงเล็บนิรันทร์", cd: 0, mp: 0, type: "attack", kind: "basic", icon: "assets/skills/boss_basic.png" },
    dr_ruin: { id: "dr_ruin", name: "พ่ายพิภพลาญ", cd: 3, mp: 90, type: "attack", kind: "special", icon: "assets/skills/boss_special.png" },
    dr_wrath: { id: "dr_wrath", name: "เกร็กวินาศ", cd: 6, mp: 120, type: "self", kind: "special", icon: "assets/skills/boss_buff.png" },
    dr_ult: { id: "dr_ult", name: "ท่าไม้ตายสิ้นโลก", cd: 8, mp: 180, type: "attack", kind: "ultimate", icon: "assets/skills/boss_ult.png", hpPct: 0.12 },
  };

  DATA.SLOTS = [
    { id: "helm", name: "หมวก", icon: "🪖", type: "helm" },
    { id: "eyes", name: "อุปกรณ์ส่วนตา", icon: "🕶️", type: "eyes" },
    { id: "mouth", name: "อุปกรณ์ส่วนปาก", icon: "😷", type: "mouth" },
    { id: "armor", name: "เสื้อ", icon: "👕", type: "armor" },
    { id: "weapon", name: "อาวุธ", icon: "🗡️", type: "weapon" },
    { id: "shield", name: "โล่", icon: "🛡️", type: "shield" },
    { id: "cloak", name: "ผ้าคลุม", icon: "🧥", type: "cloak" },
    { id: "boots", name: "รองเท้า", icon: "👢", type: "boots" },
    { id: "accL", name: "เครื่องประดับซ้าย", icon: "💍", type: "acc" },
    { id: "accR", name: "เครื่องประดับขวา", icon: "💍", type: "acc" },
  ];

  DATA.ITEMS = {
    helm_leather: { id: "helm_leather", weight: 10, type: "helm", name: "หมวกผ้า", price: 80, jobs: "all", defTier: "low", bonuses: { hardDef: 1 } },
    helm_iron: { id: "helm_iron", weight: 20, type: "helm", name: "หมวกหนัง", price: 150, jobs: DATA.JOB_MID, defTier: "mid", bonuses: { hardDef: 3 } },
    helm_wizard: { id: "helm_wizard", weight: 20, type: "helm", name: "หมวกสำรวจ", price: 160, jobs: DATA.JOB_MID, defTier: "mid", bonuses: { hardDef: 4 } },
    helm_crown: { id: "helm_crown", weight: 40, type: "helm", name: "หมวกเหล็ก", price: 320, jobs: DATA.JOB_HEAVY, defTier: "high", bonuses: { hardDef: 5 } },

    eyes_hunter: { id: "eyes_hunter", weight: 10, type: "eyes", name: "แว่นตาล่าสัตว์", price: 90, bonuses: { accuracy: 3 } },
    eyes_pirate: { id: "eyes_pirate", weight: 10, type: "eyes", name: "ผ้าปิดตาโจรสลัด", price: 100, bonuses: { crit: 3 } },
    eyes_magic: { id: "eyes_magic", weight: 10, type: "eyes", name: "แว่นเวทมนตร์", price: 150, bonuses: { matk: 10, accuracy: 2 } },
    eyes_third: { id: "eyes_third", weight: 10, type: "eyes", name: "ตาที่สามศักดิ์สิทธิ์", price: 280, bonuses: { crit: 5, accuracy: 5 } },

    mouth_scarf: { id: "mouth_scarf", weight: 10, type: "mouth", name: "ผ้าพันคอ", price: 70, bonuses: { mp: 15 } },
    mouth_mask: { id: "mouth_mask", weight: 10, type: "mouth", name: "หน้ากากปิดปาก", price: 200, bonuses: { mpRegen: 2 } },
    mouth_pipe: { id: "mouth_pipe", weight: 15, type: "mouth", name: "ท่อหายใจเวทมนตร์", price: 200, bonuses: { mp: 25, mpRegen: 3 } },
    mouth_dragon: { id: "mouth_dragon", weight: 20, type: "mouth", name: "สร้อยคางมังกร", price: 250, bonuses: { atk: 25, hpRegen: 4 } },

    armor_rough: { id: "armor_rough", weight: 10, type: "armor", name: "เสื้อผ้าฝ้าย", price: 150, jobs: "all", defTier: "low", bonuses: { hardDef: 1 } },
    armor_chain: { id: "armor_chain", weight: 50, type: "armor", name: "ชุดผจญภัย", price: 250, jobs: DATA.JOB_MID, defTier: "mid", bonuses: { hardDef: 5 } },
    armor_robe: { id: "armor_robe", weight: 30, type: "armor", name: "ชุดคลุม", price: 400, jobs: "all", defTier: "low", bonuses: { hardDef: 2 } },
    armor_knight: { id: "armor_knight", weight: 100, type: "armor", name: "เกราะโซ่", price: 500, jobs: DATA.JOB_HEAVY, defTier: "high", bonuses: { hardDef: 8 } },

    weapon_short: { id: "weapon_short", weight: 50, type: "weapon", name: "ดาบสั้นฝึกซ้อม", price: 200, weaponClass: "sword", weaponAtk: 70, weaponMatk: 0, reqLevel: 1, element: "none", jobs: DATA.JOB_SWORD, bonuses: {} },
    weapon_long: { id: "weapon_long", weight: 70, type: "weapon", name: "ดาบยาว", price: 600, weaponClass: "sword", weaponAtk: 120, weaponMatk: 0, reqLevel: 12, element: "none", jobs: DATA.JOB_SWORD, bonuses: {} },
    weapon_void: { id: "weapon_void", weight: 100, type: "weapon", name: "ดาบราชัน", price: 1500, weaponClass: "sword", weaponAtk: 200, weaponMatk: 0, reqLevel: 35, element: "none", jobs: DATA.JOB_SWORD, bonuses: {}, tier: "high" },
    weapon_claymore: { id: "weapon_claymore", weight: 120, type: "weapon", name: "ดาบสองมือ", price: 800, weaponClass: "sword", weaponAtk: 140, twoHand: true, reqLevel: 12, element: "none", jobs: DATA.JOB_SWORD, bonuses: {} },
    weapon_knife: { id: "weapon_knife", weight: 40, type: "weapon", name: "มีดสั้นฝึก", price: 180, weaponClass: "dagger", weaponAtk: 40, weaponMatk: 0, reqLevel: 1, element: "none", jobs: DATA.JOB_DAGGER, bonuses: {} },
    weapon_dirk: { id: "weapon_dirk", weight: 50, type: "weapon", name: "กริช", price: 500, weaponClass: "dagger", weaponAtk: 75, weaponMatk: 0, reqLevel: 12, element: "none", jobs: DATA.JOB_DAGGER, bonuses: {} },
    weapon_shadow: { id: "weapon_shadow", weight: 60, type: "weapon", name: "กริชเงา", price: 1200, weaponClass: "dagger", weaponAtk: 120, weaponMatk: 0, reqLevel: 30, element: "none", jobs: DATA.JOB_DAGGER, bonuses: {}, tier: "high" },
    weapon_bow: { id: "weapon_bow", weight: 50, type: "weapon", name: "ธนูฝึกยิง", price: 200, weaponClass: "bow", weaponAtk: 60, weaponMatk: 0, weaponLevel: 1, twoHand: true, reqLevel: 1, element: "none", jobs: DATA.JOB_BOW, bonuses: {} },
    weapon_oakbow: { id: "weapon_oakbow", weight: 90, type: "weapon", name: "ธนูไม้โอ๊ค", price: 550, weaponClass: "bow", weaponAtk: 100, weaponMatk: 0, weaponLevel: 1, twoHand: true, reqLevel: 12, element: "none", jobs: DATA.JOB_BOW, bonuses: {} },
    weapon_hawk: { id: "weapon_hawk", weight: 120, type: "weapon", name: "ธนูเหยี่ยว", price: 1400, weaponClass: "bow", weaponAtk: 150, weaponMatk: 0, weaponLevel: 1, twoHand: true, reqLevel: 32, element: "none", jobs: DATA.JOB_BOW, bonuses: {}, tier: "high" },
    weapon_staff: { id: "weapon_staff", weight: 40, type: "weapon", name: "คทาฝึกเวท", price: 200, weaponClass: "staff", weaponAtk: 0, weaponMatk: 100, reqLevel: 1, element: "none", jobs: DATA.JOB_STAFF, bonuses: {} },
    weapon_arch: { id: "weapon_arch", weight: 50, type: "weapon", name: "คทาไม้", price: 650, weaponClass: "staff", weaponAtk: 0, weaponMatk: 170, reqLevel: 14, element: "none", jobs: DATA.JOB_STAFF, bonuses: {} },
    weapon_sage: { id: "weapon_sage", weight: 70, type: "weapon", name: "คทามหาเวท", price: 1600, weaponClass: "staff", weaponAtk: 0, weaponMatk: 260, reqLevel: 36, element: "none", jobs: DATA.JOB_STAFF, bonuses: {}, tier: "high" },
    weapon_hatchet: { id: "weapon_hatchet", weight: 80, type: "weapon", name: "ขวานไม้", price: 220, weaponClass: "axe", weaponAtk: 100, weaponMatk: 0, reqLevel: 1, element: "none", jobs: DATA.JOB_AXE, bonuses: {} },
    weapon_battleaxe: { id: "weapon_battleaxe", weight: 150, type: "weapon", name: "ขวานต่อสู้", price: 700, weaponClass: "axe", weaponAtk: 160, weaponMatk: 0, reqLevel: 16, element: "none", jobs: DATA.JOB_AXE, bonuses: {} },
    weapon_waraxe: { id: "weapon_waraxe", weight: 200, type: "weapon", name: "ขวานสงคราม", price: 1600, weaponClass: "axe", weaponAtk: 250, weaponMatk: 0, reqLevel: 38, element: "none", jobs: DATA.JOB_AXE, bonuses: {}, tier: "high" },
    weapon_club: { id: "weapon_club", weight: 50, type: "weapon", name: "กระบองไม้", price: 180, weaponClass: "mace", weaponAtk: 60, weaponMatk: 0, reqLevel: 1, element: "none", jobs: DATA.JOB_MACE, bonuses: {} },
    weapon_mace: { id: "weapon_mace", weight: 70, type: "weapon", name: "กระบองเหล็ก", price: 550, weaponClass: "mace", weaponAtk: 110, weaponMatk: 0, reqLevel: 12, element: "none", jobs: DATA.JOB_MACE, bonuses: {} },
    weapon_holy: { id: "weapon_holy", weight: 80, type: "weapon", name: "กระบองศักดิ์สิทธิ์", price: 1400, weaponClass: "mace", weaponAtk: 180, weaponMatk: 0, reqLevel: 34, element: "none", jobs: DATA.JOB_MACE, bonuses: {}, tier: "high" },

    shield_wood: { id: "shield_wood", weight: 30, type: "shield", name: "โล่ไม้", price: 80, jobs: "all", defTier: "low", bonuses: { hardDef: 1 } },
    shield_iron: { id: "shield_iron", weight: 40, type: "shield", name: "บัคเลอร์", price: 160, jobs: DATA.JOB_MID, defTier: "mid", bonuses: { hardDef: 4 } },
    shield_magic: { id: "shield_magic", weight: 40, type: "shield", name: "โล่เล็ก", price: 180, jobs: "all", defTier: "low", bonuses: { hardDef: 2 } },
    shield_dragon: { id: "shield_dragon", weight: 80, type: "shield", name: "โล่เหล็ก", price: 300, jobs: DATA.JOB_HEAVY, defTier: "high", bonuses: { hardDef: 6 } },

    cloak_travel: { id: "cloak_travel", weight: 10, type: "cloak", name: "ฮู้ดผ้า", price: 100, jobs: "all", defTier: "low", bonuses: { hardDef: 1 } },
    cloak_shadow: { id: "cloak_shadow", weight: 20, type: "cloak", name: "ผ้าคลุมผจญภัย", price: 130, jobs: DATA.JOB_MID, defTier: "mid", bonuses: { hardDef: 2 } },
    cloak_mage: { id: "cloak_mage", weight: 20, type: "cloak", name: "ผ้าคลุม", price: 200, jobs: "all", defTier: "low", bonuses: { hardDef: 1 } },
    cloak_invis: { id: "cloak_invis", weight: 40, type: "cloak", name: "แมนเทิล", price: 260, jobs: DATA.JOB_HEAVY, defTier: "high", bonuses: { hardDef: 3 } },

    boots_leather: { id: "boots_leather", weight: 10, type: "boots", name: "รองเท้าแตะ", price: 120, jobs: "all", defTier: "low", bonuses: { hardDef: 1 } },
    boots_light: { id: "boots_light", weight: 10, type: "boots", name: "รองเท้าผ้า", price: 150, jobs: "all", defTier: "low", bonuses: { hardDef: 1 } },
    boots_hunt: { id: "boots_hunt", weight: 20, type: "boots", name: "รองเท้าหนัง", price: 200, jobs: DATA.JOB_MID, defTier: "mid", bonuses: { hardDef: 2 } },
    boots_wing: { id: "boots_wing", weight: 40, type: "boots", name: "รองเท้าทหาร", price: 300, jobs: DATA.JOB_HEAVY, defTier: "high", bonuses: { hardDef: 3 } },

    acc_power: { id: "acc_power", weight: 10, type: "acc", name: "แหวนพลัง", price: 400, bonuses: { atk: 10, matk: 10 } },
    acc_magic: { id: "acc_magic", weight: 10, type: "acc", name: "แหวนเวทย์", price: 400, bonuses: { matk: 30 } },
    acc_life: { id: "acc_life", weight: 10, type: "acc", name: "สร้อยชีวิต", price: 300, bonuses: { hp: 50, hpRegen: 1 } },
    acc_wizard: { id: "acc_wizard", weight: 10, type: "acc", name: "แหวนนักเวท", price: 300, bonuses: { mp: 20, mpRegen: 1 } },
    acc_luck: { id: "acc_luck", weight: 10, type: "acc", name: "จี้โชคลาภ", price: 500, bonuses: { crit: 3, critMult: 10 } },

    helm_abyss: { id: "helm_abyss", weight: 80, type: "helm", name: "เกรทเฮล์ม", price: 900, tier: "high", jobs: DATA.JOB_HEAVY, defTier: "high", bonuses: { hardDef: 6 } },
    eyes_judge: { id: "eyes_judge", weight: 10, type: "eyes", name: "ดวงตาผู้พิพากษาอเวจี", price: 850, tier: "high", bonuses: { crit: 12, accuracy: 12 } },
    mouth_whisper: { id: "mouth_whisper", weight: 20, type: "mouth", name: "หน้ากากกระซิบมรณะ", price: 800, tier: "high", bonuses: { mp: 80, mpRegen: 8 } },
    armor_ruin: { id: "armor_ruin", weight: 220, type: "armor", name: "เกราะแผ่น", price: 1400, tier: "high", jobs: DATA.JOB_HEAVY, defTier: "high", bonuses: { hardDef: 10 } },
    shield_eclipse: { id: "shield_eclipse", weight: 150, type: "shield", name: "โล่ทาวเวอร์", price: 1100, tier: "high", jobs: DATA.JOB_HEAVY, defTier: "high", bonuses: { hardDef: 8 } },
    cloak_night: { id: "cloak_night", weight: 50, type: "cloak", name: "ผ้าคลุมทหาร", price: 1000, tier: "high", jobs: DATA.JOB_HEAVY, defTier: "high", bonuses: { hardDef: 4 } },
    boots_gale: { id: "boots_gale", weight: 60, type: "boots", name: "รองเท้าเหล็ก", price: 950, tier: "high", jobs: DATA.JOB_HEAVY, defTier: "high", bonuses: { hardDef: 4 } },
    acc_triad: { id: "acc_triad", weight: 10, type: "acc", name: "แหวนอสูรสามภพ", price: 1300, tier: "high", bonuses: { atk: 35, matk: 35, crit: 8 } },

    arrow: { id: "arrow", type: "ammo", name: "ลูกธนู", price: 1, arrowAtk: 25, reqLevel: 1, element: "none", jobs: DATA.JOB_BOW, stack: true, weight: 1, bonuses: {} },
    arrow_steel: { id: "arrow_steel", type: "ammo", name: "ลูกธนูเหล็ก", price: 4, arrowAtk: 40, reqLevel: 12, element: "none", jobs: DATA.JOB_BOW, stack: true, weight: 1, bonuses: {} },
    arrow_oridecon: { id: "arrow_oridecon", type: "ammo", name: "ลูกธนูโอริเดคอน", price: 10, arrowAtk: 50, reqLevel: 32, element: "none", jobs: DATA.JOB_BOW, stack: true, weight: 1, bonuses: {} },
  };

  DATA.ITEMS_BY_TYPE = {};
  Object.values(DATA.ITEMS).forEach(function (it) {
    if (!DATA.ITEMS_BY_TYPE[it.type]) DATA.ITEMS_BY_TYPE[it.type] = [];
    DATA.ITEMS_BY_TYPE[it.type].push(it);
  });
  DATA.AMMO_ORDER = [];
  DATA.ARROWS_IN_SHOP = false;

  /* Refine: wearables grant Hard DEF/MDEF; weapon grants ATK/MATK (assumed +8/+8). */
  DATA.HARD_PER_REFINE = 0.7;
  DATA.WEAPON_ATK_PER_REFINE = 8;
  DATA.WEAPON_MATK_PER_REFINE = 8;
  DATA.REFINE_MAX = 10;
  DATA.REFINABLE_WEARABLE_TYPES = ["helm", "armor", "boots", "cloak", "shield"];
  DATA.REFINABLE_TYPES = ["helm", "armor", "boots", "cloak", "shield", "weapon"];
  DATA.REFINE_CHANCE = { 1: 100, 2: 100, 3: 100, 4: 100, 5: 70, 6: 70, 7: 40, 8: 40, 9: 40, 10: 40 };
  DATA.REFINE_COST = { 1: 100, 2: 200, 3: 300, 4: 400, 5: 600, 6: 800, 7: 1200, 8: 1600, 9: 2200, 10: 3000 };

  DATA.isRefinableType = function (type) {
    return DATA.REFINABLE_TYPES.indexOf(type) >= 0;
  };
  DATA.isWearableRefinable = function (type) {
    return DATA.REFINABLE_WEARABLE_TYPES.indexOf(type) >= 0;
  };
  DATA.refineChanceTo = function (plus) {
    const n = Math.floor(Number(plus) || 0);
    return DATA.REFINE_CHANCE[n] == null ? 0 : DATA.REFINE_CHANCE[n];
  };
  DATA.refineCostTo = function (plus) {
    const n = Math.floor(Number(plus) || 0);
    return DATA.REFINE_COST[n] == null ? 0 : DATA.REFINE_COST[n];
  };
  DATA.refineOreFor = function (item, nextPlus) {
    const n = Math.floor(Number(nextPlus) || 0);
    const type = item && item.type;
    if (n >= 1 && n <= 4) return "ore_phracon";
    if (n >= 5 && n <= 10) {
      if (type === "weapon") return "ore_oridecon";
      if (DATA.isWearableRefinable(type)) return "ore_elunium";
    }
    return null;
  };
  DATA.hardFromPlus = function (plus) {
    const n = Math.max(0, Math.floor(Number(plus) || 0));
    return n * DATA.HARD_PER_REFINE;
  };

  DATA.POTIONS = {
    red: { id: "red", weight: 70, name: "ยาแดง", emoji: "🧪", healHp: 200, healMp: 0, price: 25, desc: "ฟื้น HP 200" },
    orange: { id: "orange", weight: 10, name: "ยาส้ม", emoji: "🟠", healHp: 600, healMp: 0, price: 80, desc: "ฟื้น HP 600" },
    white: { id: "white", weight: 15, name: "ยาขาว", emoji: "⚪", healHp: 1200, healMp: 0, price: 180, desc: "ฟื้น HP 1200" },
    blue: { id: "blue", weight: 15, name: "ยาฟ้า", emoji: "🔵", healHp: 0, healMp: 80, price: 60, desc: "ฟื้น MP 80" },
    berserk: { id: "berserk", weight: 20, name: "Berserk Potion", emoji: "💢", healHp: 0, healMp: 0, price: 250, aspdMod: DATA.BERSERK_ASPD_MOD, durationMs: DATA.BERSERK_DURATION_MS, desc: "Potion ASPD +20% นาน 30 นาที" },
  };
  DATA.POTION_ORDER = ["red", "orange", "white", "blue", "berserk"];
  DATA.emptyPotions = function () {
    return { red: 0, orange: 0, white: 0, blue: 0, berserk: 0 };
  };

  DATA.MATERIALS = {
    jellopy: { id: "jellopy", weight: 10, name: "เจลลอปี้", emoji: "🟡" },
    clover: { id: "clover", weight: 2, name: "ใบโคลเวอร์", emoji: "🍀" },
    feather: { id: "feather", weight: 2, name: "ขนนก", emoji: "🪶" },
    ore_phracon: { id: "ore_phracon", weight: 20, name: "แร่ไฟคอน", emoji: "🪨" },
    ore_elunium: { id: "ore_elunium", weight: 20, name: "เอลูเนียม", emoji: "💠" },
    ore_oridecon: { id: "ore_oridecon", weight: 20, name: "โอริเดคอน", emoji: "🔷" },
  };

  DATA.lootName = function (id) {
    const pot = DATA.POTIONS && DATA.POTIONS[id];
    if (pot && pot.name) return pot.name;
    const mat = DATA.MATERIALS && DATA.MATERIALS[id];
    if (mat && mat.name) return mat.name;
    const it = DATA.ITEMS && DATA.ITEMS[id];
    if (it && it.name) return it.name;
    return id;
  };

  DATA.sellZeno = function (price) {
    var p = Math.floor(Number(price) || 0);
    if (p < 1) return 0;
    return Math.max(1, Math.floor(p / 2));
  };
  DATA.buyPriceOf = function (id) {
    var pot = DATA.POTIONS && DATA.POTIONS[id];
    if (pot) return Number(pot.price) || 0;
    var it = DATA.ITEMS && DATA.ITEMS[id];
    if (it) return Number(it.price) || 0;
    var mat = DATA.MATERIALS && DATA.MATERIALS[id];
    if (mat) return Number(mat.price) || 0;
    return 0;
  };

  DATA.activePotionAspdMod = function (buffs, now) {
    now = now != null ? now : Date.now();
    buffs = buffs || {};
    var best = 0;
    Object.keys(buffs).forEach(function (id) {
      var b = buffs[id];
      if (!b || !b.until || b.until <= now) return;
      best = Math.max(best, Number(b.aspdMod) || 0);
    });
    return best;
  };

  DATA.SKILL_TREES = {
    warrior: [
      { id: "sword_mastery", requires: [] },
      { id: "twohand_mastery", requires: [{ id: "sword_mastery", min: 1 }] },
      { id: "increase_hp_recovery", requires: [] },
      { id: "bash", requires: [] },
      { id: "magnum_break", requires: [{ id: "bash", min: 5 }] },
      { id: "provoke", requires: [] },
      { id: "endure", requires: [{ id: "provoke", min: 5 }] },
    ],
    assassin: [
      { id: "double_attack", requires: [] },
      { id: "improve_dodge", requires: [] },
      { id: "steal", requires: [] },
      { id: "hiding", requires: [{ id: "steal", min: 5 }] },
      { id: "envenom", requires: [] },
      { id: "detoxify", requires: [{ id: "envenom", min: 3 }] },
    ],
    hunter: [
      { id: "owl_eye", requires: [] },
      { id: "vulture_eye", requires: [{ id: "owl_eye", min: 3 }] },
      { id: "double_strafe", requires: [{ id: "vulture_eye", min: 10 }] },
      { id: "arrow_shower", requires: [{ id: "double_strafe", min: 5 }] },
      { id: "improve_concentration", requires: [] },
      { id: "arrow_repel", requires: [{ id: "improve_concentration", min: 1 }] },
    ],
  };

  DATA.SKILL_ROOTS = {
    warrior: ["bash", "provoke"],
    assassin: ["double_attack", "steal"],
    hunter: ["owl_eye", "improve_concentration"],
  };

  DATA.SKILL_BRANCHES = {
    warrior: [
      ["sword_mastery", "twohand_mastery"],
      ["increase_hp_recovery"],
      ["bash", "magnum_break"],
      ["provoke", "endure"],
    ],
    assassin: [
      ["double_attack"],
      ["improve_dodge"],
      ["steal", "hiding"],
      ["envenom", "detoxify"],
    ],
    hunter: [
      ["owl_eye", "vulture_eye", "double_strafe", "arrow_shower"],
      ["improve_concentration", "arrow_repel"],
    ],
  };

  DATA.treeNodes = function (heroId) {
    return DATA.SKILL_TREES[heroId] || [];
  };

  DATA.defaultSkillRanks = function (heroId) {
    const ranks = {};
    DATA.treeNodes(heroId).forEach(function (n) {
      ranks[n.id] = 0;
    });
    (DATA.SKILL_ROOTS[heroId] || []).forEach(function (id) {
      ranks[id] = 1;
    });
    return ranks;
  };

  DATA.learnedSkills = function (heroId, ranks) {
    ranks = ranks || {};
    return DATA.treeNodes(heroId)
      .filter(function (n) {
        return (ranks[n.id] || 0) >= 1;
      })
      .map(function (n) {
        return n.id;
      });
  };

  DATA.findSkillNode = function (skillId, heroId) {
    const trees = heroId ? [DATA.SKILL_TREES[heroId] || []] : Object.keys(DATA.SKILL_TREES).map(function (k) {
      return DATA.SKILL_TREES[k];
    });
    let found = null;
    trees.forEach(function (tree) {
      if (found || !tree) return;
      tree.forEach(function (n) {
        if (n.id === skillId) found = n;
      });
    });
    return found;
  };

  DATA.skillUnlocked = function (skillId, ranks, heroId) {
    ranks = ranks || {};
    const node = DATA.findSkillNode(skillId, heroId);
    if (!node) return false;
    if (!node.requires || !node.requires.length) return true;
    return node.requires.every(function (r) {
      return (ranks[r.id] || 0) >= r.min;
    });
  };

  DATA.prereqText = function (skillId, heroId) {
    const node = DATA.findSkillNode(skillId, heroId);
    if (!node || !node.requires || !node.requires.length) return "";
    return node.requires
      .map(function (r) {
        const sk = DATA.SKILLS[r.id];
        return (sk ? sk.name : r.id) + " ≥ " + r.min;
      })
      .join(" และ ");
  };

  DATA.createSkillSession = function (lockedRanks, pool, heroId) {
    const locked = Object.assign(DATA.defaultSkillRanks(heroId), lockedRanks || {});
    const session = {};
    DATA.treeNodes(heroId).forEach(function (n) {
      session[n.id] = 0;
    });
    return { locked: locked, session: session, pool: pool, heroId: heroId };
  };

  DATA.skillSessionRank = function (sess, id) {
    return (sess.locked[id] || 0) + (sess.session[id] || 0);
  };

  DATA.skillSessionPreview = function (sess) {
    const out = {};
    DATA.treeNodes(sess.heroId).forEach(function (n) {
      out[n.id] = DATA.skillSessionRank(sess, n.id);
    });
    return out;
  };

  DATA.skillSessionSpent = function (sess) {
    return DATA.treeNodes(sess.heroId).reduce(function (s, n) {
      return s + (sess.session[n.id] || 0);
    }, 0);
  };

  DATA.skillSessionRemaining = function (sess) {
    return sess.pool - DATA.skillSessionSpent(sess);
  };

  DATA.skillAdd = function (sess, id) {
    const preview = DATA.skillSessionPreview(sess);
    const cap = (DATA.SKILLS[id] && DATA.SKILLS[id].maxRank) || DATA.SKILL_MAX_RANK;
    if (DATA.skillSessionRank(sess, id) >= cap) return false;
    if (DATA.skillSessionRemaining(sess) < 1) return false;
    if (!DATA.skillUnlocked(id, preview, sess.heroId)) return false;
    sess.session[id] = (sess.session[id] || 0) + 1;
    return true;
  };

  DATA.skillSub = function (sess, id) {
    if ((sess.session[id] || 0) <= 0) return false;
    const next = DATA.skillSessionPreview(sess);
    next[id] -= 1;
    const blocked = DATA.treeNodes(sess.heroId).some(function (n) {
      const r = n.id === id ? next[id] : DATA.skillSessionRank(sess, n.id);
      if (r <= 0) return false;
      return !DATA.skillUnlocked(n.id, next, sess.heroId);
    });
    if (blocked) return false;
    sess.session[id] -= 1;
    return true;
  };

  DATA.commitSkillSession = function (sess) {
    return DATA.skillSessionPreview(sess);
  };

  DATA.emptyAllocated = function () {
    return { str: 0, vit: 0, int: 0, agi: 0, dex: 0, luk: 0 };
  };

  DATA.emptyEquip = function () {
    return {
      helm: null,
      eyes: null,
      mouth: null,
      armor: null,
      weapon: null,
      shield: null,
      cloak: null,
      boots: null,
      accL: null,
      accR: null,
    };
  };

  root.DATA = DATA;
})(typeof globalThis !== "undefined" ? globalThis : window);
