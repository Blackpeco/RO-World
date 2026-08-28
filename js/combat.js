/**
 * Combat engine: damage, DEF/MDEF, crit, dodge, poison,
 * real-time ASPD/CDs, plus leftover ATB helpers for tests/serialize.
 * weaken, guards/counters, all hero + boss skills.
 */
(function (root) {
  const DATA = root.DATA;
  const STATS = root.STATS;
  const COMBAT = {};

  /* ---------- seeded RNG (for async PvP determinism) ---------- */
  COMBAT.createRng = function (seed) {
    let s = (seed >>> 0) || 1;
    return {
      next: function () {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
      },
      getSeed: function () {
        return s;
      },
      setSeed: function (n) {
        s = n >>> 0;
      },
      chance: function (percent) {
        if (percent <= 0) return false;
        if (percent >= 100) return true;
        return this.next() * 100 < percent;
      },
    };
  };

  /* ---------- unit factory ---------- */
  COMBAT.createUnit = function (derived, side) {
    return {
      side: side,
      heroId: derived.heroId,
      name: derived.name,
      emoji: derived.emoji,
      portrait: derived.portrait || ("assets/chars/" + derived.heroId + ".png"),
      sprite: derived.sprite || derived.portrait || "",
      color: derived.color,
      accent: derived.accent || derived.color,
      level: derived.level || 1,
      isHero: !!derived.isHero,
      isBoss: !!derived.isBoss,
      isMonster: !!derived.isMonster,
      maxHp: derived.maxHp,
      maxMp: derived.maxMp,
      hp: derived.maxHp,
      mp: derived.maxMp,
      atk: derived.atk,
      matk: derived.matk,
      def: derived.def,
      mdef: derived.mdef,
      softDef: derived.softDef != null ? derived.softDef : (derived.def || 0),
      softMdef: derived.softMdef != null ? derived.softMdef : (derived.mdef || 0),
      hardDef: derived.hardDef || 0,
      hardMdef: derived.hardMdef || 0,
      aspd: derived.aspd,
      finalAspd: derived.finalAspd,
      equipAspdMod: derived.equipAspdMod || 0,
      equipFixed: derived.equipFixed || 0,
      hasShield: !!derived.hasShield,
      potionAspdMod: derived.potionAspdMod || 0,
      skillAspdMod: derived.skillAspdMod || 0,
      softDefBonusA: derived.softDefBonusA || 0,
      softDefBonusB: derived.softDefBonusB || 0,
      jobBaseAspd: derived.jobBaseAspd,
      refine: derived.refine ? Object.assign({}, derived.refine) : {},
      equip: derived.equip ? Object.assign({}, derived.equip) : null,
      baseAtk: derived.atk,
      baseMatk: derived.matk,
      baseCrit: derived.crit,
      baseCritMult: derived.critMult,
      baseAspeed: derived.aspeed,
      baseAccuracy: derived.accuracy,
      baseDodge: derived.dodge,
      aspeed: derived.aspeed || DATA.HERO_SPEED,
      crit: derived.crit,
      critMult: derived.critMult,
      dodge: derived.dodge,
      accuracy: derived.accuracy,
      hit: derived.hit != null ? derived.hit : 0,
      flee: derived.flee != null ? derived.flee : 0,
      perfectDodge: derived.perfectDodge != null ? derived.perfectDodge : 0,
      fleeSkillBonus: derived.fleeSkillBonus || 0,
      hpRegen: derived.hpRegen || 0,
      mpRegen: derived.mpRegen || 0,
      statusResist: derived.statusResist || 0,
      skills: derived.skills.slice(),
      cds: {},
      atb: 0,
      poisons: [],
      weakenTurns: 0,
      guard: false,
      guardCritPending: 0,
      counter: false,
      veilTurns: 0,
      veilDodge: 0,
      veilHealPct: 0,
      focusTurns: 0,
      focusAcc: 0,
      focusAtk: 0,
      focusAspeed: 0,
      focusCrit: 0,
      stoneShield: false,
      stoneShieldTurns: 0,
      fogTurns: 0,
      fogDodge: 0,
      rageTurns: 0,
      rageAtk: 0,
      rageCrit: 0,
      curseTurns: 0,
      curseAtk: 0,
      curseCrit: 0,
      curseCritMult: 0,
      dragonStacks: 0,
      skillRanks: derived.skillRanks ? Object.assign({}, derived.skillRanks) : null,
      guardDR: 0.8,
      sanctuary: false,
      sanctuaryDR: 0.4,
      counterDR: 0.6,
      nextAtkBonus: 0,
      phantomTurns: 0,
      phantomDodge: 0,
      markTurns: 0,
      markCrit: 0,
      markAcc: 0,
      angelVeilTurns: 0,
      angelDodge: 0,
      angelCrit: 0,
      wrathTurns: 0,
      wrathAtk: 0,
      wrathCrit: 0,
      wrathCritMult: 0,
      allocated: derived.allocated ? Object.assign({}, derived.allocated) : DATA.emptyAllocated(),
      totalPts: derived.totalPts ? Object.assign({}, derived.totalPts) : DATA.emptyAllocated(),
      eqPts: derived.eqPts ? Object.assign({}, derived.eqPts) : DATA.emptyAllocated(),
      gearDelta: derived.gearDelta ? Object.assign({}, derived.gearDelta) : { maxHp: 0, maxMp: 0, atk: 0, matk: 0, def: 0, mdef: 0, aspeed: 0 },
      bowAtk: derived.bowAtk || null,
      weaponClass: derived.weaponClass || null,
      twoHand: !!derived.twoHand,
      owlDex: derived.owlDex || 0,
      vultureHit: derived.vultureHit || 0,
      vultureRange: derived.vultureRange || 0,
      arrowAtk: derived.arrowAtk,
      ammo: derived.ammo || null,
      arrowCount: derived.arrowCount,
      magnumFireUntil: 0,
      magnumFireAtk: 0,
      provokedUntil: 0,
      provokeDefMul: 1,
      provokeAtkMul: 1,
      endureUntil: 0,
      endureHits: 0,
      endureMdef: 0,
      hidden: false,
      hidingUntil: 0,
    };
  };

  COMBAT.effectiveDodge = function (unit, vsSilence) {
    let d = unit.dodge;
    if (unit.fogTurns > 0) d += unit.fogDodge;
    if (!vsSilence && unit.veilTurns > 0) d += unit.veilDodge;
    if (!vsSilence && unit.phantomTurns > 0) d += unit.phantomDodge;
    if (unit.angelVeilTurns > 0) d += unit.angelDodge;
    if (unit.isHero) d = Math.min(DATA.HERO_DODGE_CAP, d);
    else d = Math.min(DATA.BOSS_DODGE_CAP, d);
    return d;
  };

  COMBAT.effectiveAccuracy = function (unit) {
    let a = unit.accuracy;
    if (unit.focusTurns > 0) a += unit.focusAcc;
    if (unit.markTurns > 0) a += unit.markAcc;
    return a;
  };

  COMBAT.effectiveAtk = function (unit) {
    let a = unit.atk;
    if (unit.focusTurns > 0) a += unit.focusAtk;
    if (unit.rageTurns > 0) a += unit.rageAtk;
    if (unit.curseTurns > 0) a += unit.curseAtk;
    if (unit.wrathTurns > 0) a += unit.wrathAtk;
    return a;
  };

  COMBAT.potionAspdMod = function (unit) {
    if (!unit) return 0;
    let best = 0;
    if (unit.potionAspdMod) best = Math.max(best, Number(unit.potionAspdMod) || 0);
    if (unit.aspdPotionMod) best = Math.max(best, Number(unit.aspdPotionMod) || 0);
    if (unit.berserk || (unit.berserkTurns && unit.berserkTurns > 0)) {
      best = Math.max(best, DATA.BERSERK_ASPD_MOD != null ? DATA.BERSERK_ASPD_MOD : 0.20);
    }
    return best;
  };

  COMBAT.skillAspdMod = function (unit) {
    if (!unit) return 0;
    let best = 0;
    if (unit.skillAspdMod) best = Math.max(best, Number(unit.skillAspdMod) || 0);
    return best;
  };

  COMBAT.unitHasShield = function (unit) {
    if (!unit) return false;
    if (unit.hasShield) return true;
    return STATS.equipHasShield ? STATS.equipHasShield(unit.equip) : false;
  };

  COMBAT.effectiveAspeed = function (unit) {
    if (!unit) return DATA.HERO_SPEED;
    const hasPipeline = unit.aspd != null || unit.finalAspd != null || (unit.isHero && unit.totalPts);
    if (hasPipeline && STATS.computeAspd) {
      const pts = unit.totalPts || {};
      const focusFlat = unit.focusTurns > 0 ? (unit.focusAspeed || 0) : 0;
      const info = STATS.computeAspd({
        agi: pts.agi || unit.agi || 0,
        dex: pts.dex || unit.dex || 0,
        hasShield: COMBAT.unitHasShield(unit),
        potionMod: COMBAT.potionAspdMod(unit),
        skillMod: COMBAT.skillAspdMod(unit),
        equipAspdMod: unit.equipAspdMod || 0,
        equipFixed: (unit.equipFixed || 0) + focusFlat,
        jobBase: unit.jobBaseAspd,
      });
      return info.finalAspd;
    }
    let s = unit.aspeed;
    if (unit.focusTurns > 0) s += unit.focusAspeed;
    return s > 0 ? s : DATA.HERO_SPEED;
  };

  COMBAT.effectiveCrit = function (unit) {
    let c = unit.crit;
    if (unit.focusTurns > 0) c += unit.focusCrit;
    if (unit.rageTurns > 0) c += unit.rageCrit;
    if (unit.curseTurns > 0) c += unit.curseCrit;
    if (unit.dragonStacks > 0) c += unit.dragonStacks * 45;
    if (unit.angelVeilTurns > 0) c += unit.angelCrit;
    if (unit.wrathTurns > 0) c += unit.wrathCrit;
    if (unit.markTurns > 0) c += unit.markCrit;
    if (unit.isHero) c = Math.min(DATA.HERO_CRIT_CAP, c);
    else c = Math.min(100, c);
    return c;
  };

  COMBAT.effectiveCritMult = function (unit) {
    let m = unit.critMult;
    if (unit.curseTurns > 0) m += unit.curseCritMult;
    if (unit.dragonStacks > 0) m += unit.dragonStacks * 50;
    if (unit.wrathTurns > 0) m += unit.wrathCritMult;
    return m;
  };

  /* ---------- locked bow ATK combat ---------- */
  COMBAT.consumeBowAmmo = function (unit, save) {
    return { ok: true, count: unit && unit.arrowCount != null ? unit.arrowCount : 0, skipped: true };
  };

  COMBAT.hasBowAmmoForCombat = function (unit, opts) {
    return true;
  };

  COMBAT.bowSkillGate = function (unit, opts) {
    opts = opts || {};
    const holds = (STATS.holdsBow && STATS.holdsBow(unit)) || (unit && unit.weaponClass === "bow") || opts.hasBow;
    if (!holds) return { ok: false, reason: "no-bow" };
    return { ok: true };
  };

  COMBAT.unitBowAtk = function (unit, opts) {
    opts = opts || {};
    const holds = (STATS.holdsBow && STATS.holdsBow(unit)) || (unit && unit.weaponClass === "bow") || opts.hasBow || opts.baseWeaponAtk != null;
    if (!holds) return STATS.computeBowAtk ? STATS.computeBowAtk({}) : { ok: false, reason: "no-bow", atk: 0 };
    const pts = (unit && unit.totalPts) || {};
    const ranks = (unit && unit.skillRanks) || {};
    const owl = STATS.owlEyeDex ? STATS.owlEyeDex(ranks.owl_eye) : 0;
    let dex = Math.floor(Number(opts.dex != null ? opts.dex : (pts.dex || (unit && unit.dex) || 0)) + owl);
    if (unit && (unit.concPct || unit.improveConcentration)) {
      const pct = Number(unit.concPct) || 0;
      const body = (unit.allocated && unit.allocated.dex || 0) + (unit.eqPts && unit.eqPts.dex || 0) + owl;
      dex = dex + Math.floor(body * pct);
    }
    const wepId = unit && unit.equip && unit.equip.weapon;
    const wep = wepId && DATA.ITEMS && DATA.ITEMS[wepId];
    return STATS.computeBowAtk({
      hasBow: true,
      level: opts.level != null ? opts.level : (unit && unit.level) || 1,
      str: opts.str != null ? opts.str : pts.str || (unit && unit.str) || 0,
      dex: dex,
      luk: opts.luk != null ? opts.luk : pts.luk || (unit && unit.luk) || 0,
      baseWeaponAtk: opts.baseWeaponAtk != null ? opts.baseWeaponAtk : (wep && wep.weaponAtk) || (unit && unit.baseWeaponAtk) || 0,
      weaponLevel: opts.weaponLevel != null ? opts.weaponLevel : (wep && wep.weaponLevel) || (unit && unit.weaponLevel) || 1,
      refine: opts.refine != null ? opts.refine : (wepId ? STATS.refineOf(unit.refine, wepId) : (unit && unit.refinePlus) || 0),
      arrowAtk: opts.arrowAtk != null ? opts.arrowAtk : 0,
      equipAtk: opts.equipAtk != null ? opts.equipAtk : (unit && unit.equipAtk) || 0,
      consumableAtk: opts.consumableAtk || 0,
      variance: opts.variance || "mid",
      rng: opts.rng,
      size: opts.size || "M",
      element: opts.element != null ? opts.element : 1,
      atkPct: opts.atkPct,
      race: opts.race,
      sizeMod: opts.sizeMod,
      property: opts.property,
      classMod: opts.classMod,
      masteryAtk: opts.masteryAtk,
      buffAtk: opts.buffAtk,
    });
  };

  COMBAT.bowRaw = function (atk, opts) {
    opts = opts || {};
    atk = Number(atk) || 0;
    const ranged = Number(opts.ranged != null ? opts.ranged : opts.rangedPct) || 0;
    const rangedRed = Number(opts.rangedRed != null ? opts.rangedRed : opts.rangedRedPct) || 0;
    const dmgPct = Number(opts.damage != null ? opts.damage : opts.damagePct) || 0;
    const skillDmg = Number(opts.skillDmg != null ? opts.skillDmg : opts.skillDmgPct) || 0;
    let raw;
    if (opts.skillMod != null) {
      raw = Math.floor(atk * Number(opts.skillMod) * (1 + skillDmg) * (1 + ranged));
    } else {
      raw = Math.floor(atk * (1 + ranged) * (1 - rangedRed) * (1 + dmgPct));
    }
    if (opts.crit) raw = Math.floor(raw * 1.4);
    return raw;
  };

  COMBAT.applyBowDefense = function (raw, target, opts) {
    opts = opts || {};
    raw = Number(raw) || 0;
    const hardDef = (target && target.hardDef) || 0;
    const bypass = opts.bypass != null ? opts.bypass : 0;
    const defReduce = opts.defReduce || 0;
    const hf = STATS.hardFactor(hardDef, defReduce, bypass);
    let after = Math.floor(raw * hf);
    if (!opts.crit) {
      const baseSoft = target ? (target.softDef != null ? target.softDef : (target.def || 0)) : 0;
      const bonusA = ((target && target.softDefBonusA) || 0) + (opts.softBonusA || 0);
      const bonusB = ((target && target.softDefBonusB) || 0) + (opts.softBonusB || 0);
      const totalSoft = STATS.totalSoft ? STATS.totalSoft(baseSoft, bonusA, bonusB) : Math.floor((baseSoft + bonusA) * (1 + bonusB / 100));
      after = after - totalSoft;
    }
    if (after < 1) after = 1;
    return after;
  };

  COMBAT.knockbackStep = function (from, pos) {
    from = from || { x: 0, y: 0 };
    pos = pos || { x: 0, y: 0 };
    let sx = Math.sign((pos.x || 0) - (from.x || 0));
    let sy = Math.sign((pos.y || 0) - (from.y || 0));
    if (!sx && !sy) { sx = 0; sy = 1; }
    return { x: (pos.x || 0) + sx, y: (pos.y || 0) + sy };
  };

  COMBAT.knockbackTiles = function (ent, from, tiles, isWalkable) {
    const unit = ent && ent.unit ? ent.unit : ent;
    if (unit && unit.endureHits > 0 && COMBAT.buffActive(unit.endureUntil)) {
      unit.endureHits -= 1;
      const x = (ent && ent.x) || 0;
      const y = (ent && ent.y) || 0;
      return { dx: 0, dy: 0, x: x, y: y, endured: true };
    }
    tiles = Math.max(0, Math.floor(Number(tiles) || 0));
    const start = { x: (ent && ent.x) || 0, y: (ent && ent.y) || 0 };
    let cur = { x: start.x, y: start.y };
    const origin = from || start;
    for (let i = 0; i < tiles; i++) {
      const nxt = COMBAT.knockbackStep(origin, cur);
      if (typeof isWalkable === "function" && !isWalkable(nxt.x, nxt.y)) break;
      cur = nxt;
    }
    if (ent && typeof ent === "object") {
      ent.x = cur.x;
      ent.y = cur.y;
    }
    return { dx: cur.x - start.x, dy: cur.y - start.y, x: cur.x, y: cur.y };
  };

  COMBAT.doBowHit = function (state, actor, target, skillName, opts) {
    opts = opts || {};
    const rng = state && state.rng;
    const isSkill = !!opts.skill;
    let conn = { hit: true, crit: false, pd: false };
    if (!opts.skipHitCheck) {
      conn = COMBAT.rollConnect(actor, target, rng, {
        atkRatio: 1,
        matkRatio: 0,
        canCrit: isSkill ? false : opts.canCrit !== false,
        forceCrit: opts.forceCrit,
        skipPd: isSkill || !!opts.skipPd,
        surround: opts.surround != null ? opts.surround : COMBAT.surroundCount(state),
        bonusCrit: opts.bonusCrit || 0,
        vsSilence: opts.vsSilence,
      });
      if (!conn.hit) {
        if (!opts.skipConsume) COMBAT.consumeBowAmmo(actor, state && state.save);
        if (state) {
          COMBAT.pushLog(state, '<span class="log-miss">💨 ' + actor.name + " ใช้ " + skillName + " — หลบหลีก!</span>");
          COMBAT.emitFx(state, { kind: "miss", side: target.side, pd: !!conn.pd });
        }
        return { hit: false, damage: 0, crit: false, pd: conn.pd, raw: 0 };
      }
    }
    const crit = !isSkill && !!conn.crit;
    let atk = opts.atk;
    if (atk == null) {
      const bow = COMBAT.unitBowAtk(actor, Object.assign({}, opts, {
        variance: crit ? "max" : (opts.variance != null ? opts.variance : "roll"),
        rng: opts.rng || rng,
      }));
      if (!bow.ok) return { hit: false, damage: 0, crit: false, reason: bow.reason || "no-bow", raw: 0 };
      atk = bow.atk;
    }
    if (!opts.skipConsume) COMBAT.consumeBowAmmo(actor, state && state.save);
    const raw = COMBAT.bowRaw(atk, {
      skillMod: opts.skillMod,
      skillDmg: opts.skillDmg,
      ranged: opts.ranged,
      rangedRed: opts.rangedRed,
      damage: opts.damage,
      crit: crit,
    });
    const dealt = COMBAT.applyBowDefense(raw, target, { crit: crit, bypass: opts.bypass, defReduce: opts.defReduce });
    let applied = { dealt: dealt };
    if (state) {
      applied = COMBAT.applyIncoming(state, actor, target, dealt, skillName);
      const tag = crit ? ' <span class="log-crit">CRIT!</span>' : "";
      if (applied.dealt > 0 || !applied.blocked) {
        COMBAT.pushLog(state, '<span class="log-dmg">💥 ' + actor.name + " ใช้ " + skillName + " ทำความเสียหาย " + applied.dealt + tag + "</span>");
      }
      if (applied.dealt > 0) COMBAT.emitFx(state, { kind: "dmg", side: target.side, amount: applied.dealt, crit: crit });
      if (target.hp <= 0) COMBAT.endBattle(state, actor);
    }
    return { hit: true, damage: applied.dealt, crit: crit, raw: raw, applied: applied };
  };

  /* ---------- damage formulas ---------- */
  /**
   * Physical (locked): HardFactor first, then subtract Soft. Crit skips Soft.
   * Magic: unchanged (soft then * (1 − hardMdef/100)). Magic cannot crit.
   * Poison / ignoreArmor skips both. Min damage 1 (except poison).
   * DEF Reversal (Ice Pick) is a hook only — opts.defReversal is ignored.
   */
  COMBAT.calcDamage = function (attacker, target, atkRatio, matkRatio, opts) {
    opts = opts || {};
    const atk = COMBAT.effectiveAtk(attacker);
    const matk = attacker.matk;
    let atkPart = (atkRatio || 0) * atk;
    let matkPart = (matkRatio || 0) * matk;
    const isPhysical = (atkRatio || 0) !== 0;

    let crit = false;
    if (!opts.isPoison && isPhysical) {
      if (opts.forceCrit) {
        crit = true;
      } else if (opts.canCrit !== false) {
        let critChance = COMBAT.effectiveCrit(attacker);
        if (opts.bonusCrit) critChance += opts.bonusCrit;
        if (attacker.isHero) critChance = Math.min(DATA.HERO_CRIT_CAP, critChance);
        else critChance = Math.min(100, critChance);
        if (opts.rng && opts.rng.chance(critChance)) crit = true;
      }
    }

    if (!opts.ignoreArmor) {
      if (isPhysical) {
        let hardDef = target.hardDef || 0;
        if (COMBAT.buffActive(target.provokedUntil) && target.provokeDefMul != null) {
          hardDef = hardDef * (Number(target.provokeDefMul) || 1);
        }
        const bypass = opts.bypass != null ? opts.bypass : 0;
        const defReduce = opts.defReduce || 0;
        /* opts.defReversal: Ice Pick hook — not implemented. */
        const hf = opts.defReversal ? 1 : STATS.hardFactor(hardDef, defReduce, bypass);
        let afterHard = Math.floor(atkPart * hf);
        atkPart = afterHard;
        if (!crit) {
          let baseSoft = target.softDef != null ? target.softDef : (target.def || 0);
          if (COMBAT.buffActive(target.provokedUntil) && target.provokeDefMul != null) {
            baseSoft = baseSoft * (Number(target.provokeDefMul) || 1);
          }
          const bonusA = (target.softDefBonusA || 0) + (opts.softBonusA || 0);
          const bonusB = (target.softDefBonusB || 0) + (opts.softBonusB || 0);
          const totalSoft = STATS.totalSoft ? STATS.totalSoft(baseSoft, bonusA, bonusB) : Math.floor((baseSoft + bonusA) * (1 + bonusB / 100));
          atkPart = afterHard - totalSoft;
        }
        if (atkPart < 0) atkPart = 0;
      }

      let softMdef = target.mdef != null ? target.mdef : (target.softMdef || 0);
      if (COMBAT.buffActive(target.endureUntil) && target.endureMdef) {
        softMdef += Number(target.endureMdef) || 0;
      }
      const hardMdef = Math.max(0, Math.min(100, target.hardMdef || 0));
      matkPart = Math.max(0, matkPart - softMdef);
      matkPart = matkPart * (1 - hardMdef / 100);
    }

    let dmg = atkPart + matkPart;

    if (!opts.isPoison) {
      if (dmg < 1) dmg = 1;
      if (crit) {
        const phys = atkPart * (1 + COMBAT.effectiveCritMult(attacker) / 100);
        dmg = phys + matkPart;
        if (dmg < 1) dmg = 1;
      }
    }

    if (attacker.weakenTurns > 0) {
      dmg = dmg * 0.8;
    }

    return {
      damage: Math.floor(dmg),
      crit: crit,
      atkPart: atkPart,
      matkPart: matkPart,
    };
  };

  COMBAT.effectiveHit = function (unit) {
    let h = Number(unit && unit.hit) || 0;
    if (unit && unit.focusTurns > 0) h += unit.focusAcc || 0;
    if (unit && unit.markTurns > 0) h += unit.markAcc || 0;
    return h;
  };

  COMBAT.unitFleeSkillBonus = function (unit, vsSilence) {
    let b = Number(unit && unit.fleeSkillBonus) || 0;
    if (!unit) return b;
    if (unit.fogTurns > 0) b += unit.fogDodge || 0;
    if (!vsSilence && unit.veilTurns > 0) b += unit.veilDodge || 0;
    if (!vsSilence && unit.phantomTurns > 0) b += unit.phantomDodge || 0;
    if (unit.angelVeilTurns > 0) b += unit.angelDodge || 0;
    return b;
  };

  COMBAT.surroundCount = function (state) {
    if (!state) return 1;
    let list = null;
    if (Array.isArray(state.foes)) list = state.foes;
    else if (state.encounter && Array.isArray(state.encounter.foes)) list = state.encounter.foes;
    else if (Array.isArray(state.entities)) {
      list = state.entities.filter(function (e) {
        return e && e.kind !== "player" && !e.dead && e.aggro;
      });
    }
    if (!list || !list.length) return 1;
    let n = 0;
    list.forEach(function (f) {
      if (!f) return;
      if (f.dead) return;
      const unit = f.unit || f;
      if (unit && unit.hp != null && unit.hp <= 0) return;
      n += 1;
    });
    return n > 0 ? n : 1;
  };

  COMBAT.defenderActualFlee = function (target, vsSilence, surround) {
    const skill = COMBAT.unitFleeSkillBonus(target, vsSilence);
    const score = Number(target && target.flee) || 0;
    if (target && target.isHero) {
      return STATS.actualFlee(score, skill, surround != null ? surround : 1);
    }
    return score + skill;
  };

  COMBAT.hitChance = function (attacker, target, vsSilence, surround) {
    return STATS.hitChance(COMBAT.effectiveHit(attacker), COMBAT.defenderActualFlee(target, vsSilence, surround));
  };

  COMBAT.rollConnect = function (attacker, target, rng, opts) {
    opts = opts || {};
    const atkR = opts.atkRatio != null ? opts.atkRatio : 1;
    const matkR = opts.matkRatio != null ? opts.matkRatio : 0;
    const isMagic = !!(opts.isMagic || ((atkR || 0) === 0 && (matkR || 0) > 0));
    if (isMagic) {
      return { hit: true, crit: false, pd: false };
    }

    const pd = Number(target && target.perfectDodge) || 0;
    if (!opts.skipPd && pd > 0 && rng && rng.chance(pd)) {
      return { hit: false, crit: false, pd: true };
    }

    let crit = false;
    if (opts.canCrit !== false) {
      let critChance = COMBAT.effectiveCrit(attacker);
      if (opts.bonusCrit) critChance += opts.bonusCrit;
      if (attacker && attacker.isHero) critChance = Math.min(DATA.HERO_CRIT_CAP, critChance);
      else critChance = Math.min(100, critChance);
      if (opts.forceCrit) crit = true;
      else if (rng && rng.chance(critChance)) crit = true;
    }
    if (crit) {
      return { hit: true, crit: true, pd: false };
    }

    const surround = opts.surround != null ? opts.surround : 1;
    const chance = COMBAT.hitChance(attacker, target, opts.vsSilence, surround);
    const hit = rng ? rng.chance(chance) : chance >= 100;
    return { hit: !!hit, crit: false, pd: false };
  };

  COMBAT.rollHit = function (attacker, target, rng, vsSilence) {
    return COMBAT.rollConnect(attacker, target, rng, { vsSilence: vsSilence }).hit;
  };

  COMBAT.rollStatus = function (target, rng) {
    return !rng.chance(target.statusResist || 0);
  };

  COMBAT.clampHpMp = function (unit) {
    if (unit.hp > unit.maxHp) unit.hp = unit.maxHp;
    if (unit.hp < 0) unit.hp = 0;
    if (unit.mp > unit.maxMp) unit.mp = unit.maxMp;
    if (unit.mp < 0) unit.mp = 0;
  };

  COMBAT.healUnit = function (unit, amount) {
    amount = Math.floor(amount);
    if (amount < 0) amount = 0;
    unit.hp += amount;
    COMBAT.clampHpMp(unit);
    return amount;
  };

  COMBAT.restoreMp = function (unit, amount) {
    amount = Math.floor(amount);
    if (amount < 0) amount = 0;
    unit.mp += amount;
    COMBAT.clampHpMp(unit);
    return amount;
  };

  /* ---------- combat state ---------- */
  COMBAT.createState = function (left, right, opts) {
    opts = opts || {};
    return {
      left: left,
      right: right,
      rng: COMBAT.createRng(opts.seed || (Date.now() % 2147483647) || 1),
      log: [],
      turnCount: 0,
      waitingAction: null,
      over: false,
      winner: null,
      mode: opts.mode || "pve",
      fx: [],
      fxQueue: [],
      save: opts.save || null,
    };
  };

  COMBAT.opponentOf = function (state, unit) {
    return unit === state.left ? state.right : state.left;
  };

  COMBAT.pushLog = function (state, html) {
    state.log.push(html);
    if (state.log.length > 80) state.log.shift();
  };

  COMBAT.emitFx = function (state, evt) {
    if (!state || !evt) return;
    if (!state.fx) state.fx = [];
    if (!state.fxQueue) state.fxQueue = [];
    state.fx.push(evt);
    state.fxQueue.push(evt);
  };

  COMBAT.skillAnimKind = function (skillId, def) {
    if (skillId === "heal" || skillId === "sanctuary" || skillId === "detoxify" || skillId === "increase_hp_recovery") return "heal";
    if (def && def.type === "self") return "buff";
    return "attack";
  };

  COMBAT.nowMs = function () {
    return Date.now();
  };

  COMBAT.buffActive = function (until) {
    return !!(until && COMBAT.nowMs() < until);
  };

  COMBAT.holdsDagger = function (unit) {
    if (!unit) return false;
    if (unit.weaponClass === "dagger") return true;
    const item = STATS.weaponItem && STATS.weaponItem(unit.equip || unit);
    if (item && item.weaponClass === "dagger") return true;
    if (!unit.weaponClass && !(item && item.weaponClass) && unit.heroId === "assassin") return true;
    return false;
  };

  COMBAT.breakHide = function (unit) {
    if (!unit || !unit.hidden) return false;
    unit.hidden = false;
    unit.hidingUntil = 0;
    return true;
  };

  COMBAT.toastOrLog = function (state, msg) {
    if (state) COMBAT.pushLog(state, '<span class="log-buff">' + msg + "</span>");
    const UI = (typeof root !== "undefined" && root.UI) ? root.UI : (typeof globalThis !== "undefined" && globalThis.UI);
    if (UI && UI.toast) UI.toast(msg);
  };

  /* ---------- start-of-turn: poison, regen, buffs, CDs ---------- */
  COMBAT.tickPoisons = function (state, unit) {
    if (!unit.poisons.length) return 0;
    let total = 0;
    const remain = [];
    unit.poisons.forEach(function (p) {
      const dmg = Math.floor(p.damage);
      unit.hp -= dmg;
      total += dmg;
      p.turns -= 1;
      if (p.turns > 0) remain.push(p);
    });
    unit.poisons = remain;
    COMBAT.clampHpMp(unit);
    if (total > 0) {
      COMBAT.pushLog(
        state,
        '<span class="log-poison">☠️ ' +
          unit.name +
          " ได้รับความเสียหายจากพิษ " +
          total +
          " (เหลือ HP " +
          Math.floor(unit.hp) +
          ")</span>"
      );
      COMBAT.emitFx(state, { kind: "poison", side: unit.side, amount: total, poison: true, source: "poison" });
    }
    return total;
  };

  COMBAT.applyRegen = function (state, unit) {
    if (!unit.isHero) return;
    if (unit.noRegen) return;
    const h = COMBAT.healUnit(unit, unit.hpRegen);
    const m = COMBAT.restoreMp(unit, unit.mpRegen);
    if (h > 0 || m > 0) {
      COMBAT.pushLog(
        state,
        '<span class="log-heal">💚 ' +
          unit.name +
          " ฟื้นฟู HP +" +
          h +
          " / MP +" +
          m +
          "</span>"
      );
    }
  };

  COMBAT.tickBuffDurations = function (state, unit) {
    if (unit.guard) {
      unit.guard = false;
      COMBAT.pushLog(state, '<span class="log-buff">🛡️ เกราะเวทมนตร์ของ ' + unit.name + " หมดฤทธิ์</span>");
    }
    if (unit.sanctuary) {
      unit.sanctuary = false;
      unit.sanctuaryDR = 0;
      COMBAT.pushLog(state, '<span class="log-buff">✨ วงก์บุญของ ' + unit.name + " หมดฤทธิ์</span>");
    }
    if (unit.counter) {
      unit.counter = false;
      COMBAT.pushLog(state, '<span class="log-buff">🗡️ ท่าสวนกลับของ ' + unit.name + " หมดฤทธิ์</span>");
    }
    if (unit.stoneShield) {
      unit.stoneShieldTurns -= 1;
      if (unit.stoneShieldTurns <= 0) {
        unit.stoneShield = false;
        COMBAT.pushLog(state, '<span class="log-buff">🪨 โล่หินผาของ ' + unit.name + " สลายไป</span>");
      }
    }

    if (unit.veilTurns > 0) {
      const healAmt = (unit.veilHealPct / 100) * unit.matk;
      const h = COMBAT.healUnit(unit, healAmt);
      COMBAT.pushLog(
        state,
        '<span class="log-heal">🌑 เงาพรางฟื้นฟู ' + unit.name + " +" + h + " HP</span>"
      );
      if (h > 0) COMBAT.emitFx(state, { kind: "heal", side: unit.side, amount: h, source: "veil" });
      unit.veilTurns -= 1;
      if (unit.veilTurns <= 0) {
        unit.veilDodge = 0;
        unit.veilHealPct = 0;
        COMBAT.pushLog(state, '<span class="log-buff">เงาพรางของ ' + unit.name + " หมดลง</span>");
      }
    }

    if (unit.weakenTurns > 0) {
      unit.weakenTurns -= 1;
      if (unit.weakenTurns <= 0) {
        COMBAT.pushLog(state, '<span class="log-buff">' + unit.name + " พ้นจากสถานะอ่อนแอ</span>");
      }
    }

    if (unit.fogTurns > 0) {
      unit.fogTurns -= 1;
      if (unit.fogTurns <= 0) {
        unit.fogDodge = 0;
        COMBAT.pushLog(state, '<span class="log-buff">สายหมอกของ ' + unit.name + " สลาย</span>");
      }
    }

    if (unit.rageTurns > 0) {
      unit.rageTurns -= 1;
      if (unit.rageTurns <= 0) {
        unit.rageAtk = 0;
        unit.rageCrit = 0;
        COMBAT.pushLog(state, '<span class="log-buff">โกรธเกรี้ยวของ ' + unit.name + " หมดลง</span>");
      }
    }

    if (unit.curseTurns > 0) {
      unit.curseTurns -= 1;
      if (unit.curseTurns <= 0) {
        unit.curseAtk = 0;
        unit.curseCrit = 0;
        unit.curseCritMult = 0;
        COMBAT.pushLog(state, '<span class="log-buff">สาปมรณะของ ' + unit.name + " หมดลง</span>");
      }
    }

    if (unit.phantomTurns > 0) {
      unit.phantomTurns -= 1;
      if (unit.phantomTurns <= 0) {
        unit.phantomDodge = 0;
        COMBAT.pushLog(state, '<span class="log-buff">ภาพผีของ ' + unit.name + " หมดลง</span>");
      }
    }

    if (unit.angelVeilTurns > 0) {
      unit.angelVeilTurns -= 1;
      if (unit.angelVeilTurns <= 0) {
        unit.angelDodge = 0;
        unit.angelCrit = 0;
        COMBAT.pushLog(state, '<span class="log-buff">ปกปกาศของ ' + unit.name + " หมดลง</span>");
      }
    }

    if (unit.wrathTurns > 0) {
      unit.wrathTurns -= 1;
      if (unit.wrathTurns <= 0) {
        unit.wrathAtk = 0;
        unit.wrathCrit = 0;
        unit.wrathCritMult = 0;
        COMBAT.pushLog(state, '<span class="log-buff">เกร็กวินาศของ ' + unit.name + " หมดลง</span>");
      }
    }

    /* CDs are ticked separately (turns in ATB, milliseconds in real-time). */
  };

  COMBAT.tickOwnFocusMark = function (state, unit) {
    if (unit.focusTurns > 0) {
      unit.focusTurns -= 1;
      if (unit.focusTurns <= 0) {
        unit.focusAcc = 0;
        unit.focusAtk = 0;
        unit.focusAspeed = 0;
        unit.focusCrit = 0;
        COMBAT.pushLog(state, '<span class="log-buff">เพ่งสมาธิของ ' + unit.name + " หมดลง</span>");
      }
    }
    if (unit.markTurns > 0) {
      unit.markTurns -= 1;
      if (unit.markTurns <= 0) {
        unit.markCrit = 0;
        unit.markAcc = 0;
        COMBAT.pushLog(state, '<span class="log-buff">ประทับเหยี่ยวของ ' + unit.name + " หมดลง</span>");
      }
    }
  };

  COMBAT.tickOwnTurnBuffs = function (state, unit) {
    COMBAT.tickBuffDurations(state, unit);
    Object.keys(unit.cds).forEach(function (id) {
      if (unit.cds[id] > 0) unit.cds[id] -= 1;
    });
  };

  COMBAT.tickFocusOnEnemyAct = function (state, actor) {
    const foe = COMBAT.opponentOf(state, actor);
    if (foe.focusTurns > 0) {
      foe.focusTurns -= 1;
      if (foe.focusTurns <= 0) {
        foe.focusAcc = 0;
        foe.focusAtk = 0;
        foe.focusAspeed = 0;
        foe.focusCrit = 0;
        COMBAT.pushLog(state, '<span class="log-buff">เพ่งสมาธิของ ' + foe.name + " หมดลง</span>");
      }
    }
    if (foe.markTurns > 0) {
      foe.markTurns -= 1;
      if (foe.markTurns <= 0) {
        foe.markCrit = 0;
        foe.markAcc = 0;
        COMBAT.pushLog(state, '<span class="log-buff">ประทับเหยี่ยวของ ' + foe.name + " หมดลง</span>");
      }
    }
  };

  COMBAT.beginTurn = function (state, unit) {
    state.turnCount += 1;
    COMBAT.tickPoisons(state, unit);
    if (unit.hp <= 0) {
      COMBAT.endBattle(state, COMBAT.opponentOf(state, unit));
      return { dead: true };
    }
    COMBAT.applyRegen(state, unit);
    COMBAT.tickOwnTurnBuffs(state, unit);
    COMBAT.tickFocusOnEnemyAct(state, unit);
    return { dead: false };
  };

  COMBAT.endBattle = function (state, winner) {
    state.over = true;
    state.winner = winner.side;
    state.waitingAction = null;
    COMBAT.pushLog(
      state,
      '<span class="log-system">⚔️ ' + winner.name + " เป็นผู้ชนะ!</span>"
    );
  };

  /* ---------- incoming-hit resolution (guard / counter / stone shield) ---------- */
  COMBAT.applyIncoming = function (state, attacker, target, rawDamage, skillName) {
    let dealt = rawDamage;
    let reflected = 0;
    let blocked = false;
    let convertedHeal = 0;
    let notes = [];

    if (target.stoneShield) {
      convertedHeal = Math.floor(rawDamage * 0.5);
      COMBAT.healUnit(target, convertedHeal);
      target.stoneShield = false;
      target.stoneShieldTurns = 0;
      notes.push("โล่หินผาแปลงดาเมจเป็นฮีล +" + convertedHeal);
      COMBAT.pushLog(
        state,
        '<span class="log-heal">🪨 โล่หินผาของ ' +
          target.name +
          " ดูดซับและฟื้นฟู +" +
          convertedHeal +
          " HP</span>"
      );
      if (convertedHeal > 0) COMBAT.emitFx(state, { kind: "heal", side: target.side, amount: convertedHeal, source: "stoneshield" });
      return { dealt: 0, reflected: 0, blocked: true, convertedHeal: convertedHeal, notes: notes };
    }

    if (target.guard) {
      const dr = target.guardDR != null ? target.guardDR : 0.8;
      dealt = Math.floor(rawDamage * (1 - dr));
      const luk = (target.totalPts && target.totalPts.luk) || 0;
      target.guardCritPending = 25 + luk * 1;
      target.guard = false;
      notes.push("เกราะเวทมนตร์ลดดาเมจ " + Math.round(dr * 100) + "% (คริครั้งถัดไป +" + target.guardCritPending + "%)");
      COMBAT.pushLog(
        state,
        '<span class="log-buff">🛡️ เกราะเวทมนตร์ลดดาเมจเหลือ ' +
          dealt +
          " และชาร์จคริครั้งถัดไป +" +
          target.guardCritPending +
          "%</span>"
      );
    } else if (target.sanctuary) {
      const dr = target.sanctuaryDR != null ? target.sanctuaryDR : 0.4;
      dealt = Math.floor(rawDamage * (1 - dr));
      target.sanctuary = false;
      notes.push("วงก์บุญลดดาเมจ " + Math.round(dr * 100) + "%");
      COMBAT.pushLog(
        state,
        '<span class="log-buff">✨ วงก์บุญลดดาเมจเหลือ ' + dealt + "</span>"
      );
    } else if (target.counter) {
      const dr = target.counterDR != null ? target.counterDR : 0.6;
      dealt = Math.floor(rawDamage * (1 - dr));
      reflected = rawDamage;
      const selfHeal = Math.floor(rawDamage * 0.5);
      COMBAT.healUnit(target, selfHeal);
      target.counter = false;
      notes.push("สวนกลับลดดาเมจ 60% สะท้อน " + reflected + " ฮีล +" + selfHeal);
      COMBAT.pushLog(
        state,
        '<span class="log-buff">🗡️ สวนกลับฉับพลัน! ลดดาเมจเหลือ ' +
          dealt +
          " สะท้อน " +
          reflected +
          " และฟื้นฟู +" +
          selfHeal +
          "</span>"
      );
      if (selfHeal > 0) COMBAT.emitFx(state, { kind: "heal", side: target.side, amount: selfHeal, source: "counter" });
    }

    target.hp -= dealt;
    COMBAT.clampHpMp(target);

    if (reflected > 0) {
      COMBAT.applyReflect(state, target, attacker, reflected);
    }

    return { dealt: dealt, reflected: reflected, blocked: blocked, convertedHeal: convertedHeal, notes: notes };
  };

  COMBAT.applyReflect = function (state, from, to, raw) {
    if (to.stoneShield) {
      const h = Math.floor(raw * 0.5);
      COMBAT.healUnit(to, h);
      to.stoneShield = false;
      to.stoneShieldTurns = 0;
      COMBAT.pushLog(
        state,
        '<span class="log-heal">🪨 โล่หินผาของ ' +
          to.name +
          " แปลงดาเมจสะท้อนเป็นฮีล +" +
          h +
          "</span>"
      );
      if (h > 0) COMBAT.emitFx(state, { kind: "heal", side: to.side, amount: h, source: "stoneshield" });
      return;
    }
    to.hp -= raw;
    COMBAT.clampHpMp(to);
    COMBAT.pushLog(
      state,
      '<span class="log-dmg">↩️ ' + to.name + " โดนสะท้อน " + raw + " ดาเมจ</span>"
    );
    if (raw > 0) COMBAT.emitFx(state, { kind: "dmg", side: to.side, amount: raw, source: "reflect" });
    if (to.hp <= 0) {
      COMBAT.endBattle(state, from);
    }
  };

  COMBAT.applyPoison = function (state, target, damagePerTurn, turns, sourceName) {
    target.poisons.push({ damage: damagePerTurn, turns: turns, src: sourceName });
    COMBAT.pushLog(
      state,
      '<span class="log-poison">☠️ ' +
        target.name +
        " ติดพิษ " +
        Math.floor(damagePerTurn) +
        "/เทิร์น นาน " +
        turns +
        " เทิร์น</span>"
    );
  };

  COMBAT.hasPoison = function (unit) {
    return unit.poisons && unit.poisons.length > 0;
  };

  /* ---------- skill rank scaling ---------- */
  COMBAT.rankOf = function (unit, skillId) {
    if (!unit || !unit.skillRanks) return 1;
    const r = unit.skillRanks[skillId];
    return r == null ? 1 : r;
  };

  COMBAT.rankCoeff = function (rank) {
    rank = Number(rank) || 0;
    if (rank < 1) return 0;
    return 1 + 0.15 * (rank - 1);
  };

  COMBAT.rankPct = function (basePct, rank) {
    return Math.round((basePct || 0) * COMBAT.rankCoeff(rank));
  };

  COMBAT.rankUtil = function (base, rank) {
    return (base || 0) + 4 * Math.max(0, (Number(rank) || 0) - 1);
  };

  COMBAT.rankMp = function (baseMp, rank) {
    const extra = Math.max(0, (Number(rank) || 1) - 1);
    return Math.max(0, Math.floor((baseMp || 0) * (1 - 0.05 * extra)));
  };

  COMBAT.rankCd = function (baseCd, rank) {
    rank = Number(rank) || 1;
    const reduce = rank >= 4 ? 1 : 0;
    return Math.max(0, (baseCd || 0) - reduce);
  };

  COMBAT.atkScale = function (unit, skillId, baseAtk, baseMatk) {
    const k = COMBAT.rankCoeff(COMBAT.rankOf(unit, skillId));
    return { atk: (baseAtk || 0) * k, matk: (baseMatk || 0) * k };
  };

  COMBAT.effectBonus = function (unit, skillId) {
    return 4 * Math.max(0, COMBAT.rankOf(unit, skillId) - 1);
  };

  COMBAT.skillPreview = function (skillId, rank) {
    const def = DATA.SKILLS[skillId];
    if (!def) return { name: skillId, text: "", mp: 0, cd: 0, rank: rank || 0 };
    rank = rank == null ? 1 : Number(rank) || 0;
    const show = Math.max(1, rank);
    const k = COMBAT.rankCoeff(show);
    const u = 4 * Math.max(0, show - 1);
    const mp = COMBAT.rankMp(def.mp, show);
    const cd = COMBAT.rankCd(def.cd, show);
    function pct(base) {
      return Math.round(base * k);
    }
    function util(base) {
      return base + u;
    }
    let body = "";
    switch (skillId) {
      case "attack":
        body = "ดาเมจ " + pct(140) + "% ATK";
        break;
      case "magifireblade":
        body = "ดาเมจ " + pct(200) + "% ATK + " + pct(280) + "% MATK";
        break;
      case "guard":
        body = "ลดดาเมจ " + util(80) + "% (ถึงตาถัดไปของตน, หมดฤทธิ์ถ้าไม่โดนตี) หลังโดนตี: คริครั้งถัดไป " + util(25) + "%+1%/LUK";
        break;
      case "heal":
        body = "ฟื้นฟู HP " + pct(300) + "% MATK";
        break;
      case "stab":
        body = "ดาเมจ " + pct(90) + "% ATK | พิษ 50%+0.5%/AGI นาน 4 เทิร์น (20%+0.4%/AGI) MATK/เทิร์น";
        break;
      case "shadowkill":
        body = "พิษ (70%+1%/INT) MATK/เทิร์น นาน 3 เทิร์น (×2 ถ้าเป้าหมายติดพิษอยู่แล้ว) ไม่มีดาเมจตรง";
        break;
      case "veil":
        body = "หลบหลีก " + util(30) + "%+0.5%/AGI นาน 3 เทิร์นของตน + ฟื้นฟู (" + util(60) + "%+1%/VIT) MATK/เทิร์น นาน 3 เทิร์น | ไม่ป้องกันคาถาสะกด";
        break;
      case "counter":
        body = "ลดดาเมจ " + util(60) + "% + สะท้อน 100% ของดาเมจดิบ + ฟื้นฟู HP 50% ของดาเมจดิบ | ถ้าหลบสำเร็จ: ฮีล 200% MATK + MP 10% MATK";
        break;
      case "arrowshot":
        body = "ดาเมจ " + pct(100) + "% ATK | โอกาส (20%+2%/DEX) อ่อนแอ (−20% ดาเมจศัตรู) นาน 3 เทิร์น";
        break;
      case "powershot":
        body = "ดาเมจ " + pct(280) + "% ATK";
        break;
      case "focus":
        body = "+(" + util(20) + "%+0.3%/DEX) ความแม่นยำ, +(30+1/DEX) ATK, +(3+0.05/AGI) A.speed, +(" + util(25) + "%+0.34%/LUK) คริ นาน 4 เทิร์น (นับตอนศัตรูลงมือ)";
        break;
      case "soularrow":
        body = "ดาเมจ " + pct(150) + "% ATK + " + pct(250) + "% MATK + ฟื้นฟู HP 35% ของดาเมจ";
        break;
      case "blade_storm":
        body = "ดาเมจ " + pct(180) + "% ATK สองครั้ง";
        break;
      case "sanctuary":
        body = "ฟื้นฟู HP " + pct(200) + "% MATK + ลดดาเมจ " + util(40) + "% (1 ครั้ง)";
        break;
      case "nightfall":
        body = "ดาเมจ " + pct(160) + "% ATK + พิษ 40% MATK/เทิร์น ×3";
        break;
      case "phantom":
        body = "หลบ +" + util(20) + "% นาน 2 เทิร์น + โจมตีครั้งถัดไป +" + pct(80) + "% ATK";
        break;
      case "rain":
        body = "ดาเมจ " + pct(90) + "% ATK × 3 ครั้ง";
        break;
      case "mark":
        body = "คริ +" + util(15) + "% ความแม่นยำ +" + util(20) + " นาน 4 เทิร์น (นับตอนศัตรูลงมือ)";
        break;
      case "double_strafe":
        body = "ดาเมจ " + Math.round(STATS.doubleStrafeMod(show) * 100) + "% ATK | ต้องถือธนู + ลูกศร";
        break;
      case "arrow_shower":
        body = "ดาเมจ " + Math.round(STATS.arrowShowerMod(show) * 100) + "% ATK AoE " + STATS.arrowShowerAoe(show) + "×" + STATS.arrowShowerAoe(show) + " ดีด 2 ช่อง";
        break;
      case "arrow_repel":
        body = "ดาเมจ 150% ATK ดีด 6 ช่อง";
        break;
      case "owl_eye":
        body = "DEX +" + STATS.owlEyeDex(show);
        break;
      case "vulture_eye":
        body = "HIT +" + STATS.vultureEyeHit(show) + " ระยะธนู +" + STATS.vultureEyeRange(show);
        break;
      case "improve_concentration":
        body = "AGI/DEX +" + Math.round(STATS.improveConcentrationPct(show) * 100) + "% นาน " + STATS.improveConcentrationDuration(show) + "s";
        break;
      case "sword_mastery":
        body = "Weapon ATK +" + STATS.swordMasteryAtk(show) + " (ดาบมือเดียว)";
        break;
      case "twohand_mastery":
        body = "Weapon ATK +" + STATS.twohandMasteryAtk(show) + " (ดาบสองมือ)";
        break;
      case "increase_hp_recovery":
        body = "ฟื้น HP เพิ่มทุกติ๊ก ตามเลเวลสกิล";
        break;
      case "bash":
        body = "ดาเมจ " + Math.round(STATS.bashMod(show) * 100) + "% ATK";
        break;
      case "magnum_break":
        body = "ไฟ " + Math.round(STATS.magnumBreakMod(show) * 100) + "% ATK AoE ดีด 2 ช่อง +20% ATK 10s";
        break;
      case "provoke":
        body = "สำเร็จ " + STATS.provokeSuccess(show, 0, 0) + "%: DEF −" + Math.round(STATS.provokeDefReduce(show) * 100) + "% ATK +" + Math.round(STATS.provokeAtkBonus(show) * 100) + "% นาน 30s";
        break;
      case "endure":
        body = "MDEF +" + STATS.endureMdef(show) + " ทน 7 ฮิตไม่วูบ นาน 10s";
        break;
      case "double_attack":
        body = "โอกาส " + Math.round(STATS.doubleAttackChance(show) * 100) + "% โจมตีซ้ำ 100% ATK (มีดสั้น / โจมตีปกติ)";
        break;
      case "improve_dodge":
        body = "FLEE +" + STATS.improveDodgeFlee(show);
        break;
      case "steal":
        body = "ขโมย Zeno หรือดรอปจากมอนสนาม (สำเร็จตาม DEX)";
        break;
      case "hiding":
        body = "ซ่อนตัว มอนไม่จ้อง เสีย 1 SP ทุก " + STATS.hidingSpIntervalSec(show) + "s";
        break;
      case "envenom":
        body = "ดาเมจ 100% ATK +" + STATS.envenomBonus(show) + " โอกาสพิษ " + Math.round(STATS.envenomPoisonChance(show) * 100) + "%";
        break;
      case "detoxify":
        body = "ถอนพิษบนตัวเอง";
        break;
      default:
        body = (def.button && def.button.indexOf(" — ") >= 0) ? def.button.split(" — ").slice(1).join(" — ") : (def.button || "");
    }
    const costs = [];
    if (cd <= 0) costs.push("ไม่มีคูลดาวน์");
    else costs.push("CD " + cd);
    if (mp <= 0) costs.push("ไม่เสีย MP");
    else costs.push("MP " + mp);
    return {
      name: def.name,
      text: body + " | " + costs.join(" | "),
      body: body,
      mp: mp,
      cd: cd,
      rank: rank,
      showRank: show,
    };
  };

  /* ---------- skill helpers ---------- */
  COMBAT.skillReady = function (unit, skillId, skillDef) {
    const cd = unit.cds[skillId] || 0;
    if (cd > 0) return false;
    const need = COMBAT.rankMp(skillDef.mp, COMBAT.rankOf(unit, skillId));
    if (unit.mp < need) return false;
    return true;
  };

  COMBAT.spendAndCd = function (unit, skillDef) {
    const rank = COMBAT.rankOf(unit, skillDef.id);
    const need = COMBAT.rankMp(skillDef.mp, rank);
    unit.mp -= need;
    if (unit.mp < 0) unit.mp = 0;
    const cd = COMBAT.rankCd(skillDef.cd, rank);
    if (cd > 0) unit.cds[skillDef.id] = cd;
  };

  COMBAT.consumeGuardCrit = function (attacker, opts) {
    if (attacker.guardCritPending > 0) {
      opts.bonusCrit = (opts.bonusCrit || 0) + attacker.guardCritPending;
      attacker.guardCritPending = 0;
    }
    return opts;
  };

  COMBAT.doHitAttack = function (state, actor, target, skillName, atkR, matkR, extra) {
    extra = extra || {};
    if (actor.nextAtkBonus) {
      atkR = (atkR || 0) + actor.nextAtkBonus;
      actor.nextAtkBonus = 0;
    }
    if (COMBAT.buffActive(actor.magnumFireUntil) && actor.magnumFireAtk) {
      atkR = (atkR || 0) * (1 + Number(actor.magnumFireAtk) || 0);
    }
    if (COMBAT.buffActive(actor.provokedUntil) && actor.provokeAtkMul) {
      atkR = (atkR || 0) * (Number(actor.provokeAtkMul) || 1);
    }
    const rng = state.rng;
    const isMagic = extra.isMagic || ((atkR || 0) === 0 && (matkR || 0) > 0);
    let conn = { hit: true, crit: false, pd: false };
    if (!extra.skipHitCheck && !isMagic) {
      COMBAT.consumeGuardCrit(actor, extra);
      conn = COMBAT.rollConnect(actor, target, rng, {
        atkRatio: atkR,
        matkRatio: matkR,
        vsSilence: extra.vsSilence,
        surround: extra.surround != null ? extra.surround : COMBAT.surroundCount(state),
        bonusCrit: extra.bonusCrit || 0,
        canCrit: extra.canCrit !== false,
        forceCrit: extra.forceCrit,
      });
      if (!conn.hit) {
        COMBAT.pushLog(
          state,
          '<span class="log-miss">💨 ' + actor.name + " ใช้ " + skillName + " — หลบหลีก!</span>"
        );
        COMBAT.emitFx(state, { kind: "miss", side: target.side, pd: !!conn.pd });
        if (target.counter) {
          const hpH = COMBAT.healUnit(target, 2.0 * target.matk);
          const mpH = COMBAT.restoreMp(target, 0.1 * target.matk);
          target.counter = false;
          COMBAT.pushLog(
            state,
            '<span class="log-heal">🗡️ ' +
              target.name +
              " หลบได้ขณะตั้งท่าสวนกลับ! ฟื้นฟู HP +" +
              hpH +
              " MP +" +
              mpH +
              "</span>"
          );
          if (hpH > 0) COMBAT.emitFx(state, { kind: "heal", side: target.side, amount: hpH, source: "counter-dodge" });
        }
        return { hit: false, damage: 0, crit: false, pd: conn.pd };
      }
      extra.forceCrit = conn.crit;
      extra.canCrit = false;
    }

    const opts = COMBAT.consumeGuardCrit(actor, {
      rng: rng,
      canCrit: extra.canCrit !== false,
      bonusCrit: extra.bonusCrit || 0,
      forceCrit: extra.forceCrit,
    });
    const calc = COMBAT.calcDamage(actor, target, atkR, matkR, opts);
    const applied = COMBAT.applyIncoming(state, actor, target, calc.damage, skillName);
    const tag = calc.crit ? ' <span class="log-crit">CRIT!</span>' : "";
    if (applied.dealt > 0 || !applied.blocked) {
      COMBAT.pushLog(
        state,
        '<span class="log-dmg">💥 ' +
          actor.name +
          " ใช้ " +
          skillName +
          " ทำความเสียหาย " +
          applied.dealt +
          tag +
          "</span>"
      );
    }
    if (applied.dealt > 0) {
      COMBAT.emitFx(state, { kind: "dmg", side: target.side, amount: applied.dealt, crit: !!calc.crit });
    }
    if (target.hp <= 0) {
      COMBAT.endBattle(state, actor);
    }
    if (extra.auto && !extra._doubleProc && !state.over && target.hp > 0 && COMBAT.holdsDagger(actor)) {
      const lv = COMBAT.rankOf(actor, "double_attack");
      const chance = STATS.doubleAttackChance ? STATS.doubleAttackChance(lv) : 0;
      if (lv > 0 && chance > 0 && state.rng && state.rng.chance(chance * 100)) {
        COMBAT.pushLog(state, '<span class="log-buff">⚡ ' + actor.name + " โจมตีสองครั้ง!</span>");
        return COMBAT.doHitAttack(state, actor, target, skillName, 1, 0, { auto: true, _doubleProc: true });
      }
    }
    return { hit: true, damage: applied.dealt, crit: calc.crit, raw: calc.damage, applied: applied };
  };

  /* ---------- hero skills ---------- */
  COMBAT.heroSkill = function (state, actor, skillId) {
    const def = DATA.SKILLS[skillId];
    if (!def) return { ok: false, reason: "unknown" };
    if (!COMBAT.skillReady(actor, skillId, def)) return { ok: false, reason: "not-ready" };
    if (def.bowSkill || skillId === "double_strafe" || skillId === "arrow_shower" || skillId === "arrow_repel") {
      const gate = COMBAT.bowSkillGate(actor);
      if (!gate.ok) return gate;
    }
    const target = COMBAT.opponentOf(state, actor);
    if (skillId === "hiding" && actor.hidden) {
      COMBAT.breakHide(actor);
      COMBAT.pushLog(state, '<span class="log-buff">👤 ' + actor.name + " ออกจากที่ซ่อน</span>");
      return { ok: true, toggled: true };
    }
    COMBAT.spendAndCd(actor, def);
    if (skillId !== "hiding") COMBAT.breakHide(actor);
    COMBAT.emitFx(state, { kind: "act", side: actor.side, skillId: skillId, anim: COMBAT.skillAnimKind(skillId, def) });

    switch (skillId) {
      case "attack": {
        if (STATS.holdsBow(actor) && COMBAT.hasBowAmmoForCombat(actor)) {
          COMBAT.doBowHit(state, actor, target, def.name);
          break;
        }
        const sc = COMBAT.atkScale(actor, "attack", 1.4, 0);
        COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        break;
      }
      case "magifireblade": {
        const sc = COMBAT.atkScale(actor, "magifireblade", 2.0, 2.8);
        COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        break;
      }
      case "guard":
        actor.guard = true;
        actor.guardDR = 0.8 + COMBAT.effectBonus(actor, "guard") / 100;
        COMBAT.pushLog(
          state,
          '<span class="log-buff">🛡️ ' + actor.name + " ตั้งเกราะเวทมนตร์ (ลดดาเมจ " + Math.round(actor.guardDR * 100) + "%)</span>"
        );
        break;
      case "heal": {
        const k = COMBAT.rankCoeff(COMBAT.rankOf(actor, "heal"));
        const h = COMBAT.healUnit(actor, 3.0 * k * actor.matk);
        COMBAT.pushLog(
          state,
          '<span class="log-heal">✨ ' + actor.name + " ร่ายคาถารักษา ฟื้นฟู +" + h + " HP</span>"
        );
        if (h > 0) COMBAT.emitFx(state, { kind: "heal", side: actor.side, amount: h, source: "heal" });
        break;
      }
      case "stab": {
        const sc = COMBAT.atkScale(actor, "stab", 0.9, 0);
        const res = COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        if (res.hit && !state.over) {
          const agi = (actor.totalPts && actor.totalPts.agi) || 0;
          const chance = 50 + 0.5 * agi;
          if (state.rng.chance(chance) && COMBAT.rollStatus(target, state.rng)) {
            const pot = (0.2 + 0.004 * agi) * actor.matk;
            COMBAT.applyPoison(state, target, pot, 4, def.name);
          } else if (state.rng && chance) {
            /* resist or fail already consumed a roll above; message only if we rolled chance but resist */
          }
        }
        break;
      }
      case "shadowkill": {
        if (!COMBAT.rollConnect(actor, target, state.rng, { atkRatio: 1, matkRatio: 0, surround: COMBAT.surroundCount(state) }).hit) {
          COMBAT.pushLog(
            state,
            '<span class="log-miss">💨 ' + actor.name + " ใช้ " + def.name + " — หลบหลีก!</span>"
          );
          COMBAT.emitFx(state, { kind: "miss", side: target.side });
          if (target.counter) {
            const hpH = COMBAT.healUnit(target, 2.0 * target.matk);
            const mpH = COMBAT.restoreMp(target, 0.1 * target.matk);
            target.counter = false;
            COMBAT.pushLog(
              state,
              '<span class="log-heal">🗡️ ' +
                target.name +
                " หลบได้ขณะตั้งท่าสวนกลับ! ฟื้นฟู HP +" +
                hpH +
                " MP +" +
                mpH +
                "</span>"
            );
            if (hpH > 0) COMBAT.emitFx(state, { kind: "heal", side: target.side, amount: hpH, source: "counter-dodge" });
          }
        } else if (COMBAT.rollStatus(target, state.rng)) {
          const intp = (actor.totalPts && actor.totalPts.int) || 0;
          let pot = (0.7 + 0.01 * intp) * actor.matk;
          if (COMBAT.hasPoison(target)) pot *= 2;
          COMBAT.applyPoison(state, target, pot, 3, def.name);
        } else {
          COMBAT.pushLog(
            state,
            '<span class="log-buff">' + target.name + " ต้านทานพิษจากสังหารไร้เงา</span>"
          );
        }
        break;
      }
      case "veil": {
        const agi = (actor.totalPts && actor.totalPts.agi) || 0;
        const vit = (actor.totalPts && actor.totalPts.vit) || 0;
        actor.veilTurns = 3;
        actor.veilDodge = 30 + 0.5 * agi + COMBAT.effectBonus(actor, "veil");
        actor.veilHealPct = 60 + 1 * vit + COMBAT.effectBonus(actor, "veil");
        COMBAT.pushLog(
          state,
          '<span class="log-buff">🌑 ' +
            actor.name +
            " เข้าเงาพราง (หลบ +" +
            actor.veilDodge.toFixed(1) +
            "% ฮีล " +
            actor.veilHealPct.toFixed(1) +
            "% MATK/เทิร์น ×3)</span>"
        );
        break;
      }
      case "counter":
        actor.counter = true;
        actor.counterDR = 0.6 + COMBAT.effectBonus(actor, "counter") / 100;
        COMBAT.pushLog(
          state,
          '<span class="log-buff">🗡️ ' + actor.name + " ตั้งท่าสวนกลับฉับพลัน (ลดดาเมจ " + Math.round(actor.counterDR * 100) + "%)</span>"
        );
        break;
      case "arrowshot": {
        const sc = COMBAT.atkScale(actor, "arrowshot", 1.0, 0);
        const res = COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        if (res.hit && !state.over) {
          const dex = (actor.totalPts && actor.totalPts.dex) || 0;
          const chance = 20 + 2 * dex;
          if (state.rng.chance(chance) && COMBAT.rollStatus(target, state.rng)) {
            target.weakenTurns = 3;
            COMBAT.pushLog(
              state,
              '<span class="log-buff">⬇️ ' + target.name + " ติดสถานะอ่อนแอ (−20% ดาเมจ) นาน 3 เทิร์น</span>"
            );
          }
        }
        break;
      }
      case "powershot": {
        const sc = COMBAT.atkScale(actor, "powershot", 2.8, 0);
        COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        break;
      }
      case "focus": {
        const dex = (actor.totalPts && actor.totalPts.dex) || 0;
        const agi = (actor.totalPts && actor.totalPts.agi) || 0;
        const luk = (actor.totalPts && actor.totalPts.luk) || 0;
        actor.focusTurns = 4;
        actor.focusAcc = 20 + 0.3 * dex + COMBAT.effectBonus(actor, "focus");
        actor.focusAtk = 30 + 1 * dex;
        actor.focusAspeed = 3 + 0.05 * agi;
        actor.focusCrit = 25 + 0.34 * luk + COMBAT.effectBonus(actor, "focus");
        COMBAT.pushLog(
          state,
          '<span class="log-buff">🎯 ' +
            actor.name +
            " เพ่งสมาธิ! แม่น +" +
            actor.focusAcc.toFixed(1) +
            "% ATK +" +
            actor.focusAtk.toFixed(1) +
            " A.speed +" +
            actor.focusAspeed.toFixed(2) +
            " คริ +" +
            actor.focusCrit.toFixed(1) +
            "% นาน 4 เทิร์น</span>"
        );
        break;
      }
      case "soularrow": {
        const sc = COMBAT.atkScale(actor, "soularrow", 1.5, 2.5);
        const res = COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        if (res.hit && res.damage > 0) {
          const h = COMBAT.healUnit(actor, res.damage * 0.35);
          COMBAT.pushLog(
            state,
            '<span class="log-heal">🏹 ลูกศรดูดวิญญาณฟื้นฟู ' + actor.name + " +" + h + " HP</span>"
          );
          if (h > 0) COMBAT.emitFx(state, { kind: "heal", side: actor.side, amount: h, source: "lifesteal" });
        }
        break;
      }
      case "blade_storm": {
        const sc = COMBAT.atkScale(actor, "blade_storm", 1.8, 0);
        COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        if (!state.over) COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        break;
      }
      case "sanctuary": {
        const k = COMBAT.rankCoeff(COMBAT.rankOf(actor, "sanctuary"));
        const h = COMBAT.healUnit(actor, 2.0 * k * actor.matk);
        actor.sanctuary = true;
        actor.sanctuaryDR = 0.4 + COMBAT.effectBonus(actor, "sanctuary") / 100;
        COMBAT.pushLog(
          state,
          '<span class="log-heal">✨ ' + actor.name + " วงก์บุญ ฟื้นฟู +" + h + " HP และลดดาเมจ " + Math.round(actor.sanctuaryDR * 100) + "% (1 ครั้ง)</span>"
        );
        if (h > 0) COMBAT.emitFx(state, { kind: "heal", side: actor.side, amount: h, source: "sanctuary" });
        break;
      }
      case "nightfall": {
        const sc = COMBAT.atkScale(actor, "nightfall", 1.6, 0);
        const res = COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        if (res.hit && !state.over && COMBAT.rollStatus(target, state.rng)) {
          COMBAT.applyPoison(state, target, 0.4 * actor.matk, 3, def.name);
        }
        break;
      }
      case "phantom": {
        actor.phantomTurns = 2;
        actor.phantomDodge = 20 + COMBAT.effectBonus(actor, "phantom");
        actor.nextAtkBonus = 0.8 * COMBAT.rankCoeff(COMBAT.rankOf(actor, "phantom"));
        COMBAT.pushLog(
          state,
          '<span class="log-buff">👻 ' + actor.name + " เข้าภาพผี หลบ +" + actor.phantomDodge.toFixed(1) + "% นาน 2 เทิร์น และโจมตีครั้งถัดไป +" + Math.round(actor.nextAtkBonus * 100) + "% ATK</span>"
        );
        break;
      }
      case "rain": {
        const sc = COMBAT.atkScale(actor, "rain", 0.9, 0);
        COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        if (!state.over) COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        if (!state.over) COMBAT.doHitAttack(state, actor, target, def.name, sc.atk, sc.matk);
        break;
      }
      case "mark": {
        actor.markTurns = 4;
        actor.markCrit = 15 + COMBAT.effectBonus(actor, "mark");
        actor.markAcc = 20 + COMBAT.effectBonus(actor, "mark");
        COMBAT.pushLog(
          state,
          '<span class="log-buff">🦅 ' + actor.name + " ประทับเหยี่ยว คริ +" + actor.markCrit.toFixed(1) + "% แม่น +" + actor.markAcc.toFixed(1) + " นาน 4 เทิร์น</span>"
        );
        break;
      }
      case "double_strafe": {
        const lv = COMBAT.rankOf(actor, "double_strafe");
        const bow = COMBAT.unitBowAtk(actor, { variance: "roll", rng: state && state.rng });
        if (!bow.ok) return { ok: false, reason: bow.reason || "no-bow" };
        COMBAT.doBowHit(state, actor, target, def.name, { skill: true, atk: bow.atk, skillMod: STATS.doubleStrafeMod(lv) });
        break;
      }
      case "arrow_shower": {
        const lv = COMBAT.rankOf(actor, "arrow_shower");
        const bow = COMBAT.unitBowAtk(actor, { variance: "roll", rng: state && state.rng });
        if (!bow.ok) return { ok: false, reason: bow.reason || "no-bow" };
        const res = COMBAT.doBowHit(state, actor, target, def.name, { skill: true, atk: bow.atk, skillMod: STATS.arrowShowerMod(lv) });
        if (res && res.hit) COMBAT.knockbackTiles(target, actor, 2);
        break;
      }
      case "arrow_repel": {
        const bow = COMBAT.unitBowAtk(actor, { variance: "roll", rng: state && state.rng });
        if (!bow.ok) return { ok: false, reason: bow.reason || "no-bow" };
        const res = COMBAT.doBowHit(state, actor, target, def.name, { skill: true, atk: bow.atk, skillMod: STATS.arrowRepelMod(COMBAT.rankOf(actor, "arrow_repel")) });
        if (res && res.hit) COMBAT.knockbackTiles(target, actor, 6);
        break;
      }
      case "owl_eye":
      case "vulture_eye":
        COMBAT.pushLog(state, '<span class="log-buff">' + actor.name + " ใช้ " + def.name + " (ติดตัว)</span>");
        break;
      case "improve_concentration": {
        const lv = COMBAT.rankOf(actor, "improve_concentration");
        actor.concPct = STATS.improveConcentrationPct(lv);
        actor.concSec = STATS.improveConcentrationDuration(lv);
        actor.concTurns = actor.concSec;
        const owl = STATS.owlEyeDex(actor.skillRanks && actor.skillRanks.owl_eye);
        const baseDex = ((actor.allocated && actor.allocated.dex) || 0) + ((actor.eqPts && actor.eqPts.dex) || 0) + owl;
        const baseAgi = ((actor.allocated && actor.allocated.agi) || 0) + ((actor.eqPts && actor.eqPts.agi) || 0);
        actor.concDex = Math.floor(baseDex * actor.concPct);
        actor.concAgi = Math.floor(baseAgi * actor.concPct);
        actor.concReveal = 3;
        COMBAT.pushLog(
          state,
          '<span class="log-buff">🎯 ' + actor.name + " Improve Concentration DEX/AGI +" + Math.round(actor.concPct * 100) + "% นาน " + actor.concSec + "s</span>"
        );
        break;
      }
      case "sword_mastery":
      case "twohand_mastery":
      case "increase_hp_recovery":
      case "double_attack":
      case "improve_dodge":
        COMBAT.pushLog(state, '<span class="log-buff">' + actor.name + " ใช้ " + def.name + " (ติดตัว)</span>");
        break;
      case "bash": {
        const lv = COMBAT.rankOf(actor, "bash");
        COMBAT.doHitAttack(state, actor, target, def.name, STATS.bashMod(lv), 0);
        break;
      }
      case "magnum_break": {
        const lv = COMBAT.rankOf(actor, "magnum_break");
        const res = COMBAT.doHitAttack(state, actor, target, def.name, STATS.magnumBreakMod(lv), 0);
        actor.magnumFireUntil = COMBAT.nowMs() + 10000;
        actor.magnumFireAtk = 0.20;
        if (res && res.hit) COMBAT.knockbackTiles(target, actor, 2);
        COMBAT.pushLog(state, '<span class="log-buff">🔥 ' + actor.name + " แมกนัมเบรก — โจมตีกายภาพ +20% นาน 10s</span>");
        break;
      }
      case "provoke": {
        const lv = COMBAT.rankOf(actor, "provoke");
        const dex = (actor.totalPts && actor.totalPts.dex) || actor.dex || 0;
        const luk = (actor.totalPts && actor.totalPts.luk) || actor.luk || 0;
        const rate = STATS.provokeSuccess(lv, dex, luk);
        if (state.rng && state.rng.chance(rate)) {
          target.provokedUntil = COMBAT.nowMs() + 30000;
          target.provokeDefMul = 1 - STATS.provokeDefReduce(lv);
          target.provokeAtkMul = 1 + STATS.provokeAtkBonus(lv);
          COMBAT.pushLog(
            state,
            '<span class="log-buff">💢 ' + actor.name + " ยั่วยุสำเร็จ DEF −" +
              Math.round(STATS.provokeDefReduce(lv) * 100) + "% ATK +" +
              Math.round(STATS.provokeAtkBonus(lv) * 100) + "%</span>"
          );
        } else {
          COMBAT.toastOrLog(state, "ยั่วยัง");
        }
        break;
      }
      case "endure": {
        const lv = COMBAT.rankOf(actor, "endure");
        actor.endureUntil = COMBAT.nowMs() + 10000;
        actor.endureHits = 7;
        actor.endureMdef = STATS.endureMdef(lv);
        COMBAT.pushLog(state, '<span class="log-buff">🛡️ ' + actor.name + " เอนเดอร์ MDEF +" + actor.endureMdef + " ทน 7 ฮิต นาน 10s</span>");
        break;
      }
      case "steal": {
        if (target.isHero || target.isBoss || !target.isMonster) {
          COMBAT.toastOrLog(state, "ขโมยไม่สำเร็จ");
          break;
        }
        const lv = COMBAT.rankOf(actor, "steal");
        const dex = (actor.totalPts && actor.totalPts.dex) || actor.dex || 0;
        const rate = STATS.stealSuccess(lv, dex);
        if (!(state.rng && state.rng.chance(rate))) {
          COMBAT.toastOrLog(state, "ขโมยไม่สำเร็จ");
          break;
        }
        const save = state.save;
        const mobId = target.heroId || target.monsterId;
        const mob = (DATA.findMonster && DATA.findMonster(mobId)) || null;
        let stole = "";
        if (mob && mob.drops && mob.drops.length && save && root.PVE) {
          const pick = mob.drops[Math.floor(state.rng.next() * mob.drops.length)];
          if (pick && pick.id) {
            const kind = pick.kind || "potion";
            if (kind === "material") {
              save.materials = save.materials || {};
              save.materials[pick.id] = (save.materials[pick.id] || 0) + 1;
            } else if (kind === "item") {
              save.owned = save.owned || {};
              save.owned[pick.id] = true;
            } else {
              save.potions = save.potions || {};
              save.potions[pick.id] = (save.potions[pick.id] || 0) + 1;
            }
            stole = (DATA.lootName && DATA.lootName(pick.id)) || pick.id;
          }
        }
        if (!stole) {
          const z = Math.max(1, Math.floor(Number(target.level) || (mob && mob.level) || 1));
          if (save) save.zeno = (save.zeno || 0) + z;
          stole = z + " Zeno";
        }
        COMBAT.toastOrLog(state, "ขโมยสำเร็จ");
        COMBAT.pushLog(state, '<span class="log-heal">🖐️ ' + actor.name + " ขโมย " + stole + "</span>");
        break;
      }
      case "hiding":
        actor.hidden = true;
        actor.hidingUntil = 0;
        actor._hideAcc = 0;
        COMBAT.pushLog(state, '<span class="log-buff">👤 ' + actor.name + " ซ่อนตัว</span>");
        break;
      case "envenom": {
        const lv = COMBAT.rankOf(actor, "envenom");
        const atk = COMBAT.effectiveAtk(actor) || 0;
        const bonus = STATS.envenomBonus(lv);
        const mod = atk > 0 ? (atk + bonus) / atk : 1;
        const res = COMBAT.doHitAttack(state, actor, target, def.name, mod, 0);
        if (res && res.hit && !state.over) {
          const pch = STATS.envenomPoisonChance(lv) * 100;
          if (state.rng && state.rng.chance(pch) && COMBAT.rollStatus(target, state.rng)) {
            COMBAT.applyPoison(state, target, 0.2 * actor.matk, 3, def.name);
          }
        }
        break;
      }
      case "detoxify":
        actor.poisons = [];
        COMBAT.pushLog(state, '<span class="log-heal">✨ ' + actor.name + " ถอนพิษ</span>");
        break;
      default:
        return { ok: false, reason: "unhandled" };
    }
    return { ok: true };
  };

  /* ---------- boss skills ---------- */
  COMBAT.ultimateReady = function (unit, skillDef) {
    if (!COMBAT.skillReady(unit, skillDef.id, skillDef)) return false;
    if (skillDef.hpPct != null && unit.hp >= unit.maxHp * skillDef.hpPct) return false;
    if (skillDef.hpFlat != null && unit.hp >= skillDef.hpFlat) return false;
    return true;
  };

  COMBAT.bossSkill = function (state, actor, skillId) {
    const def = DATA.BOSS_SKILLS[skillId];
    if (!def) return { ok: false };
    if (!COMBAT.skillReady(actor, skillId, def)) return { ok: false, reason: "not-ready" };
    const target = COMBAT.opponentOf(state, actor);
    COMBAT.spendAndCd(actor, def);
    COMBAT.emitFx(state, { kind: "act", side: actor.side, skillId: skillId, anim: COMBAT.skillAnimKind(skillId, def) });

    switch (skillId) {
      case "m_basic":
        COMBAT.doHitAttack(state, actor, target, def.name, 1.5, 0);
        break;
      case "m_power":
        COMBAT.doHitAttack(state, actor, target, def.name, 3.0, 2.0);
        break;
      case "m_dragon":
        actor.dragonStacks += 1;
        COMBAT.pushLog(
          state,
          '<span class="log-buff">🐲 ' +
            actor.name +
            " ใช้ลมปราณมังกร! คริถาวร +45% ตัวคูณคริ +50% (ซ้อน " +
            actor.dragonStacks +
            ")</span>"
        );
        break;
      case "m_silence": {
        const guarded = !!target.guard;
        if (guarded) {
          target.guard = false;
          const luk = (target.totalPts && target.totalPts.luk) || 0;
          target.guardCritPending = 25 + luk * 1;
          COMBAT.spendSilenceBlocked(state, actor, target, def.name, "เกราะเวทมนตร์บล็อกคาถาสะกดทั้งหมด");
          break;
        }
        const silConn = COMBAT.rollConnect(actor, target, state.rng, { atkRatio: 2.0, matkRatio: 0, vsSilence: true, surround: COMBAT.surroundCount(state) });
        if (!silConn.hit) {
          COMBAT.pushLog(
            state,
            '<span class="log-miss">💨 ' + target.name + " หลบคาถาสะกดได้!</span>"
          );
          COMBAT.emitFx(state, { kind: "miss", side: target.side, pd: !!silConn.pd });
          if (target.counter) {
            const hpH = COMBAT.healUnit(target, 2.0 * target.matk);
            const mpH = COMBAT.restoreMp(target, 0.1 * target.matk);
            target.counter = false;
            COMBAT.pushLog(
              state,
              '<span class="log-heal">🗡️ ' +
                target.name +
                " หลบได้ขณะตั้งท่าสวนกลับ! ฟื้นฟู HP +" +
                hpH +
                " MP +" +
                mpH +
                "</span>"
            );
            if (hpH > 0) COMBAT.emitFx(state, { kind: "heal", side: target.side, amount: hpH, source: "counter-dodge" });
          }
          break;
        }
        if (!COMBAT.rollStatus(target, state.rng)) {
          COMBAT.pushLog(
            state,
            '<span class="log-buff">' + target.name + " ต้านทานคาถาสะกด!</span>"
          );
          break;
        }
        const res = COMBAT.doHitAttack(state, actor, target, def.name, 2.0, 0, { skipHitCheck: true, forceCrit: silConn.crit, canCrit: false });
        if (res.hit && !state.over) {
          target.atb = 0;
          COMBAT.pushLog(
            state,
            '<span class="log-buff">🔇 คาถาสะกดรีเซ็ตเกจ A.speed ของ ' + target.name + " เป็น 0</span>"
          );
        }
        break;
      }
      case "g_basic": {
        const res = COMBAT.doHitAttack(state, actor, target, def.name, 1.2, 0);
        if (res.hit && state.rng.chance(50)) {
          const h = COMBAT.healUnit(actor, 0.6 * COMBAT.effectiveAtk(actor));
          COMBAT.pushLog(
            state,
            '<span class="log-heal">🗿 ' + actor.name + " ฟื้นฟูตัวเอง +" + h + " HP</span>"
          );
          if (h > 0) COMBAT.emitFx(state, { kind: "heal", side: actor.side, amount: h, source: "lifesteal" });
        }
        break;
      }
      case "g_power":
        COMBAT.doHitAttack(state, actor, target, def.name, 2.5, 0);
        break;
      case "g_landslide":
        COMBAT.doHitAttack(state, actor, target, def.name, 6.0, 0);
        break;
      case "g_shield":
        actor.stoneShield = true;
        actor.stoneShieldTurns = 1;
        COMBAT.pushLog(
          state,
          '<span class="log-buff">🪨 ' + actor.name + " กางโล่หินผา (บล็อก 1 ครั้ง / ไม่เกิน 1 เทิร์น)</span>"
        );
        break;
      case "w_basic": {
        const res = COMBAT.doHitAttack(state, actor, target, def.name, 1.8, 0);
        if (res.hit && !state.over && state.rng.chance(60) && COMBAT.rollStatus(target, state.rng)) {
          COMBAT.applyPoison(state, target, 0.3 * actor.matk, 3, def.name);
        }
        break;
      }
      case "w_claw": {
        const bonus = COMBAT.hasPoison(target) ? 50 : 0;
        COMBAT.doHitAttack(state, actor, target, def.name, 2.6, 0, { bonusCrit: bonus });
        break;
      }
      case "w_fog":
        actor.fogTurns = 3;
        actor.fogDodge = 50;
        COMBAT.pushLog(
          state,
          '<span class="log-buff">🌫️ ' + actor.name + " ใช้ขนขาวสายหมอก หลบหลีก +50% นาน 3 เทิร์น</span>"
        );
        break;
      case "w_fang": {
        const bonus = COMBAT.hasPoison(target) ? 70 : 0;
        COMBAT.doHitAttack(state, actor, target, def.name, 1.7, 2.8, { bonusCrit: bonus });
        break;
      }
      case "k_basic": {
        const res = COMBAT.doHitAttack(state, actor, target, def.name, 1.7, 0);
        if (res.hit && !state.over && state.rng.chance(40) && COMBAT.rollStatus(target, state.rng)) {
          COMBAT.applyPoison(state, target, 0.25 * actor.matk, 3, def.name);
        }
        break;
      }
      case "k_thunder":
        COMBAT.doHitAttack(state, actor, target, def.name, 3.0, 1.5);
        break;
      case "k_rage":
        actor.rageTurns = 4;
        actor.rageAtk = 40;
        actor.rageCrit = 15;
        COMBAT.pushLog(
          state,
          '<span class="log-buff">💢 ' + actor.name + " โกรธเกรี้ยว! ATK +40 คริ +15% นาน 4 เทิร์น</span>"
        );
        break;
      case "k_death":
        COMBAT.doHitAttack(state, actor, target, def.name, 4.0, 2.0);
        break;
      case "d_basic": {
        const res = COMBAT.doHitAttack(state, actor, target, def.name, 1.8, 0);
        if (res.hit && !state.over && state.rng.chance(50) && COMBAT.rollStatus(target, state.rng)) {
          COMBAT.applyPoison(state, target, 0.3 * actor.matk, 3, def.name);
        }
        break;
      }
      case "d_hellfire": {
        const res = COMBAT.doHitAttack(state, actor, target, def.name, 2.8, 2.2);
        if (res.hit && res.damage > 0) {
          const h = COMBAT.healUnit(actor, res.damage * 0.3);
          COMBAT.pushLog(
            state,
            '<span class="log-heal">' + 'เปลวเพลิงนรกดูดพลังชีวิต +' + h + ' HP</span>'
          );
          if (h > 0) COMBAT.emitFx(state, { kind: "heal", side: actor.side, amount: h, source: "lifesteal" });
        }
        break;
      }
      case "d_curse":
        actor.curseTurns = 4;
        actor.curseAtk = 50;
        actor.curseCrit = 20;
        actor.curseCritMult = 10;
        COMBAT.pushLog(
          state,
          '<span class="log-buff">☠️ ' +
            actor.name +
            " สาปมรณะ! ATK +50 คริ +20% ตัวคูณคริ +10% นาน 4 เทิร์น</span>"
        );
        break;
      case "d_apocalypse":
        COMBAT.doHitAttack(state, actor, target, def.name, 5.0, 3.0);
        break;
      case "a_basic": {
        const hadGuard = !!target.guard;
        const res = COMBAT.doHitAttack(state, actor, target, def.name, 2.0, 0);
        if (res.hit && !state.over && state.rng.chance(40)) {
          if (hadGuard) {
            COMBAT.spendSilenceBlocked(state, actor, target, def.name, "เกราะเวทมนตร์บล็อกการรีเซ็ตเกจจากปีกปกรรมณ์");
          } else if (!COMBAT.rollConnect(actor, target, state.rng, { atkRatio: 1, matkRatio: 0, vsSilence: true, surround: COMBAT.surroundCount(state) }).hit) {
            COMBAT.pushLog(state, '<span class="log-miss">💨 ' + target.name + " หลบการสะกดจากปีกปกรรมณ์!</span>");
            COMBAT.emitFx(state, { kind: "miss", side: target.side });
          } else if (!COMBAT.rollStatus(target, state.rng)) {
            COMBAT.pushLog(state, '<span class="log-buff">' + target.name + " ต้านทานการรีเซ็ตเกจจากปีกปกรรมณ์!</span>");
          } else {
            target.atb = 0;
            COMBAT.pushLog(state, '<span class="log-buff">🔇 ปีกปกรรมณ์รีเซ็ตเกจ A.speed ของ ' + target.name + " เป็น 0</span>");
          }
        }
        break;
      }
      case "a_storm": {
        const res = COMBAT.doHitAttack(state, actor, target, def.name, 2.6, 2.6);
        if (res.hit && res.damage > 0) {
          const h = COMBAT.healUnit(actor, res.damage * 0.25);
          COMBAT.pushLog(state, '<span class="log-heal">พรหพยุคะดูดพลังชีวิต +' + h + " HP</span>");
          if (h > 0) COMBAT.emitFx(state, { kind: "heal", side: actor.side, amount: h, source: "lifesteal" });
        }
        break;
      }
      case "a_veil":
        actor.angelVeilTurns = 3;
        actor.angelDodge = 25;
        actor.angelCrit = 20;
        COMBAT.pushLog(state, '<span class="log-buff">🪽 ' + actor.name + " ปกปกาศ! หลบ +25% คริ +20% นาน 3 เทิร์น</span>");
        break;
      case "a_ult":
        COMBAT.doHitAttack(state, actor, target, def.name, 4.5, 3.5);
        break;
      case "dr_basic": {
        const res = COMBAT.doHitAttack(state, actor, target, def.name, 2.2, 0);
        if (res.hit && !state.over && state.rng.chance(50) && COMBAT.rollStatus(target, state.rng)) {
          COMBAT.applyPoison(state, target, 0.4 * actor.matk, 3, def.name);
        }
        break;
      }
      case "dr_ruin": {
        const res = COMBAT.doHitAttack(state, actor, target, def.name, 3.0, 2.8);
        if (res.hit && !state.over && COMBAT.rollStatus(target, state.rng)) {
          target.weakenTurns = 3;
          COMBAT.pushLog(state, '<span class="log-buff">⬇️ ' + target.name + " ติดสถานะอ่อนแอ (−20% ดาเมจ) นาน 3 เทิร์น</span>");
        }
        break;
      }
      case "dr_wrath":
        actor.wrathTurns = 4;
        actor.wrathAtk = 60;
        actor.wrathCrit = 25;
        actor.wrathCritMult = 15;
        COMBAT.pushLog(state, '<span class="log-buff">🔥 ' + actor.name + " เกร็กวินาศ! ATK +60 คริ +25% ตัวคูณคริ +15% นาน 4 เทิร์น</span>");
        break;
      case "dr_ult":
        COMBAT.doHitAttack(state, actor, target, def.name, 5.5, 4.0);
        break;
      default:
        if (def && (def.atkRatio || def.matkRatio)) {
          const res = COMBAT.doHitAttack(state, actor, target, def.name, def.atkRatio || 0, def.matkRatio || 0);
          if (res && res.hit && !state.over && def.poison) {
            COMBAT.applyPoison(state, target, def.poison * actor.matk, def.poisonTurns || 3, def.name);
          }
          break;
        }
        return { ok: false };
    }
    return { ok: true };
  };

  COMBAT.spendSilenceBlocked = function (state, actor, target, skillName, reason) {
    COMBAT.pushLog(state, '<span class="log-buff">🛡️ ' + reason + "</span>");
  };

  /**
   * Boss AI: prefer ultimate when HP condition + CD/MP allow,
   * else a ready special, else basic. Never idle if a legal action exists.
   */
  COMBAT.chooseBossSkill = function (unit) {
    const defs = unit.skills.map(function (id) {
      return DATA.BOSS_SKILLS[id];
    });
    const ult = defs.find(function (d) {
      return d && d.kind === "ultimate" && COMBAT.ultimateReady(unit, d);
    });
    if (ult) return ult.id;
    const specials = defs.filter(function (d) {
      return d && d.kind === "special" && COMBAT.skillReady(unit, d.id, d);
    });
    if (specials.length) return specials[0].id;
    const basic = defs.find(function (d) {
      return d && d.kind === "basic" && COMBAT.skillReady(unit, d.id, d);
    });
    if (basic) return basic.id;
    const any = defs.find(function (d) {
      return d && COMBAT.skillReady(unit, d.id, d);
    });
    return any ? any.id : null;
  };

  COMBAT.executeSkill = function (state, actor, skillId) {
    if (state.over) return { ok: false };
    if (actor.isBoss) return COMBAT.bossSkill(state, actor, skillId);
    return COMBAT.heroSkill(state, actor, skillId);
  };

  COMBAT.chooseHeroAutoSkill = function (unit) {
    if (!unit || !unit.skills) return null;
    const hpPct = unit.maxHp ? unit.hp / unit.maxHp : 1;
    if (hpPct < (DATA.AUTO_HEAL_SKILL_HP || 0.35)) {
      const heal = unit.skills.find(function (sid) {
        const def = DATA.SKILLS[sid];
        return def && (sid === "heal" || sid === "sanctuary") && COMBAT.skillReady(unit, sid, def);
      });
      if (heal) return heal;
    }
    const basic = unit.skills.find(function (sid) {
      const def = DATA.SKILLS[sid];
      return def && def.type === "attack" && (def.cd || 0) === 0 && (def.mp || 0) === 0 && COMBAT.skillReady(unit, sid, def);
    });
    if (basic) return basic;
    const dmg = unit.skills.find(function (sid) {
      const def = DATA.SKILLS[sid];
      return def && def.type === "attack" && COMBAT.skillReady(unit, sid, def);
    });
    if (dmg) return dmg;
    const any = unit.skills.find(function (sid) {
      const def = DATA.SKILLS[sid];
      return def && COMBAT.skillReady(unit, sid, def);
    });
    return any || null;
  };

  COMBAT.autoAct = function (state, actor) {
    if (actor.isBoss) {
      const id = COMBAT.chooseBossSkill(actor);
      if (id) COMBAT.executeSkill(state, actor, id);
      else COMBAT.pushLog(state, '<span class="log-system">' + actor.name + " ไม่มีท่าที่ใช้ได้</span>");
      return;
    }
    const id = COMBAT.chooseHeroAutoSkill(actor) || actor.skills.find(function (sid) {
      const def = DATA.SKILLS[sid];
      return def && COMBAT.skillReady(actor, sid, def);
    });
    if (id) COMBAT.executeSkill(state, actor, id);
  };

  /* ---------- ATB tick ---------- */
  COMBAT.tickAtb = function (state) {
    if (state.over || state.waitingAction) return null;
    const units = [state.left, state.right].filter(function (u) {
      return u.hp > 0;
    });
    units.forEach(function (u) {
      u.atb += COMBAT.effectiveAspeed(u);
    });
    let ready = units.filter(function (u) {
      return u.atb >= DATA.SPEED_MAX;
    });
    if (!ready.length) return null;
    ready.sort(function (a, b) {
      return b.atb - a.atb;
    });
    const actor = ready[0];
    actor.atb -= DATA.SPEED_MAX;
    if (actor.atb < 0) actor.atb = 0;
    const began = COMBAT.beginTurn(state, actor);
    if (began.dead || state.over) return { actor: actor, dead: true };
    state.waitingAction = actor.side;
    return { actor: actor, dead: false };
  };

  COMBAT.resetTemps = function (unit) {
    unit.atb = 0;
    unit.cds = {};
    unit.poisons = [];
    unit.weakenTurns = 0;
    unit.guard = false;
    unit.guardCritPending = 0;
    unit.counter = false;
    unit.veilTurns = 0;
    unit.veilDodge = 0;
    unit.veilHealPct = 0;
    unit.focusTurns = 0;
    unit.focusAcc = 0;
    unit.focusAtk = 0;
    unit.focusAspeed = 0;
    unit.focusCrit = 0;
    unit.stoneShield = false;
    unit.stoneShieldTurns = 0;
    unit.fogTurns = 0;
    unit.fogDodge = 0;
    unit.rageTurns = 0;
    unit.rageAtk = 0;
    unit.rageCrit = 0;
    unit.curseTurns = 0;
    unit.curseAtk = 0;
    unit.curseCrit = 0;
    unit.curseCritMult = 0;
    unit.dragonStacks = 0;
    unit.guardDR = 0.8;
    unit.sanctuary = false;
    unit.sanctuaryDR = 0.4;
    unit.counterDR = 0.6;
    unit.nextAtkBonus = 0;
    unit.phantomTurns = 0;
    unit.phantomDodge = 0;
    unit.markTurns = 0;
    unit.markCrit = 0;
    unit.markAcc = 0;
    unit.angelVeilTurns = 0;
    unit.angelDodge = 0;
    unit.angelCrit = 0;
    unit.wrathTurns = 0;
    unit.wrathAtk = 0;
    unit.wrathCrit = 0;
    unit.wrathCritMult = 0;
    unit.magnumFireUntil = 0;
    unit.magnumFireAtk = 0;
    unit.provokedUntil = 0;
    unit.provokeDefMul = 1;
    unit.provokeAtkMul = 1;
    unit.endureUntil = 0;
    unit.endureHits = 0;
    unit.endureMdef = 0;
    unit.hidden = false;
    unit.hidingUntil = 0;
    unit._hideAcc = 0;
  };

  /* ---------- serialize for PvP state codes ---------- */
  COMBAT.serializeUnit = function (u) {
    const copy = {};
    Object.keys(u).forEach(function (k) {
      const v = u[k];
      if (typeof v === "function") return;
      copy[k] = v;
    });
    return copy;
  };

  COMBAT.serializeState = function (state) {
    return {
      v: 1,
      left: COMBAT.serializeUnit(state.left),
      right: COMBAT.serializeUnit(state.right),
      seed: state.rng.getSeed(),
      log: state.log.slice(-40),
      turnCount: state.turnCount,
      waitingAction: state.waitingAction,
      over: state.over,
      winner: state.winner,
      mode: state.mode,
      fx: (state.fxQueue || state.fx || []).slice(),
    };
  };

  COMBAT.deserializeState = function (obj) {
    const state = {
      left: obj.left,
      right: obj.right,
      rng: COMBAT.createRng(obj.seed || 1),
      log: obj.log || [],
      turnCount: obj.turnCount || 0,
      waitingAction: obj.waitingAction,
      over: !!obj.over,
      winner: obj.winner || null,
      mode: obj.mode || "pvp",
      fx: obj.fx || [],
      fxQueue: [],
    };
    return state;
  };


  /* ---------- real-time helpers (ASPD / CDs in ms) ---------- */
  /**
   * Auto-attack interval.
   * Heroes (locked ASPD): 1000 / Final ASPD. Cap 7 → ~143ms.
   * Bosses/monsters without AGI/DEX: legacy clamp(380, 2000, round(1600 - aspeed * 22)).
   */
  COMBAT.TURN_MS = 1600;
  COMBAT.GLOBAL_CD_MS = 300;
  COMBAT.ASPD_BASE_MS = 1600;
  COMBAT.ASPD_PER = 22;
  COMBAT.ASPD_MIN_MS = 380;
  COMBAT.ASPD_MAX_MS = 2000;

  COMBAT.legacyAttackIntervalMs = function (aspeed) {
    aspeed = Number(aspeed);
    if (!(aspeed > 0)) aspeed = DATA.HERO_SPEED || 25;
    const raw = Math.round(COMBAT.ASPD_BASE_MS - aspeed * COMBAT.ASPD_PER);
    if (raw < COMBAT.ASPD_MIN_MS) return COMBAT.ASPD_MIN_MS;
    if (raw > COMBAT.ASPD_MAX_MS) return COMBAT.ASPD_MAX_MS;
    return raw;
  };

  COMBAT.attackIntervalMs = function (aspeedOrUnit) {
    if (aspeedOrUnit && typeof aspeedOrUnit === "object") {
      const rate = COMBAT.effectiveAspeed(aspeedOrUnit);
      if (aspeedOrUnit.aspd != null || aspeedOrUnit.finalAspd != null || aspeedOrUnit.isHero) {
        if (!(rate > 0)) return COMBAT.ASPD_MAX_MS;
        return Math.max(1, Math.round(1000 / rate));
      }
      return COMBAT.legacyAttackIntervalMs(rate);
    }
    return COMBAT.legacyAttackIntervalMs(Number(aspeedOrUnit));
  };

  COMBAT.cdMs = function (cdTurns) {
    cdTurns = Number(cdTurns) || 0;
    if (cdTurns <= 0) return COMBAT.GLOBAL_CD_MS;
    return Math.round(cdTurns * COMBAT.TURN_MS);
  };

  COMBAT.normalizeCdsToMs = function (unit) {
    if (!unit || !unit.cds) return;
    Object.keys(unit.cds).forEach(function (id) {
      const v = unit.cds[id];
      if (v > 0 && v < 50) unit.cds[id] = COMBAT.cdMs(v);
    });
  };

  COMBAT.tickRealtime = function (state, unit, dt) {
    if (!unit || unit.hp <= 0) return;
    dt = Number(dt) || 0;
    if (dt <= 0) return;
    Object.keys(unit.cds || {}).forEach(function (id) {
      if (unit.cds[id] > 0) unit.cds[id] = Math.max(0, unit.cds[id] - dt);
    });
    unit._buffAcc = (unit._buffAcc || 0) + dt;
    while (unit._buffAcc >= COMBAT.TURN_MS) {
      unit._buffAcc -= COMBAT.TURN_MS;
      COMBAT.tickBuffDurations(state, unit);
      COMBAT.tickOwnFocusMark(state, unit);
      if (!unit.sitting) COMBAT.applyRegen(state, unit);
    }
    unit._poisonAcc = (unit._poisonAcc || 0) + dt;
    while (unit.poisons && unit.poisons.length && unit._poisonAcc >= 1000) {
      unit._poisonAcc -= 1000;
      COMBAT.tickPoisons(state, unit);
    }
    if (unit.hidden) {
      const hideLv = COMBAT.rankOf(unit, "hiding");
      const interval = Math.max(1, (STATS.hidingSpIntervalSec ? STATS.hidingSpIntervalSec(hideLv) : 1)) * 1000;
      unit._hideAcc = (unit._hideAcc || 0) + dt;
      while (unit.hidden && unit._hideAcc >= interval) {
        unit._hideAcc -= interval;
        unit.mp = Math.max(0, (unit.mp || 0) - 1);
        if (unit.mp <= 0) {
          COMBAT.breakHide(unit);
          COMBAT.pushLog(state, '<span class="log-buff">👤 ' + unit.name + " หมด SP — ออกจากที่ซ่อน</span>");
        }
      }
    }
  };

  root.COMBAT = COMBAT;
})(typeof globalThis !== "undefined" ? globalThis : window);
