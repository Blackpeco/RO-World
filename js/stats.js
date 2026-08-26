/**
 * Stat allocation, derived stats, level bonuses, equipment.
 * Formulas match spec section 6 exactly.
 */
(function (root) {
  const DATA = root.DATA;
  const STATS = {};

  STATS.clampStat = function (n) {
    n = Math.floor(Number(n) || 0);
    if (n < 0) return 0;
    if (n > DATA.STAT_MAX_PER_STAT) return DATA.STAT_MAX_PER_STAT;
    return n;
  };

  STATS.sumAllocated = function (alloc) {
    return DATA.STAT_KEYS.reduce(function (s, k) {
      return s + (alloc[k] || 0);
    }, 0);
  };

  /**
   * Equipment that grants raw stat points (str/vit/int/agi/dex/luk)
   * flows through the same formulas as allocated points.
   */
  STATS.equipmentStatPoints = function (equip) {
    const pts = DATA.emptyAllocated();
    if (!equip) return pts;
    DATA.SLOTS.forEach(function (slot) {
      const id = equip[slot.id];
      if (!id) return;
      const item = DATA.ITEMS[id];
      if (!item || !item.bonuses) return;
      DATA.STAT_KEYS.forEach(function (k) {
        if (item.bonuses[k]) pts[k] += item.bonuses[k];
      });
    });
    return pts;
  };

  STATS.weaponPower = function (equip) {
    const id = equip && equip.weapon;
    const w = id && DATA.ITEMS[id];
    if (!w || w.type !== "weapon") return { weaponAtk: 0, weaponMatk: 0 };
    return { weaponAtk: Number(w.weaponAtk) || 0, weaponMatk: Number(w.weaponMatk) || 0 };
  };

    STATS.equipmentFlatBonuses = function (equip) {
    const b = {
      hp: 0,
      mp: 0,
      atk: 0,
      matk: 0,
      def: 0,
      mdef: 0,
      aspeed: 0,
      hardDef: 0,
      aspdPct: 0,
      aspdFlat: 0,
      crit: 0,
      critMult: 0,
      dodge: 0,
      accuracy: 0,
      hit: 0,
      flee: 0,
      perfectDodge: 0,
      hpRegen: 0,
      mpRegen: 0,
      statusResist: 0,
    };
    if (!equip) return b;
    DATA.SLOTS.forEach(function (slot) {
      const id = equip[slot.id];
      if (!id) return;
      const item = DATA.ITEMS[id];
      if (!item || !item.bonuses) return;
      Object.keys(b).forEach(function (k) {
        if (item.bonuses[k]) b[k] += item.bonuses[k];
      });
    });
    return b;
  };

  STATS.refineOf = function (refine, itemId) {
    if (!refine || !itemId) return 0;
    const n = Math.floor(Number(refine[itemId]) || 0);
    if (n < 0) return 0;
    if (n > DATA.REFINE_MAX) return DATA.REFINE_MAX;
    return n;
  };

  STATS.refineChanceTo = function (plus) {
    return DATA.refineChanceTo(plus);
  };

  STATS.refineCostTo = function (plus) {
    return DATA.refineCostTo(plus);
  };

  /**
   * Hard DEF/MDEF from equipped wearable refines; ATK/MATK from weapon refine.
   * Weapon does NOT add Hard DEF. Eyes/mouth/acc are not refinable.
   */
  STATS.refineBonuses = function (equip, refine) {
    const out = { hardDef: 0, hardMdef: 0, atk: 0, matk: 0 };
    if (!equip) return out;
    DATA.SLOTS.forEach(function (slot) {
      const id = equip[slot.id];
      if (!id) return;
      const item = DATA.ITEMS[id];
      if (!item) return;
      const plus = STATS.refineOf(refine, id);
      if (plus <= 0) return;
      if (item.type === "weapon") {
        out.atk += plus * DATA.WEAPON_ATK_PER_REFINE;
        out.matk += plus * DATA.WEAPON_MATK_PER_REFINE;
        return;
      }
      if (DATA.isWearableRefinable(item.type)) {
        const h = DATA.hardFromPlus(plus);
        out.hardDef += h;
        out.hardMdef += h;
      }
    });
    return out;
  };


  /* ---------- locked HIT / FLEE / Perfect Dodge ---------- */
  STATS.round1 = function (x) {
    return Math.round(Number(x) * 10 + 1e-12) / 10;
  };

  STATS.playerHit = function (baseLv, dex, luk, bonus) {
    return 175 + (Number(baseLv) || 0) + (Number(dex) || 0) + Math.floor((Number(luk) || 0) / 3) + (Number(bonus) || 0);
  };

  STATS.playerFlee = function (baseLv, agi, luk, itemBonus) {
    return 100 + (Number(baseLv) || 0) + (Number(agi) || 0) + Math.floor((Number(luk) || 0) / 5) + (Number(itemBonus) || 0);
  };

  STATS.perfectDodge = function (luk, mods) {
    return STATS.round1(1 + (Number(luk) || 0) * 0.1 + (Number(mods) || 0));
  };

  STATS.monsterHit = function (baseLv, dex) {
    return 170 + (Number(baseLv) || 0) + (Number(dex) || 0);
  };

  STATS.monsterFlee = function (baseLv, agi) {
    return 100 + (Number(baseLv) || 0) + (Number(agi) || 0);
  };

  /**
   * FLEE score is WITHOUT SkillBonus. SkillBonus sits outside the surround shrink.
   * 1–2 mobs: no shrink. 12+ mobs: factor 0 → 100 + SkillBonus.
   */
  STATS.actualFlee = function (flee, skillBonus, mobs) {
    flee = Number(flee) || 0;
    skillBonus = Number(skillBonus) || 0;
    mobs = Number(mobs);
    if (!(mobs > 0)) mobs = 1;
    if (mobs <= 2) return flee + skillBonus;
    const factor = Math.max(0, 1 - (mobs - 2) * 0.1);
    return 100 + skillBonus + (flee - 100) * factor;
  };

  STATS.hitChance = function (attackerHit, defenderFleeActual) {
    const raw = (Number(attackerHit) || 0) - (Number(defenderFleeActual) || 0);
    if (raw < 5) return 5;
    if (raw > 100) return 100;
    return raw;
  };

  /* ---------- locked ASPD + physical Soft/Hard DEF ---------- */
  STATS.ceil3 = function (x) {
    return Math.ceil(Number(x) * 1000 - 1e-12) / 1000;
  };
  STATS.floor2 = function (x) {
    return Math.floor(Number(x) * 100 + 1e-12) / 100;
  };
  STATS.floor1 = function (x) {
    return Math.floor(Number(x) * 10 + 1e-12) / 10;
  };

  STATS.aspdPenalty = function (jobBase) {
    jobBase = jobBase == null ? (DATA.JOB_BASE_ASPD || 156) : Number(jobBase);
    const raw = 1 - (jobBase - 144) / 50;
    const rounded = Math.round(raw * 100) / 100;
    const cap = DATA.ASPD_PENALTY_CAP != null ? DATA.ASPD_PENALTY_CAP : 0.96;
    return Math.min(cap, rounded);
  };

  STATS.equipHasShield = function (equip) {
    if (!equip) return false;
    if (equip.shield) return true;
    if (!DATA.SLOTS) return false;
    return DATA.SLOTS.some(function (slot) {
      const id = equip[slot.id];
      if (!id) return false;
      const item = DATA.ITEMS[id];
      if (!item) return false;
      return item.type === "shield" || item.slot === "shield" || slot.id === "shield" || slot.type === "shield";
    });
  };

  STATS.equipmentAspd = function (equip) {
    let pct = 0;
    let flat = 0;
    if (!equip || !DATA.SLOTS) return { equipAspdMod: 0, equipFixed: 0 };
    DATA.SLOTS.forEach(function (slot) {
      const id = equip[slot.id];
      if (!id) return;
      const item = DATA.ITEMS[id];
      if (!item) return;
      if (item.aspdPct) pct += item.aspdPct;
      if (item.aspdFlat) flat += item.aspdFlat;
      if (item.bonuses) {
        if (item.bonuses.aspdPct) pct += item.bonuses.aspdPct;
        if (item.bonuses.aspdFlat) flat += item.bonuses.aspdFlat;
      }
    });
    return { equipAspdMod: pct, equipFixed: flat };
  };

  /**
   * Locked ASPD pipeline.
   * aspd = speed score (closer to 200 = faster).
   * finalAspd = attacks per second = min(50 / (200 − aspd), 7).
   */
  STATS.computeAspd = function (opts) {
    opts = opts || {};
    const jobBase = opts.jobBase != null ? Number(opts.jobBase) : (DATA.JOB_BASE_ASPD || 156);
    const agi = Math.max(0, Number(opts.agi) || 0);
    const dex = Math.max(0, Number(opts.dex) || 0);
    const shieldPenalty = opts.hasShield ? (DATA.SHIELD_ASPD_PENALTY != null ? DATA.SHIELD_ASPD_PENALTY : -8) : 0;
    const potionMod = Number(opts.potionMod) || 0;
    const skillMod = Number(opts.skillMod) || 0;
    const equipAspdMod = Number(opts.equipAspdMod) || 0;
    const equipFixed = Number(opts.equipFixed) || 0;
    const penalty = STATS.aspdPenalty(jobBase);

    const correction = STATS.ceil3((Math.sqrt(205) - Math.sqrt(agi)) / 7.15);
    const statTerm = Math.sqrt(agi * 9.999 + dex * 0.19212) * penalty;
    const inner = jobBase + shieldPenalty - correction + statTerm;
    const baseAspd = STATS.floor2(200 - (200 - inner) * (1 - potionMod - skillMod));
    const equipPct = STATS.floor1((195 - baseAspd) * equipAspdMod);
    const aspd = baseAspd + equipPct + equipFixed;
    const cap = DATA.ASPD_RATE_CAP != null ? DATA.ASPD_RATE_CAP : 7;
    const num = DATA.ASPD_RATE_NUMERATOR != null ? DATA.ASPD_RATE_NUMERATOR : 50;
    let finalAspd;
    if (!(aspd < 200)) finalAspd = cap;
    else finalAspd = Math.min(num / (200 - aspd), cap);

    return {
      correction: correction,
      statTerm: statTerm,
      inner: inner,
      aspdPenalty: penalty,
      baseAspd: baseAspd,
      equipPct: equipPct,
      aspd: aspd,
      finalAspd: finalAspd,
      delaySec: finalAspd > 0 ? 1 / finalAspd : Infinity,
    };
  };

  STATS.playerSoftDef = function (vit, agi, baseLv) {
    return Math.floor((Number(vit) || 0) / 2 + (Number(agi) || 0) / 5 + (Number(baseLv) || 1) / 2);
  };

  STATS.monsterSoftDef = function (vit, baseLv) {
    return Math.floor(((Number(vit) || 0) + (Number(baseLv) || 1)) / 2);
  };

  STATS.monsterSoftMdef = function (int, baseLv) {
    return Math.floor(((Number(int) || 0) + (Number(baseLv) || 1)) / 2);
  };

  STATS.totalSoft = function (soft, bonusA, bonusB) {
    return Math.floor(((Number(soft) || 0) + (Number(bonusA) || 0)) * (1 + (Number(bonusB) || 0) / 100));
  };

  /**
   * HardFactor = (4000 + EffectiveHard) / (4000 + EffectiveHard × 10).
   * 90% reduction cap. Hard DEF is points, not a 0–100%.
   */
  STATS.hardFactor = function (hardDef, defReduce, bypass) {
    hardDef = Number(hardDef) || 0;
    defReduce = Number(defReduce) || 0;
    bypass = Number(bypass) || 0;
    if (bypass >= 1) return 1;
    const effectiveHard = Math.max(0, (hardDef - defReduce) * (1 - bypass));
    return (4000 + effectiveHard) / (4000 + effectiveHard * 10);
  };

  /* ---------- locked Archer bow ATK (no CON / P.ATK) ---------- */
  STATS.BOW_REFINE_ATK = { 1: 2, 2: 3, 3: 5, 4: 7 };
  STATS.BOW_REFINE_SAFE = { 1: 7, 2: 6, 3: 5, 4: 4 };

  STATS.bowRefineBonus = function (weaponLevel, plus) {
    const wlv = Math.max(1, Math.min(4, Math.floor(Number(weaponLevel) || 1)));
    const n = Math.max(0, Math.floor(Number(plus) || 0));
    const per = STATS.BOW_REFINE_ATK[wlv] != null ? STATS.BOW_REFINE_ATK[wlv] : 2;
    return n * per;
  };

  STATS.bowSizePenalty = function (size) {
    const s = String(size == null ? "M" : size).toUpperCase();
    if (s === "L" || s === "LARGE") return 0.75;
    return 1;
  };

  STATS.bowVarianceAmp = function (weaponLevel, baseWeaponAtk) {
    return 0.05 * (Number(weaponLevel) || 1) * (Number(baseWeaponAtk) || 0);
  };

  STATS.bowVariance = function (weaponLevel, baseWeaponAtk, mode) {
    const amp = STATS.bowVarianceAmp(weaponLevel, baseWeaponAtk);
    if (mode === "min") return -amp;
    if (mode === "max") return amp;
    if (mode === "mid" || mode == null || mode === "") return 0;
    if (typeof mode === "number" && isFinite(mode)) return mode;
    return 0;
  };

  STATS.statusAtk = function (lv, str, dex, luk) {
    return Math.floor((Number(lv) || 0) / 4) + Math.floor((Number(str) || 0) / 5) + Math.floor(Number(dex) || 0) + Math.floor((Number(luk) || 0) / 3);
  };

  STATS.doubleStrafeMod = function (lv) {
    lv = Math.max(0, Math.floor(Number(lv) || 0));
    return ((90 + 10 * lv) * 2) / 100;
  };

  STATS.arrowShowerMod = function (lv) {
    lv = Math.max(0, Math.floor(Number(lv) || 0));
    return (150 + 10 * lv) / 100;
  };

  STATS.arrowShowerAoe = function (lv) {
    lv = Math.max(0, Math.floor(Number(lv) || 0));
    return lv >= 6 ? 5 : 3;
  };

  STATS.inArrowShower = function (center, pos, lv) {
    const half = Math.floor(STATS.arrowShowerAoe(lv) / 2);
    return Math.abs((pos && pos.x) - (center && center.x)) <= half && Math.abs((pos && pos.y) - (center && center.y)) <= half;
  };

  STATS.arrowRepelMod = function (lv) {
    return 1.5;
  };

  STATS.owlEyeDex = function (lv) {
    return Math.max(0, Math.floor(Number(lv) || 0));
  };

  STATS.vultureEyeHit = function (lv) {
    return Math.max(0, Math.floor(Number(lv) || 0));
  };

  STATS.vultureEyeRange = function (lv) {
    return Math.max(0, Math.floor(Number(lv) || 0));
  };

  STATS.improveConcentrationPct = function (lv) {
    lv = Math.max(0, Math.floor(Number(lv) || 0));
    return (2 + lv) / 100;
  };

  STATS.improveConcentrationDuration = function (lv) {
    lv = Math.max(0, Math.floor(Number(lv) || 0));
    return 40 + 20 * lv;
  };

  STATS.weaponItem = function (equipOrId) {
    if (!equipOrId) return null;
    if (typeof equipOrId === "string") return (DATA.ITEMS && DATA.ITEMS[equipOrId]) || null;
    const id = equipOrId.weapon || (equipOrId.equip && equipOrId.equip.weapon);
    return (id && DATA.ITEMS && DATA.ITEMS[id]) || null;
  };

  STATS.holdsBow = function (unitOrSaveOrEquip) {
    if (!unitOrSaveOrEquip) return false;
    if (unitOrSaveOrEquip.weaponClass === "bow") return true;
    if (unitOrSaveOrEquip.hasBow) return true;
    const item = STATS.weaponItem(unitOrSaveOrEquip.equip || unitOrSaveOrEquip);
    return !!(item && item.weaponClass === "bow");
  };

  STATS.arrowAtkFrom = function (unitOrSave) {
    if (!unitOrSave) return 0;
    if (unitOrSave.arrowAtk != null) return Number(unitOrSave.arrowAtk) || 0;
    const ammo = unitOrSave.ammo;
    if (ammo) {
      if (ammo.arrowAtk != null) return Number(ammo.arrowAtk) || 0;
      if (ammo.id && DATA.ITEMS && DATA.ITEMS[ammo.id] && DATA.ITEMS[ammo.id].arrowAtk != null) {
        return Number(DATA.ITEMS[ammo.id].arrowAtk) || 0;
      }
      const ammoItem = ammo.item;
      if (ammoItem && ammoItem.arrowAtk != null) return Number(ammoItem.arrowAtk) || 0;
    }
    const equip = unitOrSave.equip;
    if (equip && equip.ammo && DATA.ITEMS && DATA.ITEMS[equip.ammo] && DATA.ITEMS[equip.ammo].arrowAtk != null) {
      return Number(DATA.ITEMS[equip.ammo].arrowAtk) || 0;
    }
    if (unitOrSave.arrow && DATA.ITEMS && DATA.ITEMS[unitOrSave.arrow] && DATA.ITEMS[unitOrSave.arrow].arrowAtk != null) {
      return Number(DATA.ITEMS[unitOrSave.arrow].arrowAtk) || 0;
    }
    return 0;
  };

  STATS.arrowCountFrom = function (unitOrSave) {
    if (!unitOrSave) return 0;
    if (unitOrSave.arrowCount != null) return Math.max(0, Math.floor(Number(unitOrSave.arrowCount) || 0));
    const ammo = unitOrSave.ammo;
    if (typeof ammo === "number") return Math.max(0, Math.floor(ammo));
    if (ammo) {
      if (ammo.count != null) return Math.max(0, Math.floor(Number(ammo.count) || 0));
      if (ammo.qty != null) return Math.max(0, Math.floor(Number(ammo.qty) || 0));
    }
    if (unitOrSave.arrows != null && typeof unitOrSave.arrows !== "object") {
      return Math.max(0, Math.floor(Number(unitOrSave.arrows) || 0));
    }
    if (unitOrSave.inventory && unitOrSave.inventory.arrow != null) {
      return Math.max(0, Math.floor(Number(unitOrSave.inventory.arrow) || 0));
    }
    return 0;
  };

  STATS.hasBowAmmo = function (unitOrSave) {
    return STATS.arrowCountFrom(unitOrSave) > 0;
  };

  STATS.computeBowAtk = function (opts) {
    opts = opts || {};
    function empty(reason) {
      return {
        ok: false,
        reason: reason || "no-bow",
        statusAtk: 0,
        variance: 0,
        statBonus: 0,
        refineBonus: 0,
        overUpgrade: 0,
        weaponAtk: 0,
        extraAtk: 0,
        groupA: 0,
        groupB: 0,
        atk: 0,
        minAtk: 0,
        maxAtk: 0,
      };
    }
    const item = opts.item || (opts.weapon && DATA.ITEMS && DATA.ITEMS[opts.weapon]) || null;
    const inferredBow = opts.hasBow === true || opts.weaponClass === "bow" || !!(item && item.weaponClass === "bow");
    const baseGiven = opts.baseWeaponAtk != null;
    if (!inferredBow && !baseGiven) return empty("no-bow");

    const baseWeapon = baseGiven ? Number(opts.baseWeaponAtk) || 0 : (item ? Number(item.weaponAtk) || 0 : 0);
    const lv = Math.floor(Number(opts.level != null ? opts.level : opts.lv) || 1);
    const str = Math.floor(Number(opts.str) || 0);
    const dex = Math.floor(Number(opts.dex) || 0);
    const luk = Math.floor(Number(opts.luk) || 0);
    const wlv = Math.max(1, Math.floor(Number(opts.weaponLevel != null ? opts.weaponLevel : (item && item.weaponLevel)) || 1));
    const plus = Math.max(0, Math.floor(Number(opts.refine != null ? opts.refine : opts.plus) || 0));
    const size = opts.size || "M";
    const element = opts.element != null ? Number(opts.element) : 1;
    const equipAtk = Number(opts.equipAtk) || 0;
    const consumableAtk = Number(opts.consumableAtk) || 0;
    const arrowAtk = Number(opts.arrowAtk) || 0;
    const pseudoBuffAtk = Number(opts.pseudoBuffAtk) || 0;
    const atkPct = Number(opts.atkPct) || 0;
    const race = Number(opts.race) || 0;
    const sizeMod = Number(opts.sizeMod) || 0;
    const property = Number(opts.property) || 0;
    const classMod = Number(opts.classMod != null ? opts.classMod : 0);
    const masteryAtk = Math.floor(Number(opts.masteryAtk) || 0);
    const buffAtk = Math.floor(Number(opts.buffAtk) || 0);
    const overUpgrade = Number(opts.overUpgrade) || 0;
    const sizePen = STATS.bowSizePenalty(size);
    const statusAtk = STATS.statusAtk(lv, str, dex, luk);
    const statBonus = baseWeapon * dex / 200;
    const refineBonus = STATS.bowRefineBonus(wlv, plus);

    function pack(varMode) {
      const variance = STATS.bowVariance(wlv, baseWeapon, varMode);
      const weaponAtk = Math.floor((baseWeapon + variance + statBonus + refineBonus + overUpgrade) * sizePen);
      const extraAtk = equipAtk + consumableAtk + arrowAtk + pseudoBuffAtk;
      let groupA = 0;
      if (atkPct) groupA = Math.floor((weaponAtk + extraAtk) * atkPct);
      let groupB;
      if (!race && !sizeMod && !property && !classMod) groupB = weaponAtk + extraAtk;
      else groupB = Math.floor((weaponAtk + extraAtk) * (1 + race) * (1 + sizeMod) * (1 + property) * (1 + classMod));
      const atk = Math.floor(statusAtk * 2 + groupA + groupB * element) + masteryAtk + buffAtk;
      return { variance: variance, weaponAtk: weaponAtk, extraAtk: extraAtk, groupA: groupA, groupB: groupB, atk: atk };
    }

    const mid = pack(opts.variance == null ? "mid" : opts.variance);
    const lo = pack("min");
    const hi = pack("max");
    return {
      ok: true,
      statusAtk: statusAtk,
      variance: mid.variance,
      statBonus: statBonus,
      refineBonus: refineBonus,
      overUpgrade: overUpgrade,
      weaponAtk: mid.weaponAtk,
      extraAtk: mid.extraAtk,
      groupA: mid.groupA,
      groupB: mid.groupB,
      atk: mid.atk,
      minAtk: lo.atk,
      maxAtk: hi.atk,
      sizePenalty: sizePen,
      weaponLevel: wlv,
    };
  };

  /**
   * Bonuses granted purely by allocated+equipment stat points (section 6).
   * STR: +1 ATK, bonus floor(STR/10)^2 ATK, +10 maxHP, +0.5 HP regen
   * VIT: +50 maxHP, +250 every 4, +1 HP regen, +1% status resist, +1 DEF
   * INT: +4 maxMP, +25 every 5, +1 MATK + floor(INT/10)^2, +1 MP regen / 5, +1 MDEF
   * AGI: +1% dodge, +0.2 A.speed, +0.2 ATK
   * DEX: +0.1 A.speed, +1% accuracy, +0.3 ATK
   * LUK: +0.34% crit, +0.5 ATK, +0.5 MATK, +0.2% status resist
   */
  STATS.statPointBonuses = function (totalPts) {
    const str = totalPts.str || 0;
    const vit = totalPts.vit || 0;
    const intp = totalPts.int || 0;
    const agi = totalPts.agi || 0;
    const dex = totalPts.dex || 0;
    const luk = totalPts.luk || 0;

    const strBonusAtk = Math.floor(str / 10) * Math.floor(str / 10);
    const intBonusMatk = Math.floor(intp / 10) * Math.floor(intp / 10);
    const vitBonusHp = Math.floor(vit / 4) * 250;
    const intBonusMp = Math.floor(intp / 5) * 25;
    const intMpRegen = Math.floor(intp / 5);

    return {
      hp: str * 10 + vit * 50 + vitBonusHp,
      mp: intp * 4 + intBonusMp,
      atk: str * 1 + strBonusAtk + agi * 0.2 + dex * 0.3 + luk * 0.5,
      matk: intp * 1 + intBonusMatk + luk * 0.5,
      def: vit * 1,
      mdef: intp * 1,
      aspeed: agi * 0.2 + dex * 0.1,
      dodge: agi * 1,
      accuracy: dex * 1,
      crit: luk * 0.34,
      hpRegen: str * 0.5 + vit * 1,
      mpRegen: intMpRegen,
      statusResist: vit * 1 + luk * 0.2,
      strBonusAtk: strBonusAtk,
      intBonusMatk: intBonusMatk,
      vitBonusHp: vitBonusHp,
      intBonusMp: intBonusMp,
    };
  };

  STATS.levelBonuses = function (level) {
    const extra = Math.max(0, (level || 1) - 1);
    const L = DATA.LEVEL_BONUS;
    return {
      hp: extra * L.hp,
      mp: extra * L.mp,
      atk: extra * L.atk,
      matk: extra * L.matk,
      def: extra * L.def,
      mdef: extra * L.mdef,
    };
  };

  /**
   * Compute full derived combat stats for a hero.
   * @param {string} heroId
   * @param {object} allocated  committed STR/VIT/INT/AGI/DEX/LUK
   * @param {object} equip      slot -> itemId
   * @param {number} level
   */
  STATS.computeHeroStats = function (heroId, allocated, equip, level, refine, extra) {
    const base = DATA.HEROES[heroId];
    if (!base) throw new Error("Unknown hero: " + heroId);
    allocated = allocated || DATA.emptyAllocated();
    equip = equip || DATA.emptyEquip();
    level = level || 1;
    refine = refine || {};
    extra = extra || {};
    const skillRanks = extra.skillRanks || extra.ranks || {};
    const owlDex = STATS.owlEyeDex(skillRanks.owl_eye);
    const vultureHit = STATS.vultureEyeHit(skillRanks.vulture_eye);

    const eqPts = STATS.equipmentStatPoints(equip);
    const totalPts = {};
    DATA.STAT_KEYS.forEach(function (k) {
      totalPts[k] = (allocated[k] || 0) + (eqPts[k] || 0);
    });

    const fromPts = STATS.statPointBonuses(totalPts);
    const fromEq = STATS.equipmentFlatBonuses(equip);
    const fromWp = STATS.weaponPower(equip);
    const fromLv = STATS.levelBonuses(level);
    const fromRf = STATS.refineBonuses(equip, refine);

    const hasShield = STATS.equipHasShield(equip);
    const eqAspd = STATS.equipmentAspd(equip);
    const aspdInfo = STATS.computeAspd({
      agi: totalPts.agi || 0,
      dex: totalPts.dex || 0,
      hasShield: hasShield,
      potionMod: 0,
      skillMod: 0,
      equipAspdMod: eqAspd.equipAspdMod,
      equipFixed: eqAspd.equipFixed,
    });
    const aspeed = aspdInfo.finalAspd;
    const stats = {
      heroId: heroId,
      name: base.name,
      emoji: base.emoji,
      color: base.color,
      accent: base.accent,
      level: level,
      allocated: Object.assign({}, allocated),
      totalPts: totalPts,
      maxHp: base.hp + fromPts.hp + fromEq.hp + fromLv.hp,
      maxMp: base.mp + fromPts.mp + fromEq.mp + fromLv.mp,
      atk: base.atk + fromPts.atk + fromEq.atk + fromLv.atk + fromRf.atk + fromWp.weaponAtk,
      matk: base.matk + fromPts.matk + fromEq.matk + fromLv.matk + fromRf.matk + fromWp.weaponMatk,
      def: base.def + fromPts.def + fromEq.def + fromLv.def,
      mdef: base.mdef + fromPts.mdef + fromEq.mdef + fromLv.mdef,
      aspeed: aspeed > 0 ? aspeed : aspdInfo.finalAspd,
      crit: base.crit + fromPts.crit + fromEq.crit,
      critMult: base.critMult + fromEq.critMult,
      dodge: base.dodge + fromPts.dodge + fromEq.dodge,
      accuracy: DATA.HERO_BASE_ACCURACY + fromPts.accuracy + fromEq.accuracy,
      hit: STATS.playerHit(level, (totalPts.dex || 0) + owlDex, totalPts.luk || 0, fromEq.hit || 0) + vultureHit,
      flee: STATS.playerFlee(level, totalPts.agi || 0, totalPts.luk || 0, fromEq.flee || 0),
      perfectDodge: STATS.perfectDodge(totalPts.luk || 0, fromEq.perfectDodge || 0),
      hpRegen: base.hpRegen + fromPts.hpRegen + fromEq.hpRegen,
      mpRegen: base.mpRegen + fromPts.mpRegen + fromEq.mpRegen,
      statusResist: fromPts.statusResist + fromEq.statusResist,
      skills: base.skills.slice(),
      isHero: true,
      portrait: "assets/chars/" + heroId + ".png",
      sprite: "assets/chars/" + heroId + "_sprite.png",
    };

    stats.crit = Math.min(DATA.HERO_CRIT_CAP, stats.crit);
    stats.dodge = Math.min(DATA.HERO_DODGE_CAP, stats.dodge);
    stats.eqPts = eqPts;
    stats.softDef = STATS.totalSoft(STATS.playerSoftDef(totalPts.vit || 0, totalPts.agi || 0, level), 0, 0);
    stats.softMdef = stats.mdef;
    stats.hardDef = fromRf.hardDef + (fromEq.hardDef || 0);
    stats.hardMdef = fromRf.hardMdef + (fromEq.hardDef || 0) + (fromEq.hardMdef || 0);
    stats.aspd = aspdInfo.aspd;
    stats.finalAspd = aspdInfo.finalAspd;
    stats.equipAspdMod = eqAspd.equipAspdMod;
    stats.equipFixed = eqAspd.equipFixed;
    stats.hasShield = hasShield;
    stats.refine = refine;
    stats.equip = equip;
    stats.maxWeight = DATA.maxWeight(totalPts.str || 0);
    stats.str = totalPts.str || 0;
    stats.owlDex = owlDex;
    stats.vultureHit = vultureHit;
    stats.vultureRange = STATS.vultureEyeRange(skillRanks.vulture_eye);
    stats.skillRanks = skillRanks;

    const wepId = equip && equip.weapon;
    const wep = wepId && DATA.ITEMS[wepId];
    stats.weaponClass = wep && wep.weaponClass;
    stats.twoHand = !!(wep && (wep.twoHand || wep.weaponClass === "bow"));
    if (wep && wep.weaponClass === "bow") {
      const bowDex = (totalPts.dex || 0) + owlDex;
      const bow = STATS.computeBowAtk({
        hasBow: true,
        level: level,
        str: totalPts.str || 0,
        dex: bowDex,
        luk: totalPts.luk || 0,
        baseWeaponAtk: Number(wep.weaponAtk) || 0,
        weaponLevel: wep.weaponLevel || 1,
        refine: STATS.refineOf(refine, wepId),
        arrowAtk: extra.arrowAtk != null ? Number(extra.arrowAtk) || 0 : STATS.arrowAtkFrom(extra),
        equipAtk: fromEq.atk || 0,
        variance: "mid",
        size: extra.size || "M",
      });
      stats.bowAtk = bow;
    }

    const hasEquip = DATA.SLOTS.some(function (slot) {
      return !!equip[slot.id];
    });
    if (hasEquip) {
      const bare = STATS.computeHeroStats(heroId, allocated, DATA.emptyEquip(), level, {}, extra);
      stats.gearDelta = {
        maxHp: stats.maxHp - bare.maxHp,
        maxMp: stats.maxMp - bare.maxMp,
        atk: stats.atk - bare.atk,
        matk: stats.matk - bare.matk,
        def: stats.def - bare.def,
        mdef: stats.mdef - bare.mdef,
        aspeed: stats.aspeed - bare.aspeed,
        softDef: stats.softDef - bare.softDef,
        hardDef: stats.hardDef - bare.hardDef,
        aspd: stats.aspd - bare.aspd,
        hit: stats.hit - bare.hit,
        flee: stats.flee - bare.flee,
        perfectDodge: stats.perfectDodge - bare.perfectDodge,
      };
    } else {
      stats.gearDelta = { maxHp: 0, maxMp: 0, atk: 0, matk: 0, def: 0, mdef: 0, aspeed: 0, softDef: 0, hardDef: 0, aspd: 0, hit: 0, flee: 0, perfectDodge: 0 };
    }
    return stats;
  };

  STATS.computeBossStats = function (bossDef) {
    const aspdInfo = (bossDef.agi != null || bossDef.dex != null)
      ? STATS.computeAspd({
          agi: bossDef.agi || 0,
          dex: bossDef.dex || 0,
          hasShield: !!(bossDef.equip && STATS.equipHasShield(bossDef.equip)),
        })
      : null;
    const soft = bossDef.vit != null
      ? STATS.monsterSoftDef(bossDef.vit, bossDef.level)
      : bossDef.def;
    return {
      heroId: bossDef.id,
      name: bossDef.name,
      emoji: bossDef.emoji,
      color: bossDef.color,
      level: bossDef.level,
      maxHp: bossDef.hp,
      maxMp: bossDef.mp,
      atk: bossDef.atk,
      matk: bossDef.matk,
      def: bossDef.def,
      mdef: bossDef.mdef,
      softDef: soft,
      softMdef: bossDef.mdef,
      hardDef: bossDef.hardDef || 0,
      hardMdef: 0,
      aspeed: aspdInfo ? aspdInfo.finalAspd : bossDef.aspeed,
      aspd: aspdInfo ? aspdInfo.aspd : null,
      finalAspd: aspdInfo ? aspdInfo.finalAspd : null,
      crit: bossDef.crit,
      critMult: bossDef.critMult,
      dodge: Math.min(DATA.BOSS_DODGE_CAP, bossDef.dodge),
      accuracy: bossDef.accuracy,
      hit: STATS.monsterHit(bossDef.level || 1, bossDef.dex || 0),
      flee: STATS.monsterFlee(bossDef.level || 1, bossDef.agi || 0),
      perfectDodge: bossDef.perfectDodge != null ? Number(bossDef.perfectDodge) : (bossDef.pd != null ? Number(bossDef.pd) : 0),
      hpRegen: 0,
      mpRegen: 0,
      statusResist: 0,
      skills: bossDef.skills.slice(),
      isHero: false,
      isBoss: true,
      portrait: "assets/chars/" + bossDef.id + ".png",
      sprite: "assets/chars/" + bossDef.id + "_sprite.png",
    };
  };

  STATS.computeMonsterStats = function (mobDef) {
    mobDef = mobDef || {};
    const aspdInfo = (mobDef.agi != null || mobDef.dex != null)
      ? STATS.computeAspd({
          agi: mobDef.agi || 0,
          dex: mobDef.dex || 0,
          hasShield: !!(mobDef.equip && STATS.equipHasShield(mobDef.equip)),
        })
      : null;
    const soft = mobDef.vit != null
      ? STATS.monsterSoftDef(mobDef.vit, mobDef.level || 1)
      : mobDef.def;
    const softM = mobDef.int != null
      ? STATS.monsterSoftMdef(mobDef.int, mobDef.level || 1)
      : mobDef.mdef;
    return {
      heroId: mobDef.id,
      name: mobDef.name,
      emoji: mobDef.emoji,
      color: mobDef.color,
      level: mobDef.level || 1,
      maxHp: mobDef.hp,
      maxMp: mobDef.mp,
      atk: mobDef.atk,
      matk: mobDef.matk,
      def: mobDef.def,
      mdef: mobDef.mdef,
      softDef: soft,
      softMdef: softM,
      hardDef: mobDef.hardDef || 0,
      hardMdef: mobDef.hardMdef || 0,
      aspeed: aspdInfo ? aspdInfo.finalAspd : mobDef.aspeed,
      aspd: aspdInfo ? aspdInfo.aspd : null,
      finalAspd: aspdInfo ? aspdInfo.finalAspd : null,
      crit: mobDef.crit,
      critMult: mobDef.critMult,
      dodge: Math.min(DATA.BOSS_DODGE_CAP, mobDef.dodge || 0),
      accuracy: mobDef.accuracy,
      hit: STATS.monsterHit(mobDef.level || 1, mobDef.dex || 0),
      flee: STATS.monsterFlee(mobDef.level || 1, mobDef.agi || 0),
      perfectDodge: mobDef.perfectDodge != null ? Number(mobDef.perfectDodge) : (mobDef.pd != null ? Number(mobDef.pd) : 0),
      hpRegen: 0,
      mpRegen: 0,
      statusResist: 0,
      skills: (mobDef.skills || []).slice(),
      isHero: false,
      isBoss: true,
      isMonster: true,
      portrait: mobDef.portrait || ("assets/mobs/" + (mobDef.id || "poring") + ".png"),
      sprite: mobDef.sprite || ("assets/mobs/" + (mobDef.id || "poring") + ".png"),
    };
  };

  /**
   * Allocation session helper.
   * locked = previously committed (cannot reclaim)
   * session = points being placed on this screen
   */
  STATS.createAllocSession = function (locked, pool) {
    locked = Object.assign(DATA.emptyAllocated(), locked || {});
    return {
      locked: locked,
      session: DATA.emptyAllocated(),
      pool: pool,
    };
  };

  /**
   * Point cost to raise a stat from currentValue to currentValue+1.
   * Bands by the NEW rank: 1–10 → 2, 11–20 → 3, …, 91–99 → 11.
   * currentValue is locked + session (allocated ranks), not equipment.
   */
  STATS.costToRaise = function (currentValue) {
    const cur = STATS.clampStat(currentValue);
    const next = cur + 1;
    if (next < 1) return 0;
    if (next > DATA.STAT_MAX_PER_STAT) return Infinity;
    if (next <= 10) return 2;
    if (next <= 20) return 3;
    if (next <= 30) return 4;
    if (next <= 40) return 5;
    if (next <= 50) return 6;
    if (next <= 60) return 7;
    if (next <= 70) return 8;
    if (next <= 80) return 9;
    if (next <= 90) return 10;
    return 11;
  };

  STATS.costOfRanks = function (fromValue, ranks) {
    let c = 0;
    const n = Math.max(0, Math.floor(ranks || 0));
    for (let i = 0; i < n; i++) {
      c += STATS.costToRaise(fromValue + i);
    }
    return c;
  };

  STATS.sessionSpent = function (sess) {
    return DATA.STAT_KEYS.reduce(function (s, k) {
      return s + STATS.costOfRanks(sess.locked[k] || 0, sess.session[k] || 0);
    }, 0);
  };

  STATS.sessionRemaining = function (sess) {
    return sess.pool - STATS.sessionSpent(sess);
  };

  STATS.sessionTotal = function (sess, key) {
    return (sess.locked[key] || 0) + (sess.session[key] || 0);
  };

  STATS.allocMin = function (sess, key) {
    sess.session[key] = 0;
  };

  STATS.allocMax = function (sess, key) {
    while (true) {
      const cur = STATS.sessionTotal(sess, key);
      if (cur >= DATA.STAT_MAX_PER_STAT) break;
      const cost = STATS.costToRaise(cur);
      if (STATS.sessionRemaining(sess) < cost) break;
      sess.session[key] = (sess.session[key] || 0) + 1;
    }
  };

  STATS.allocAdd = function (sess, key, delta) {
    if (delta > 0) {
      const cur = STATS.sessionTotal(sess, key);
      if (cur >= DATA.STAT_MAX_PER_STAT) return;
      const cost = STATS.costToRaise(cur);
      if (STATS.sessionRemaining(sess) < cost) return;
      sess.session[key] = (sess.session[key] || 0) + 1;
      return;
    }
    if (delta < 0) {
      if ((sess.session[key] || 0) <= 0) return;
      sess.session[key] -= 1;
    }
  };

  STATS.commitSession = function (sess) {
    const out = DATA.emptyAllocated();
    DATA.STAT_KEYS.forEach(function (k) {
      out[k] = (sess.locked[k] || 0) + (sess.session[k] || 0);
    });
    return out;
  };

  root.STATS = STATS;
})(typeof globalThis !== "undefined" ? globalThis : window);
