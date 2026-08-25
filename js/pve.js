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

  PVE.createSave = function (heroId, allocated, charName) {
    return {
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
      currentBossId: null,
      currentMonsterId: null,
      fightKind: null,
      charName: typeof charName === "string" ? charName : "",
    };
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
    if (!save.charName) {
      const hero = DATA.HEROES[save.heroId];
      save.charName = (hero && hero.name) || "";
    }
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
    save.level = save.baseLevel;
    return save;
  };

  PVE.resetOnHeroRepick = function () {
    return null;
  };

  PVE.derived = function (save) {
    PVE.ensureProgress(save);
    const d = STATS.computeHeroStats(save.heroId, save.allocated, save.equip, save.level, save.refine);
    d.potionAspdMod = DATA.activePotionAspdMod(save.potionBuffs);
    return d;
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
    const state = COMBAT.createState(hero, boss, { mode: "pve" });
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
    const state = COMBAT.createState(hero, mob, { mode: "pve-field" });
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
    (def.drops || []).forEach(function (drop) {
      if (PVE.rollChance(drop.chance || 0, rng)) {
        save.potions[drop.id] = (save.potions[drop.id] || 0) + 1;
        loot.push(drop.id);
      }
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
    save.zeno -= item.price;
    save.potions = save.potions || DATA.emptyPotions();
    save.potions[potionId] = (save.potions[potionId] || 0) + 1;
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
    const hp = unit ? unit.hp : save.hp;
    const maxHp = unit ? unit.maxHp : PVE.derived(save).maxHp;
    if (!maxHp || hp / maxHp >= (DATA.AUTO_POTION_HP || 0.4)) return null;
    const order = ["orange", "red", "white"];
    for (let i = 0; i < order.length; i++) {
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
    save.zeno -= item.price;
    save.owned[itemId] = true;
    return { ok: true };
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
   * Attempt +1 refine. Safe fail: keep current plus, spend Zeno, no break.
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
    save.zeno -= cost;
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
