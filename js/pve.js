/**
 * PvE adventure flow:
 * job select → name → alloc → Prontera hub (shop / equip / refine) → field / boss select (ATB).
 */
(function (root) {
  const DATA = root.DATA;
  const STATS = root.STATS;
  const COMBAT = root.COMBAT;
  const PVE = {};

  PVE.CHAR_NAME_MAX = 24;
  PVE.isBowHero = function (heroId) {
    return DATA.heroJob(heroId) === "archer" || heroId === "hunter";
  };
  PVE.countNameChars = function (s) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(s)).length;
    }
    return Array.from(s).length;
  };
  PVE.validateCharName = function (name) {
    const n = String(name == null ? "" : name).trim();
    const len = PVE.countNameChars(n);
    if (!n || len < 1 || len > PVE.CHAR_NAME_MAX) return { ok: false, name: n };
    return { ok: true, name: n };
  };

  PVE.ACCOUNT_STORE_KEY = "ro-world-accounts-v1";
  PVE.LAST_USER_KEY = "ro-world-last-user";
  PVE.validateUsername = function (name) {
    const n = String(name == null ? "" : name).trim();
    const len = PVE.countNameChars(n);
    if (!n || len < 1 || len > PVE.CHAR_NAME_MAX) return { ok: false, name: n };
    if (!/^[\u0E00-\u0E7FA-Za-z0-9_-]+$/.test(n)) return { ok: false, name: n };
    if (!n.replace(/[_-]/g, "")) return { ok: false, name: n };
    return { ok: true, name: n };
  };
  PVE._readStore = function () {
    try {
      if (typeof localStorage === "undefined") return {};
      const raw = localStorage.getItem(PVE.ACCOUNT_STORE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) { return {}; }
  };
  PVE._writeStore = function (obj) {
    try {
      if (typeof localStorage === "undefined") return false;
      localStorage.setItem(PVE.ACCOUNT_STORE_KEY, JSON.stringify(obj));
      return true;
    } catch (e) { return false; }
  };
  PVE.listAccounts = function () {
    const store = PVE._readStore();
    return Object.keys(store).map(function (username) {
      const s = store[username] || {};
      const hero = (typeof DATA !== "undefined" && DATA.HEROES && DATA.HEROES[s.heroId]) || {};
      return {
        username: username,
        charName: s.charName || hero.name || username,
        heroId: s.heroId || "",
        jobName: hero.name || "",
        baseLevel: s.baseLevel || s.level || 1,
        jobLevel: s.jobLevel || 1,
        zeno: s.zeno || 0,
        savedAt: s.savedAt || 0,
      };
    }).sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
  };
  PVE.readAccount = function (username) {
    const v = PVE.validateUsername(username);
    if (!v.ok) return null;
    const s = PVE._readStore()[v.name];
    if (!s) return null;
    const clone = JSON.parse(JSON.stringify(s));
    delete clone.savedAt;
    clone.username = v.name;
    return PVE.ensureProgress(clone);
  };
  PVE.writeAccount = function (username, save) {
    const v = PVE.validateUsername(username);
    if (!v.ok || !save) return { ok: false, error: "username" };
    const store = PVE._readStore();
    const clone = JSON.parse(JSON.stringify(save));
    clone.username = v.name;
    clone.savedAt = Date.now();
    store[v.name] = clone;
    PVE._writeStore(store);
    try { localStorage.setItem(PVE.LAST_USER_KEY, v.name); } catch (e) {}
    return { ok: true, name: v.name };
  };
  PVE.lastUsername = function () {
    try { return localStorage.getItem(PVE.LAST_USER_KEY) || ""; } catch (e) { return ""; }
  };

  PVE.createSave = function (heroId, allocated, charName) {
    const save = {
      heroId: heroId,
      allocated: Object.assign(DATA.emptyAllocated(), allocated),
      level: 1,
      baseLevel: 1,
      jobLevel: 1,
      baseExp: 0,
      jobExp: 0,
      unspentStatPoints: 0,
      zeno: DATA.START_ZENO,
      owned: {},
      refine: {},
      equip: DATA.emptyEquip(),
      potions: Object.assign(DATA.emptyPotions(), DATA.START_POTIONS || {}),
      potionBuffs: {},
      hp: null,
      mp: null,
      bossIndex: 0,
      skillRanks: DATA.defaultSkillRanks(heroId),
      skillPoints: DATA.SKILL_POINT_START,
      clearedBosses: {},
      mapId: "city",
      mapPos: null,
      cityPos: null,
      fieldPos: null,
      autoFarm: false,
      autoFarmCfg: {
        sitHpOn: true,
        sitHp: 30,
        sitMpOn: true,
        sitMp: 20,
        skills: [null, null, null, null],
        pots: [
          { id: null, when: "hp", pct: 40 },
          { id: null, when: "mp", pct: 20 },
          { id: null, when: "hp", pct: 50 }
        ],
        mobIds: [],
        mobNone: false
      },
      materials: {},
      currentBossId: null,
      currentMonsterId: null,
      fightKind: null,
      charName: typeof charName === "string" ? charName : "",
      username: "",
    };
    if (PVE.isBowHero(heroId)) {
      save.ammo = { id: "arrow", count: 100 };
      save.arrow = "arrow";
      save.arrowCount = 100;
    }
    return save;
  };

  PVE.ensureProgress = function (save) {
    if (!save) return save;
    if (save.baseLevel == null) save.baseLevel = save.level || 1;
    if (save.jobLevel == null) save.jobLevel = 1;
    if (save.baseExp == null) save.baseExp = 0;
    if (save.jobExp == null) save.jobExp = 0;
    if (save.unspentStatPoints == null) save.unspentStatPoints = 0;
    if (!save.potions) save.potions = Object.assign(DATA.emptyPotions(), DATA.START_POTIONS || {});
    else {
      const empty = DATA.emptyPotions();
      Object.keys(empty).forEach(function (k) {
        if (save.potions[k] == null) save.potions[k] = empty[k];
      });
    }
    if (!save.potionBuffs) save.potionBuffs = {};
    if (!save.refine) save.refine = {};
    if (!save.mapId) save.mapId = "city";
    if (save.autoFarm == null) save.autoFarm = false;
    if (!save.materials || typeof save.materials !== "object" || Array.isArray(save.materials)) {
      save.materials = {};
    }
    PVE.ensureAutoFarmCfg(save);
    if (!save.charName) {
      const hero = DATA.HEROES[save.heroId];
      save.charName = (hero && hero.name) || "";
    }
    if (save.username == null) save.username = "";
    if (save.equip) {
      DATA.SLOTS.forEach(function (slot) {
        const id = save.equip[slot.id];
        if (!id) return;
        const item = DATA.ITEMS[id];
        if (!item || !DATA.canJobWear(save.heroId, item)) {
          save.equip[slot.id] = null;
        }
      });
    }
    if (PVE.isBowHero(save.heroId) && save.ammo === undefined) {
      if (save.arrowCount != null || save.arrow) {
        save.ammo = {
          id: save.arrow || "arrow",
          count: save.arrowCount != null ? Math.max(0, Math.floor(Number(save.arrowCount) || 0)) : 0,
        };
      } else {
        save.ammo = { id: "arrow", count: 100 };
        save.arrow = "arrow";
        save.arrowCount = 100;
      }
    }
    if (save.ammo && typeof save.ammo === "object") {
      if (save.arrowCount == null && save.ammo.count != null) save.arrowCount = save.ammo.count;
      if (save.arrow == null && save.ammo.id) save.arrow = save.ammo.id;
    }
    save.level = save.baseLevel;
    return save;
  };

  function clampFarmPct(n, fallback) {
    var v = Math.floor(Number(n));
    if (!isFinite(v)) v = fallback == null ? 40 : fallback;
    if (v < 1) v = 1;
    if (v > 99) v = 99;
    return v;
  }

  PVE.ensureAutoFarmCfg = function (save) {
    if (!save) return null;
    var defPots = [
      { id: null, when: "hp", pct: 40 },
      { id: null, when: "mp", pct: 20 },
      { id: null, when: "hp", pct: 50 }
    ];
    var c = save.autoFarmCfg;
    if (!c || typeof c !== "object") {
      c = {};
      save.autoFarmCfg = c;
    }
    if (c.sitHpOn == null) c.sitHpOn = true;
    c.sitHpOn = !!c.sitHpOn;
    if (c.sitMpOn == null) c.sitMpOn = true;
    c.sitMpOn = !!c.sitMpOn;
    c.sitHp = clampFarmPct(c.sitHp, 30);
    c.sitMp = clampFarmPct(c.sitMp, 20);
    if (!Array.isArray(c.skills)) c.skills = [null, null, null, null];
    while (c.skills.length < 4) c.skills.push(null);
    if (c.skills.length > 4) c.skills = c.skills.slice(0, 4);
    if (!Array.isArray(c.pots)) c.pots = [];
    var i;
    for (i = 0; i < 3; i++) {
      var src = c.pots[i] && typeof c.pots[i] === "object" ? c.pots[i] : {};
      var fb = defPots[i];
      var id = src.id == null || src.id === "" ? null : src.id;
      if (id && !(DATA.POTIONS && DATA.POTIONS[id])) id = null;
      c.pots[i] = {
        id: id,
        when: src.when === "mp" ? "mp" : src.when === "hp" ? "hp" : fb.when,
        pct: clampFarmPct(src.pct, fb.pct),
      };
    }
    c.pots.length = 3;
    PVE.sanitizeFarmMobs(save, c);
    return c;
  };

  /* Prontera field bands in js/map.js (near/mid/far/deep). */
  PVE.FIELD_MONSTER_IDS = [
    "poring", "fabre", "lunatic", "willow", "condor",
    "wolf", "poporing", "chonchon", "roda_frog",
    "spore", "rocker", "steel_chonchon",
    "savage_babe", "elder_willow", "skeleton"
  ];

  /**
   * Unique field monster ids. Prefer live MAP.listFieldSpawns(); else the static band list.
   */
  PVE.fieldMonsterIds = function () {
    var fallback = PVE.FIELD_MONSTER_IDS.slice();
    var mapApi = root.MAP;
    var raw = [];
    try {
      if (mapApi && typeof mapApi.listFieldSpawns === "function") {
        raw = mapApi.listFieldSpawns() || [];
      }
    } catch (e) {
      raw = [];
    }
    var seen = {};
    var fromMap = [];
    raw.forEach(function (sp) {
      var id = sp && sp.monsterId != null ? String(sp.monsterId) : "";
      if (!id || seen[id]) return;
      seen[id] = true;
      fromMap.push(id);
    });
    if (!fromMap.length) return fallback;
    var out = [];
    fallback.forEach(function (id) {
      if (seen[id]) {
        out.push(id);
        seen[id] = false;
      }
    });
    fromMap.forEach(function (id) {
      if (seen[id]) out.push(id);
    });
    return out;
  };

  PVE.farmKnownMobIds = function () {
    var known = {};
    PVE.fieldMonsterIds().forEach(function (id) { known[id] = true; });
    (DATA.MONSTERS || []).forEach(function (m) {
      if (m && m.id) known[String(m.id)] = true;
    });
    (DATA.BOSSES || []).forEach(function (b) {
      if (b && b.id) known[String(b.id)] = true;
    });
    return known;
  };

  /**
   * Monster defs Auto Farm can pick on the current map.
   * bosses → DATA.BOSSES; city/field → Prontera field catalog (set in town, walk out).
   */
  PVE.farmMobCatalog = function (save) {
    if (save && save.mapId === "bosses") {
      return (DATA.BOSSES || []).slice();
    }
    var ids = PVE.fieldMonsterIds();
    var out = [];
    ids.forEach(function (id) {
      var def = DATA.findMonster ? DATA.findMonster(id) : null;
      if (def && def.id === id) out.push(def);
      else if (DATA.MONSTERS) {
        var hit = DATA.MONSTERS.find(function (m) { return m && m.id === id; });
        if (hit) out.push(hit);
      }
    });
    return out;
  };

  /**
   * mobIds [] + mobNone false = attack ALL types on that map.
   * mobNone true = attack none (cleared checks). Adding any id sets mobNone false.
   * Unknown ids stripped against field+boss catalogs. Unique strings only.
   */
  PVE.sanitizeFarmMobs = function (save, c) {
    c = c || (save && save.autoFarmCfg);
    if (!c || typeof c !== "object") return c;
    if (!Array.isArray(c.mobIds)) c.mobIds = [];
    c.mobNone = !!c.mobNone;
    var known = PVE.farmKnownMobIds();
    var seen = {};
    var cleaned = [];
    var i;
    for (i = 0; i < c.mobIds.length; i++) {
      var mid = c.mobIds[i] == null ? "" : String(c.mobIds[i]);
      if (mid === "__none__") {
        c.mobNone = true;
        continue;
      }
      if (!mid || seen[mid] || !known[mid]) continue;
      seen[mid] = true;
      cleaned.push(mid);
    }
    c.mobIds = cleaned;
    if (c.mobIds.length) c.mobNone = false;
    var cat = PVE.farmMobCatalog(save);
    if (!c.mobNone && cat.length && c.mobIds.length === cat.length) {
      var allOn = true;
      for (i = 0; i < cat.length; i++) {
        if (!cat[i] || !seen[cat[i].id]) { allOn = false; break; }
      }
      if (allOn) c.mobIds = [];
    }
    return c;
  };

  PVE.farmAllowsMob = function (save, monsterId) {
    if (!save) return true;
    var cfg = PVE.ensureAutoFarmCfg(save);
    if (cfg.mobNone) return false;
    if (!cfg.mobIds || !cfg.mobIds.length) return true;
    var id = monsterId == null ? "" : String(monsterId);
    return cfg.mobIds.indexOf(id) >= 0;
  };

  PVE.toggleFarmMob = function (save, monsterId) {
    var cfg = PVE.ensureAutoFarmCfg(save);
    var id = monsterId == null ? "" : String(monsterId);
    if (!id || id === "__none__") return cfg;
    var catalog = PVE.farmMobCatalog(save);
    var inCat = false;
    var i;
    for (i = 0; i < catalog.length; i++) {
      if (catalog[i] && catalog[i].id === id) { inCat = true; break; }
    }
    if (!inCat) return cfg;
    var selected = {};
    if (cfg.mobNone || !cfg.mobIds.length) {
      selected[id] = true;
    } else {
      for (i = 0; i < cfg.mobIds.length; i++) selected[cfg.mobIds[i]] = true;
      if (selected[id]) delete selected[id];
      else selected[id] = true;
    }
    var ids = [];
    for (i = 0; i < catalog.length; i++) {
      var cid = catalog[i] && catalog[i].id;
      if (cid && selected[cid]) ids.push(cid);
    }
    cfg.mobNone = ids.length === 0;
    cfg.mobIds = (!cfg.mobNone && ids.length === catalog.length) ? [] : ids;
    return cfg;
  };

  PVE.setFarmMobsAll = function (save) {
    var cfg = PVE.ensureAutoFarmCfg(save);
    cfg.mobIds = [];
    cfg.mobNone = false;
    return cfg;
  };

  PVE.setFarmMobsNone = function (save) {
    var cfg = PVE.ensureAutoFarmCfg(save);
    cfg.mobIds = [];
    cfg.mobNone = true;
    return cfg;
  };

  PVE.learnedSkillIds = function (save) {
    var hero = save && save.heroId;
    var ranks = (save && save.skillRanks) || {};
    var tree = (DATA.SKILL_TREES && DATA.SKILL_TREES[hero]) || [];
    var ids = [];
    tree.forEach(function (n) {
      if (n && (ranks[n.id] || 0) > 0) ids.push(n.id);
    });
    if (!ids.length) {
      var roots = (DATA.SKILL_ROOTS && DATA.SKILL_ROOTS[hero]) || [];
      if (roots[0]) ids.push(roots[0]);
    }
    return ids;
  };

  PVE.setFarmSkill = function (save, slotIndex, skillId) {
    PVE.ensureProgress(save);
    var cfg = PVE.ensureAutoFarmCfg(save);
    var i = Math.floor(Number(slotIndex));
    if (i < 0 || i > 3) return { ok: false, reason: "ช่องไม่ถูกต้อง" };
    if (skillId == null || skillId === "") {
      cfg.skills[i] = null;
      return { ok: true };
    }
    var learned = PVE.learnedSkillIds(save);
    if (learned.indexOf(skillId) < 0) return { ok: false, reason: "ยังไม่เรียนสกิลนี้" };
    cfg.skills[i] = skillId;
    return { ok: true };
  };

  PVE.setFarmPot = function (save, slotIndex, spec) {
    PVE.ensureProgress(save);
    var cfg = PVE.ensureAutoFarmCfg(save);
    var i = Math.floor(Number(slotIndex));
    if (i < 0 || i > 2) return { ok: false, reason: "ช่องไม่ถูกต้อง" };
    spec = spec || {};
    var cur = cfg.pots[i] || { id: null, when: "hp", pct: 40 };
    var id = Object.prototype.hasOwnProperty.call(spec, "id") ? spec.id : cur.id;
    if (id === "" || id == null) id = null;
    else if (!(DATA.POTIONS && DATA.POTIONS[id])) id = null;
    var when = spec.when != null ? spec.when : cur.when;
    when = when === "mp" ? "mp" : "hp";
    var pct = spec.pct != null ? spec.pct : cur.pct;
    cfg.pots[i] = { id: id, when: when, pct: clampFarmPct(pct, cur.pct) };
    return { ok: true };
  };

  PVE.setFarmSit = function (save, spec) {
    PVE.ensureProgress(save);
    var cfg = PVE.ensureAutoFarmCfg(save);
    spec = spec || {};
    if (spec.sitHpOn != null) cfg.sitHpOn = !!spec.sitHpOn;
    if (spec.sitMpOn != null) cfg.sitMpOn = !!spec.sitMpOn;
    if (spec.sitHp != null) cfg.sitHp = clampFarmPct(spec.sitHp, cfg.sitHp);
    if (spec.sitMp != null) cfg.sitMp = clampFarmPct(spec.sitMp, cfg.sitMp);
    return { ok: true };
  };

  PVE.shouldSit = function (save, unit) {
    if (!save || !save.autoFarm) return false;
    var cfg = PVE.ensureAutoFarmCfg(save);
    var hp, maxHp, mp, maxMp;
    if (unit) {
      hp = unit.hp;
      maxHp = unit.maxHp;
      mp = unit.mp;
      maxMp = unit.maxMp;
    } else {
      var d = PVE.derived(save);
      hp = save.hp;
      maxHp = d.maxHp;
      mp = save.mp;
      maxMp = d.maxMp;
    }
    if (cfg.sitHpOn && maxHp > 0 && hp != null && (hp / maxHp) * 100 < cfg.sitHp) return true;
    if (cfg.sitMpOn && maxMp > 0 && mp != null && (mp / maxMp) * 100 < cfg.sitMp) return true;
    return false;
  };

  PVE.resetOnHeroRepick = function () {
    return null;
  };

  PVE.derived = function (save) {
    PVE.ensureProgress(save);
    const d = STATS.computeHeroStats(save.heroId, save.allocated, save.equip, save.level, save.refine, {
      skillRanks: save.skillRanks,
      ammo: save.ammo,
      arrowAtk: save.arrowAtk,
      arrowCount: save.arrowCount,
    });
    d.potionAspdMod = DATA.activePotionAspdMod(save.potionBuffs);
    d.weight = PVE.weightState(save);
    d.ammo = save.ammo || null;
    d.arrowAtk = save.arrowAtk;
    d.arrowCount = save.arrowCount;
    return d;
  };

  PVE.carryWeight = function (save) {
    PVE.ensureProgress(save);
    let w = 0;
    Object.keys(save.owned || {}).forEach(function (id) {
      if (save.owned[id]) w += DATA.itemWeight(id);
    });
    Object.keys(save.potions || {}).forEach(function (id) {
      w += (save.potions[id] || 0) * DATA.itemWeight(id);
    });
    Object.keys(save.materials || {}).forEach(function (id) {
      w += (save.materials[id] || 0) * DATA.itemWeight(id);
    });
    if (save.ammo && save.ammo.id && save.ammo.count) {
      w += (save.ammo.count || 0) * DATA.itemWeight(save.ammo.id);
    }
    return w;
  };
  PVE.maxWeight = function (save) {
    PVE.ensureProgress(save);
    const d = STATS.computeHeroStats(save.heroId, save.allocated, save.equip, save.level, save.refine);
    return d.maxWeight;
  };
  PVE.weightState = function (save) {
    const cur = PVE.carryWeight(save);
    const max = PVE.maxWeight(save);
    const ratio = max > 0 ? cur / max : 0;
    return {
      cur: cur,
      max: max,
      ratio: ratio,
      pct: ratio,
      heavy: ratio >= 0.7,
      noRegen: ratio >= 0.7,
      over: ratio >= 0.9,
      full: ratio >= 1,
    };
  };
  PVE.canCarry = function (save, extra) {
    extra = Number(extra) || 0;
    return PVE.carryWeight(save) + extra <= PVE.maxWeight(save);
  };

  PVE.syncVitals = function (save) {
    const d = PVE.derived(save);
    if (save.hp == null) save.hp = d.maxHp;
    if (save.mp == null) save.mp = d.maxMp;
    save.hp = Math.min(save.hp, d.maxHp);
    save.mp = Math.min(save.mp, d.maxMp);
    return d;
  };

  PVE.buildHeroUnit = function (save) {
    const d = PVE.syncVitals(save);
    const ranks = save.skillRanks || DATA.defaultSkillRanks(save.heroId);
    d.skillRanks = Object.assign({}, ranks);
    d.skills = DATA.learnedSkills(save.heroId, ranks);
    const unit = COMBAT.createUnit(d, "left");
    unit.ammo = save.ammo || unit.ammo;
    if (save.arrowAtk != null) unit.arrowAtk = save.arrowAtk;
    if (save.arrowCount != null) unit.arrowCount = save.arrowCount;
    unit.noRegen = !!(d.weight && d.weight.noRegen);
    if (d.potionAspdMod > 0) unit.potionAspdMod = d.potionAspdMod;
    if (PVE.potionBuffRemainMs(save, "berserk") > 0) unit.berserk = true;
    unit.hp = save.hp;
    unit.mp = save.mp;
    COMBAT.resetTemps(unit);
    unit.hp = save.hp;
    unit.mp = Math.min(save.mp, unit.maxMp);
    COMBAT.clampHpMp(unit);
    return unit;
  };

  PVE.findBoss = function (bossIdOrIndex) {
    if (typeof bossIdOrIndex === "number") return DATA.BOSSES[bossIdOrIndex] || DATA.BOSSES[0];
    if (bossIdOrIndex) {
      const found = DATA.BOSSES.find(function (b) { return b.id === bossIdOrIndex; });
      if (found) return found;
    }
    return DATA.BOSSES[0];
  };

  PVE.findMonster = function (monsterId) {
    return DATA.findMonster(monsterId);
  };

  PVE.buildBossUnit = function (bossIdOrIndex) {
    const def = PVE.findBoss(bossIdOrIndex);
    const d = STATS.computeBossStats(def);
    const unit = COMBAT.createUnit(d, "right");
    COMBAT.resetTemps(unit);
    unit.hp = unit.maxHp;
    unit.mp = unit.maxMp;
    return unit;
  };

  PVE.buildMonsterUnit = function (monsterId) {
    const def = PVE.findMonster(monsterId);
    const d = STATS.computeMonsterStats(def);
    const unit = COMBAT.createUnit(d, "right");
    COMBAT.resetTemps(unit);
    unit.hp = unit.maxHp;
    unit.mp = unit.maxMp;
    unit.sprite = d.sprite || unit.sprite;
    return unit;
  };

  PVE.startFight = function (save, bossId) {
    PVE.ensureProgress(save);
    const def = PVE.findBoss(bossId || save.currentBossId);
    save.currentBossId = def.id;
    save.currentMonsterId = null;
    save.fightKind = "boss";
    const hero = PVE.buildHeroUnit(save);
    const boss = PVE.buildBossUnit(def.id);
    const state = COMBAT.createState(hero, boss, { mode: "pve", save: save });
    COMBAT.pushLog(
      state,
      '<span class="log-system">' +
        (def.place || ("ด่านที่ " + (def.index + 1))) +
        " — " +
        boss.emoji +
        " " +
        boss.name +
        " Lv." +
        boss.level +
        "</span>"
    );
    return state;
  };

  PVE.startFieldFight = function (save, monsterId) {
    PVE.ensureProgress(save);
    const def = PVE.findMonster(monsterId);
    save.currentMonsterId = def.id;
    save.currentBossId = null;
    save.fightKind = "field";
    const hero = PVE.buildHeroUnit(save);
    const mob = PVE.buildMonsterUnit(def.id);
    const state = COMBAT.createState(hero, mob, { mode: "pve-field", save: save });
    COMBAT.pushLog(
      state,
      '<span class="log-system">' +
        (def.place || "ทุ่งพรอนเทรา") +
        " — " +
        mob.emoji +
        " " +
        mob.name +
        " Lv." +
        mob.level +
        "</span>"
    );
    return state;
  };

  PVE.uniqueClears = function (save) {
    const c = (save && save.clearedBosses) || {};
    return Object.keys(c).filter(function (id) { return !!c[id]; }).length;
  };

  PVE.allBossesCleared = function (save) {
    return PVE.uniqueClears(save) >= DATA.BOSSES.length;
  };

  PVE.snapshotVitals = function (save, unit) {
    save.hp = unit.hp;
    save.mp = unit.mp;
    PVE.syncAmmoFromUnit(save, unit);
  };

  PVE.syncAmmoFromUnit = function (save, unit) {
    if (!save || !unit) return;
    if (unit.ammo && typeof unit.ammo === "object") save.ammo = unit.ammo;
    if (unit.arrowCount != null) save.arrowCount = unit.arrowCount;
    else if (save.ammo && save.ammo.count != null) save.arrowCount = save.ammo.count;
    if (save.ammo && save.ammo.id) save.arrow = save.ammo.id;
  };

  PVE.consumeAmmo = function (save, unit) {
    const src = unit || save;
    if (!src) return { ok: false, reason: "no-arrow" };
    let n = STATS.arrowCountFrom(src);
    if (n <= 0) return { ok: false, reason: "no-arrow" };
    n -= 1;
    if (unit) {
      if (unit.ammo && typeof unit.ammo === "object") unit.ammo.count = n;
      unit.arrowCount = n;
    }
    if (save) {
      if (!save.ammo || typeof save.ammo !== "object") {
        save.ammo = { id: (unit && unit.ammo && unit.ammo.id) || save.arrow || "arrow", count: n };
      } else {
        save.ammo.count = n;
      }
      save.arrowCount = n;
      if (save.ammo.id) save.arrow = save.ammo.id;
    }
    return { ok: true, count: n };
  };

  PVE.baseExpToNext = function (lv) {
    return DATA.baseExpToNext(lv);
  };

  PVE.jobExpToNext = function (lv) {
    return DATA.jobExpToNext(lv);
  };

  PVE.gainExp = function (save, baseAmt, jobAmt) {
    PVE.ensureProgress(save);
    const result = { baseUps: [], jobUps: [], baseGained: 0, jobGained: 0 };
    baseAmt = Math.max(0, Math.floor(baseAmt || 0));
    jobAmt = Math.max(0, Math.floor(jobAmt || 0));
    result.baseGained = baseAmt;
    result.jobGained = jobAmt;
    save.baseExp += baseAmt;
    save.jobExp += jobAmt;
    while (save.baseLevel < DATA.BASE_LEVEL_CAP) {
      const need = PVE.baseExpToNext(save.baseLevel);
      if (save.baseExp < need) break;
      save.baseExp -= need;
      const from = save.baseLevel;
      save.baseLevel += 1;
      save.level = save.baseLevel;
      save.unspentStatPoints = (save.unspentStatPoints || 0) + DATA.STAT_POINTS_PER_BASE_LEVEL;
      result.baseUps.push({ from: from, to: save.baseLevel });
    }
    if (save.baseLevel >= DATA.BASE_LEVEL_CAP) {
      save.baseLevel = DATA.BASE_LEVEL_CAP;
      save.level = save.baseLevel;
      save.baseExp = 0;
    }
    while (save.jobLevel < DATA.JOB_LEVEL_CAP) {
      const need = PVE.jobExpToNext(save.jobLevel);
      if (save.jobExp < need) break;
      save.jobExp -= need;
      const from = save.jobLevel;
      save.jobLevel += 1;
      save.skillPoints = (save.skillPoints || 0) + 1;
      result.jobUps.push({ from: from, to: save.jobLevel });
    }
    if (save.jobLevel >= DATA.JOB_LEVEL_CAP) {
      save.jobLevel = DATA.JOB_LEVEL_CAP;
      save.jobExp = 0;
    }
    save.level = save.baseLevel;
    return result;
  };

  PVE.applyWinRewards = function (save, bossId) {
    PVE.ensureProgress(save);
    const def = PVE.findBoss(bossId || save.currentBossId);
    const defeatedIndex = def.index;
    save.clearedBosses = save.clearedBosses || {};
    const first = !save.clearedBosses[def.id];
    save.zeno += DATA.BOSS_REWARD_ZENO;
    save.bossIndex = Math.max(save.bossIndex || 0, defeatedIndex);
    if (!first) {
      return {
        first: false,
        last: false,
        adventureWin: false,
        bonusPoints: 0,
        defeatedIndex: defeatedIndex,
        bossId: def.id,
        zeno: DATA.BOSS_REWARD_ZENO,
      };
    }
    save.clearedBosses[def.id] = true;
    PVE.gainExp(save, PVE.baseExpToNext(save.baseLevel), 0);
    save.skillPoints = (save.skillPoints || 0) + DATA.SKILL_POINTS_PER_BOSS;
    const bonusPoints = DATA.bonusStatPointsFor(defeatedIndex);
    const adventureWin = PVE.allBossesCleared(save);
    return {
      first: true,
      last: adventureWin,
      adventureWin: adventureWin,
      bonusPoints: bonusPoints,
      defeatedIndex: defeatedIndex,
      bossId: def.id,
      zeno: DATA.BOSS_REWARD_ZENO,
    };
  };

  PVE.rollInt = function (min, max, rng) {
    min = Math.floor(min);
    max = Math.floor(max);
    if (max < min) max = min;
    if (rng && typeof rng.next === "function") {
      return min + Math.floor(rng.next() * (max - min + 1));
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  PVE.rollChance = function (percent, rng) {
    if (rng && typeof rng.chance === "function") return rng.chance(percent);
    return Math.random() * 100 < percent;
  };

  PVE.applyFieldRewards = function (save, monsterId, rng) {
    PVE.ensureProgress(save);
    const def = PVE.findMonster(monsterId || save.currentMonsterId);
    const zeno = PVE.rollInt(def.zenoMin || 10, def.zenoMax || 20, rng);
    save.zeno += zeno;
    const exp = PVE.gainExp(save, def.baseExp || 0, def.jobExp || 0);
    const loot = [];
    if (!save.owned || typeof save.owned !== "object") save.owned = {};
    if (!save.materials || typeof save.materials !== "object" || Array.isArray(save.materials)) {
      save.materials = {};
    }
    (def.drops || []).forEach(function (drop) {
      if (!PVE.rollChance(drop.chance || 0, rng)) return;
      const id = drop.id;
      const kind = drop.kind || "potion";
      const extra = (kind === "item" && save.owned[id]) ? 0 : DATA.itemWeight(id);
      if (extra > 0 && !PVE.canCarry(save, extra)) return;
      if (kind === "material") {
        save.materials[id] = (save.materials[id] || 0) + 1;
      } else if (kind === "item") {
        save.owned[id] = true;
      } else {
        save.potions[id] = (save.potions[id] || 0) + 1;
      }
      loot.push(id);
    });
    const d = PVE.derived(save);
    const restore = DATA.FIELD_WIN_RESTORE || 0.08;
    save.hp = Math.min(d.maxHp, (save.hp || 0) + d.maxHp * restore);
    save.mp = Math.min(d.maxMp, (save.mp || 0) + d.maxMp * restore);
    return {
      monsterId: def.id,
      name: def.name,
      emoji: def.emoji,
      zeno: zeno,
      baseExp: exp.baseGained,
      jobExp: exp.jobGained,
      baseUps: exp.baseUps,
      jobUps: exp.jobUps,
      loot: loot,
    };
  };

  PVE.respawnInCity = function (save) {
    PVE.ensureProgress(save);
    const d = PVE.derived(save);
    save.mapId = "city";
    const spawn = (root.MAP && MAP.ZONES && MAP.ZONES.city && MAP.ZONES.city.spawn) || { x: 40, y: 52 };
    save.cityPos = { x: spawn.x, y: spawn.y };
    save.autoFarm = false;
    save.fightKind = null;
    save.currentMonsterId = null;
    save.hp = Math.max(1, Math.floor(d.maxHp * (DATA.DEFEAT_HP_RATIO || 0.5)));
    save.mp = Math.min(save.mp == null ? d.maxMp : save.mp, d.maxMp);
    return d;
  };

  PVE.restoreAfterAlloc = function (save) {
    const d = PVE.derived(save);
    if (save.hp == null) save.hp = d.maxHp;
    if (save.mp == null) save.mp = d.maxMp;
    save.hp = Math.min(d.maxHp, save.hp + d.maxHp * DATA.POST_WIN_RESTORE);
    save.mp = Math.min(d.maxMp, save.mp + d.maxMp * DATA.POST_WIN_RESTORE);
  };

  PVE.potionHeal = function (potionId) {
    const p = DATA.POTIONS[potionId];
    if (!p) return { hp: 0, mp: 0 };
    return { hp: p.healHp || 0, mp: p.healMp || 0 };
  };

  PVE.buyPotion = function (save, potionId) {
    const item = DATA.POTIONS[potionId];
    if (!item) return { ok: false, reason: "ไม่มียานี้" };
    if (save.zeno < item.price) return { ok: false, reason: "Zeno ไม่พอ" };
    if (!PVE.canCarry(save, DATA.itemWeight(potionId))) return { ok: false, reason: "น้ำหนักเต็ม แบกไม่ไหว" };
    save.zeno -= item.price;
    save.potions = save.potions || DATA.emptyPotions();
    save.potions[potionId] = (save.potions[potionId] || 0) + 1;
    return { ok: true };
  };

  PVE.buyAmmo = function (save, id, qty) {
    PVE.ensureProgress(save);
    qty = Math.floor(Number(qty) || 0);
    if (qty !== 1 && qty !== 100) return { ok: false, reason: "จำนวนไม่ถูกต้อง" };
    const item = DATA.ITEMS && DATA.ITEMS[id];
    if (!item || item.type !== "ammo") return { ok: false, reason: "ไม่มีลูกธนูนี้" };
    if (!PVE.isBowHero(save.heroId)) return { ok: false, reason: "อาชีพนี้ซื้อไม่ได้" };
    const lv = save.baseLevel || save.level || 1;
    if (item.reqLevel && lv < item.reqLevel) return { ok: false, reason: "เลเวลไม่ถึง" };
    const cost = (item.price || 0) * qty;
    if (save.zeno < cost) return { ok: false, reason: "Zeno ไม่พอ" };
    const extra = DATA.itemWeight(id) * qty;
    if (!PVE.canCarry(save, extra)) return { ok: false, reason: "น้ำหนักเต็ม แบกไม่ไหว" };
    save.zeno -= cost;
    if (!save.ammo || typeof save.ammo !== "object") save.ammo = { id: id, count: 0 };
    if (save.ammo.id && save.ammo.id !== id) {
      save.ammo = { id: id, count: qty };
    } else {
      save.ammo.id = id;
      save.ammo.count = (save.ammo.count || 0) + qty;
    }
    save.arrow = save.ammo.id;
    save.arrowCount = save.ammo.count;
    return { ok: true };
  };

  PVE.potionCount = function (save, potionId) {
    return ((save && save.potions) || {})[potionId] || 0;
  };

  PVE.hasHpPotion = function (save) {
    return PVE.potionCount(save, "red") + PVE.potionCount(save, "orange") + PVE.potionCount(save, "white") > 0;
  };

  PVE.usePotion = function (save, potionId, unit) {
    const item = DATA.POTIONS[potionId];
    if (!item) return { ok: false, reason: "ไม่มียานี้" };
    save.potions = save.potions || DATA.emptyPotions();
    if ((save.potions[potionId] || 0) < 1) return { ok: false, reason: "ยาหมด" };
    const d = PVE.syncVitals(save);
    save.potions[potionId] -= 1;
    const hp0 = unit ? unit.hp : save.hp;
    const mp0 = unit ? unit.mp : save.mp;
    if (unit) {
      if (item.healHp) COMBAT.healUnit(unit, item.healHp);
      if (item.healMp) COMBAT.restoreMp(unit, item.healMp);
      save.hp = unit.hp;
      save.mp = unit.mp;
    } else {
      save.hp = Math.min(d.maxHp, (save.hp || 0) + (item.healHp || 0));
      save.mp = Math.min(d.maxMp, (save.mp || 0) + (item.healMp || 0));
    }
    var dur = null;
    var buff = null;
    if (item.aspdMod) {
      save.potionBuffs = save.potionBuffs || {};
      dur = item.durationMs != null ? item.durationMs : DATA.BERSERK_DURATION_MS;
      save.potionBuffs[item.id] = { until: Date.now() + dur, aspdMod: item.aspdMod };
      if (unit) {
        unit.potionAspdMod = Math.max(Number(unit.potionAspdMod) || 0, item.aspdMod);
        if (item.id === "berserk") unit.berserk = true;
      }
      buff = { id: item.id, aspdMod: item.aspdMod, until: save.potionBuffs[item.id].until, durationMs: dur };
    }
    return {
      ok: true,
      id: potionId,
      healedHp: (unit ? unit.hp : save.hp) - hp0,
      healedMp: (unit ? unit.mp : save.mp) - mp0,
      buff: buff,
    };
  };

  PVE.potionBuffRemainMs = function (save, id, now) {
    now = now != null ? now : Date.now();
    var b = save && save.potionBuffs && save.potionBuffs[id];
    if (!b || !b.until) return 0;
    return Math.max(0, b.until - now);
  };

  PVE.fmtRemain = function (ms) {
    ms = Math.max(0, Math.floor(Number(ms) || 0));
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  };

  PVE.maybeAutoPotion = function (save, unit) {
    PVE.ensureProgress(save);
    var cfg = PVE.ensureAutoFarmCfg(save);
    var der = PVE.derived(save);
    var hp = unit ? unit.hp : save.hp;
    var mp = unit ? unit.mp : save.mp;
    var maxHp = unit ? unit.maxHp : der.maxHp;
    var maxMp = unit ? unit.maxMp : der.maxMp;
    var pots = cfg.pots || [];
    var any = false;
    var i;
    for (i = 0; i < pots.length; i++) {
      if (pots[i] && pots[i].id) { any = true; break; }
    }
    if (any) {
      for (i = 0; i < pots.length; i++) {
        var p = pots[i];
        if (!p || !p.id) continue;
        if (PVE.potionCount(save, p.id) < 1) continue;
        var need = (p.pct == null ? 40 : p.pct) / 100;
        if (p.when === "hp" && maxHp && hp / maxHp < need) {
          return PVE.usePotion(save, p.id, unit);
        }
        if (p.when === "mp" && maxMp && mp / maxMp < need) {
          return PVE.usePotion(save, p.id, unit);
        }
      }
      return null;
    }
    if (!maxHp || hp / maxHp >= (DATA.AUTO_POTION_HP || 0.4)) return null;
    var order = ["orange", "red", "white"];
    for (i = 0; i < order.length; i++) {
      if (PVE.potionCount(save, order[i]) > 0) {
        return PVE.usePotion(save, order[i], unit);
      }
    }
    return null;
  };

  PVE.kafraHeal = function (save) {
    const d = PVE.syncVitals(save);
    const cost = DATA.KAFRA_HEAL_COST || 50;
    if (save.hp >= d.maxHp && save.mp >= d.maxMp) return { ok: false, reason: "เลือดและมานาเต็มแล้ว" };
    if (save.zeno < cost) return { ok: false, reason: "Zeno ไม่พอ (ต้อง " + cost + ")" };
    save.zeno -= cost;
    save.hp = d.maxHp;
    save.mp = d.maxMp;
    return { ok: true, cost: cost };
  };

  PVE.buy = function (save, itemId) {
    const item = DATA.ITEMS[itemId];
    if (!item) return { ok: false, reason: "ไม่มีไอเทมนี้" };
    if (save.owned[itemId]) return { ok: false, reason: "เป็นเจ้าของแล้ว" };
    if (save.zeno < item.price) return { ok: false, reason: "Zeno ไม่พอ" };
    if (!PVE.canCarry(save, DATA.itemWeight(itemId))) return { ok: false, reason: "น้ำหนักเต็ม แบกไม่ไหว" };
    save.zeno -= item.price;
    save.owned[itemId] = true;
    return { ok: true };
  };

  PVE.twoHandConflict = function (save, slotId, item) {
    if (!save || !item) return null;
    const equip = save.equip || {};
    const wornWep = equip.weapon && DATA.ITEMS[equip.weapon];
    const isBow = item.weaponClass === "bow" || item.twoHand;
    const wornIsBow = !!(wornWep && (wornWep.weaponClass === "bow" || wornWep.twoHand));
    const isShield = item.type === "shield" || item.slot === "shield" || slotId === "shield";
    if (isBow && (equip.shield || slotId === "weapon" && equip.shield)) {
      return { ok: false, reason: "ธนูสองมือ ใส่โล่ไม่ได้" };
    }
    if (isShield && wornIsBow) {
      return { ok: false, reason: "ธนูสองมือ ใส่โล่ไม่ได้" };
    }
    return null;
  };

  PVE.canEquipItem = function (save, itemId) {
    const item = DATA.ITEMS[itemId];
    if (!item) return false;
    return DATA.canJobWear(save.heroId, item);
  };

  PVE.equipItem = function (save, slotId, itemId) {
    const slot = DATA.SLOTS.find(function (s) {
      return s.id === slotId;
    });
    if (!slot) return { ok: false };
    if (!itemId) {
      save.equip[slotId] = null;
      return { ok: true };
    }
    const item = DATA.ITEMS[itemId];
    if (!item || item.type !== slot.type) return { ok: false, reason: "ชนิดไม่ตรงช่อง" };
    if (!save.owned[itemId]) return { ok: false, reason: "ยังไม่ได้ซื้อ" };
    if (!PVE.canEquipItem(save, itemId)) return { ok: false, reason: "อาชีพนี้ใส่ไม่ได้" };
    const twoHandBlock = PVE.twoHandConflict(save, slotId, item);
    if (twoHandBlock) return twoHandBlock;
    save.equip[slotId] = itemId;
    PVE.syncVitals(save);
    return { ok: true };
  };

  PVE.isEquipped = function (save, itemId) {
    return DATA.SLOTS.some(function (s) {
      return save.equip[s.id] === itemId;
    });
  };

  /**
   * Inventory card click:
   *  - not worn → equip matching slot (acc: empty L/R, else replace L)
   *  - acc worn in one slot with the other empty → fill the empty slot
   *  - already fully worn → unequip one instance
   */
  PVE.toggleInventoryItem = function (save, itemId) {
    const item = DATA.ITEMS[itemId];
    if (!item || !save.owned[itemId]) return { ok: false, reason: "ยังไม่ได้ซื้อ" };
    const worn = DATA.SLOTS.filter(function (s) {
      return save.equip[s.id] === itemId;
    });
    if (item.type === "acc") {
      const empty = ["accL", "accR"].filter(function (id) {
        return !save.equip[id];
      });
      if (worn.length === 0) {
        return PVE.equipItem(save, empty[0] || "accL", itemId);
      }
      if (worn.length === 1 && empty.length) {
        return PVE.equipItem(save, empty[0], itemId);
      }
      return PVE.equipItem(save, worn[worn.length - 1].id, null);
    }
    if (worn.length) {
      return PVE.equipItem(save, worn[0].id, null);
    }
    const slot = DATA.SLOTS.find(function (s) {
      return s.type === item.type;
    });
    if (!slot) return { ok: false };
    return PVE.equipItem(save, slot.id, itemId);
  };

  PVE.unequipSlot = function (save, slotId) {
    return PVE.equipItem(save, slotId, null);
  };

  PVE.isOwned = function (save, itemId) {
    return !!save.owned[itemId];
  };

  PVE.refineOf = function (save, itemId) {
    return STATS.refineOf(save && save.refine, itemId);
  };

  PVE.isRefinableOwned = function (save, itemId) {
    const item = DATA.ITEMS[itemId];
    if (!item || !save || !save.owned[itemId]) return false;
    return DATA.isRefinableType(item.type);
  };

  PVE.listRefinableOwned = function (save) {
    return Object.keys(DATA.ITEMS).filter(function (id) {
      return PVE.isRefinableOwned(save, id);
    });
  };

  /**
   * Attempt +1 refine. Safe fail: keep current plus, spend Zeno + matching ore, no break.
   */
  PVE.attemptRefine = function (save, itemId, rng) {
    PVE.ensureProgress(save);
    const item = DATA.ITEMS[itemId];
    if (!item || !save.owned[itemId]) return { ok: false, reason: "ยังไม่ได้ซื้อ" };
    if (!DATA.isRefinableType(item.type)) return { ok: false, reason: "ตีบวกไม่ได้" };
    const cur = PVE.refineOf(save, itemId);
    if (cur >= DATA.REFINE_MAX) return { ok: false, reason: "ถึง +10 แล้ว" };
    const next = cur + 1;
    const cost = DATA.refineCostTo(next);
    const chance = DATA.refineChanceTo(next);
    if (save.zeno < cost) return { ok: false, reason: "Zeno ไม่พอ (ต้อง " + cost + ")" };
    const oreId = DATA.refineOreFor(item, next);
    const haveOre = oreId ? (save.materials[oreId] || 0) : 0;
    if (!oreId || haveOre < 1) return { ok: false, reason: "แร่ไม่พอ" };
    save.zeno -= cost;
    save.materials[oreId] = haveOre - 1;
    let success;
    if (rng && typeof rng.chance === "function") success = rng.chance(chance);
    else if (rng && typeof rng.next === "function") success = rng.next() * 100 < chance;
    else success = Math.random() * 100 < chance;
    if (success) {
      save.refine[itemId] = next;
      PVE.syncVitals(save);
      return { ok: true, success: true, plus: next, cost: cost, chance: chance, itemId: itemId };
    }
    return { ok: true, success: false, plus: cur, cost: cost, chance: chance, itemId: itemId };
  };

  root.PVE = PVE;
})(typeof globalThis !== "undefined" ? globalThis : window);
