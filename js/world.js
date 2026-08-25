/**
 * Real-time MMORPG combat on the field, boss world, and PvP arena.
 * Fighting happens ON THE MAP — no ATB / turn screen.
 */
(function (root) {
  const DATA = root.DATA;
  const COMBAT = root.COMBAT;
  const PVE = root.PVE;
  const WORLD = {};

  WORLD.TICK_MS = (DATA && DATA.WORLD_TICK_MS) || 50;
  WORLD.MOB_MOVE_MS = 380;
  WORLD.BOSS_MOVE_MS = 480;
  WORLD.AGGRO_LEASH = 14;
  WORLD.HUNTER_RANGE = 10;
  WORLD.WARRIOR_RANGE = 1;

  let S = null;

  function nowMs() {
    return Date.now();
  }

  function manh(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function chebyshev(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  function toast(msg, ms) {
    if (root.UI && UI.toast) UI.toast(msg, ms);
  }

  function zoneGrid() {
    if (!S) return { cols: 23, rows: 23 };
    if (S.mode === "arena") return { cols: S.cols, rows: S.rows };
    const z = MAP && MAP.ZONES && MAP.ZONES[S.mode];
    const g = z && z.grid;
    return g ? { cols: g.cols, rows: g.rows } : { cols: 23, rows: 23 };
  }

  function isWalkable(x, y) {
    if (S && S.mode === "arena") {
      return x >= 1 && y >= 1 && x < S.cols - 1 && y < S.rows - 1;
    }
    return !!(MAP && MAP.isWalkable(x, y));
  }

  WORLD.live = function () {
    return !!(S && S.timer);
  };

  WORLD.mode = function () {
    return S ? S.mode : null;
  };

  WORLD.playerUnit = function () {
    return S && S.player ? S.player.unit : null;
  };

  WORLD.playerEntity = function () {
    return S ? S.player : null;
  };

  WORLD.targetEntity = function () {
    if (!S || !S.targetId) return null;
    return S.entities.find(function (e) {
      return e.id === S.targetId;
    }) || null;
  };

  WORLD.entityAt = function (x, y) {
    if (!S) return null;
    return S.entities.find(function (e) {
      return !e.dead && e.x === x && e.y === y;
    }) || null;
  };

  WORLD.blocksTile = function (x, y, ignoreId) {
    if (!S) return false;
    return S.entities.some(function (e) {
      return !e.dead && e.x === x && e.y === y && e.id !== ignoreId;
    });
  };

  WORLD.hotbarSkills = function (side) {
    const ent = side === "right" && S && S.foe ? S.foe : S && S.player;
    if (!ent || !ent.unit || !ent.unit.skills) return [];
    return ent.unit.skills.filter(function (id) {
      return !!(DATA.SKILLS[id] || DATA.BOSS_SKILLS[id]);
    }).slice(0, 6);
  };

  function basicSkillOf(ent) {
    if (!ent || !ent.unit) return null;
    const hid = ent.unit.heroId;
    if (hid === "warrior") return "attack";
    if (hid === "assassin") return "stab";
    if (hid === "hunter") return "arrowshot";
    const skills = ent.unit.skills || [];
    const basic = skills.find(function (id) {
      const def = DATA.BOSS_SKILLS[id] || DATA.SKILLS[id];
      return def && def.kind === "basic";
    });
    return basic || skills[0] || null;
  }

  function skillDef(ent, skillId) {
    if (ent && ent.unit && ent.unit.isBoss && DATA.BOSS_SKILLS[skillId]) return DATA.BOSS_SKILLS[skillId];
    return DATA.SKILLS[skillId] || DATA.BOSS_SKILLS[skillId] || null;
  }

  function skillRange(ent, skillId) {
    const def = skillDef(ent, skillId);
    if (!def || def.type === "self") return 99;
    if (ent && ent.unit && ent.unit.heroId === "hunter") return WORLD.HUNTER_RANGE;
    if (ent && ent.unit && ent.unit.heroId === "warrior") return WORLD.WARRIOR_RANGE;
    return 1;
  }

  WORLD.skillRange = skillRange;

  function inSkillRange(ent, foe, skillId) {
    if (!ent || !foe || foe.dead) return false;
    const def = skillDef(ent, skillId);
    if (def && def.type === "self") return true;
    return chebyshev(ent, foe) <= skillRange(ent, skillId);
  }

  function makePair(atk, defn) {
    const keepA = atk.unit.side;
    const keepD = defn.unit.side;
    atk.unit.side = "left";
    defn.unit.side = "right";
    const state = {
      left: atk.unit,
      right: defn.unit,
      rng: S.rng,
      log: [],
      fx: [],
      fxQueue: [],
      over: false,
      winner: null,
      turnCount: 0,
      waitingAction: null,
      mode: "rt",
      foes: (S.entities || []).filter(function (e) {
        return e && !e.dead && e.kind !== "player" && e.aggro && e.unit && e.unit.hp > 0;
      }),
      _restore: function () {
        atk.unit.side = keepA;
        defn.unit.side = keepD;
      },
    };
    return state;
  }

  function flushFx(state, atk, defn) {
    const evts = (state.fx || []).splice(0, (state.fx || []).length);
    evts.forEach(function (e) {
      const ent = e.side === "left" ? atk : defn;
      if (!ent) return;
      let text = "";
      let kind = e.kind || "dmg";
      if (e.kind === "act") return;
      if (e.kind === "miss") {
        text = "หลบ";
        kind = "miss";
      } else if (e.kind === "heal") {
        if (!(e.amount > 0)) return;
        text = "+" + Math.floor(e.amount);
        kind = "heal";
      } else if (e.kind === "poison" || e.poison || e.source === "poison") {
        if (!(e.amount > 0)) return;
        text = String(Math.floor(e.amount));
        kind = "poison";
      } else if (e.kind === "dmg") {
        if (!(e.amount > 0)) return;
        text = String(Math.floor(e.amount));
        kind = e.crit ? "crit" : "dmg";
      } else {
        return;
      }
      if (root.FX && FX.mapFloater && S.hostEl) {
        const g = zoneGrid();
        FX.mapFloater(S.hostEl, ent.x, ent.y, g.cols, g.rows, text, kind);
      }
      if (kind === "dmg" || kind === "crit") {
        if (root.AUDIO && AUDIO.onHitFx) {
          if (atk.kind === "player") {
            AUDIO.onHitFx(e, { attacker: "hero", heroId: atk.unit && atk.unit.heroId });
          } else if (atk.monsterId) {
            AUDIO.onHitFx(e, { attacker: "mob", monsterId: atk.monsterId });
          }
        }
      }
    });
  }

  function syncPlayerSave() {
    if (!S || !S.save || !S.player) return;
    S.save.hp = S.player.unit.hp;
    S.save.mp = S.player.unit.mp;
  }

  function onDeath(victim, killer) {
    if (!victim || victim.dead) return;
    victim.dead = true;
    victim.aggro = false;
    victim.unit.hp = 0;
    victim.fadeUntil = nowMs() + 420;
    if (S.targetId === victim.id) S.targetId = null;

    if (victim.kind === "player" || (S.mode === "arena" && victim.kind === "pvp")) {
      handlePlayerOrArenaDeath(victim, killer);
      return;
    }

    if (victim.kind === "mob") {
      const reward = PVE.applyFieldRewards(S.save, victim.monsterId, S.rng);
      announceFieldReward(reward);
      victim.deadUntil = nowMs() + (DATA.FIELD_RESPAWN_MS || 4000);
      syncPlayerSave();
      paintHud(true);
      return;
    }

    if (victim.kind === "boss") {
      const reward = PVE.applyWinRewards(S.save, victim.bossId);
      announceBossReward(reward, victim);
      PVE.restoreAfterAlloc(S.save);
      if (S.player) {
        S.player.unit.hp = S.save.hp;
        S.player.unit.mp = S.save.mp;
        COMBAT.clampHpMp(S.player.unit);
      }
      victim.deadUntil = nowMs() + (DATA.BOSS_RESPAWN_MS || 8000);
      syncPlayerSave();
      paintHud(true);
    }
  }

  function announceFieldReward(reward) {
    if (!reward) return;
    const loot = (reward.loot || []).map(function (id) {
      return DATA.lootName ? DATA.lootName(id) : id;
    }).join(", ");
    let msg = "+" + reward.baseExp + " Base EXP · +" + reward.jobExp + " Job EXP · +" + reward.zeno + " Zeno";
    if (loot) msg += " · ได้ " + loot;
    (reward.baseUps || []).forEach(function (u) {
      msg += " · Base Level Up! " + u.from + " → " + u.to;
    });
    (reward.jobUps || []).forEach(function (u) {
      msg += " · Job Level Up! " + u.from + " → " + u.to;
    });
    toast(msg, 2800);
    if (root.App && App.announceLevelUps) App.announceLevelUps(reward);
  }

  function announceBossReward(reward, victim) {
    const name = victim && victim.unit ? victim.unit.name : "บอส";
    if (!reward || !reward.first) {
      toast("ชนะ " + name + " (ฟาร์ม) · +" + ((reward && reward.zeno) || 500) + " Zeno", 2600);
      return;
    }
    let msg = "เคลียร์ " + name + " ครั้งแรก · +" + (reward.bonusPoints || 0) + " แต้ม · +" + DATA.SKILL_POINTS_PER_BOSS + " SP · +" + (reward.zeno || 0) + " Zeno";
    toast(msg, 3200);
    if (reward.adventureWin) toast("พระผู้สร้างโลกล่มสลาย! ชนะบอสครบ 7 ตัว", 3600);
  }

  function handlePlayerOrArenaDeath(victim, killer) {
    if (S.mode === "arena") {
      stopLoop();
      const winner = killer && killer.unit ? killer.unit.name : victim.unit.name;
      if (S.onEnd) S.onEnd(killer && killer.kind === "player" ? "left" : "right", winner);
      else if (root.UI && UI.pvpResult) UI.pvpResult(winner);
      return;
    }
    const killerName = killer && killer.unit ? killer.unit.name : "";
    syncPlayerSave();
    PVE.respawnInCity(S.save);
    stopLoop();
    toast("พ่ายแพ้" + (killerName ? " — ถูก " + killerName + " โค่น" : "") + " · เกิดที่พรอนเทรา 50% HP", 2800);
    if (root.App && App.goCity) App.goCity();
  }


  function playerWeightOver() {
    return !!(S && S.save && root.PVE && PVE.weightState && PVE.weightState(S.save).over);
  }
  function toastWeightOverAtk() {
    if (!WORLD._weightAtkToastAt || Date.now() - WORLD._weightAtkToastAt > 2000) {
      WORLD._weightAtkToastAt = Date.now();
      toast("น้ำหนักเกิน 90% โจมตี/ใช้สกิลไม่ได้");
    }
  }

  function executeOn(atk, defn, skillId) {
    if (!atk || !defn || atk.dead || S.ending) return false;
    if (atk.kind === "player" && playerWeightOver()) {
      toastWeightOverAtk();
      return false;
    }
    const def = skillDef(atk, skillId);
    if (!def) return false;
    if (!COMBAT.skillReady(atk.unit, skillId, def)) return false;
    if (!inSkillRange(atk, defn, skillId)) return false;
    atk.facing = (root.FX && FX.facingFromDelta) ? FX.facingFromDelta(defn.x - atk.x, defn.y - atk.y) : "s";
    if (atk.unit) atk.unit.facing = atk.facing;
    if (atk.kind === "player" && S.save) S.save.facing = atk.facing;
    const prevAtb = defn.unit.atb;
    const state = makePair(atk, defn);
    const r = COMBAT.executeSkill(state, atk.unit, skillId);
    COMBAT.normalizeCdsToMs(atk.unit);
    if (root.FX && FX.mapActor) FX.mapActor(S.hostEl, atk, defn, skillId, def);
    flushFx(state, atk, defn);
    if (state._restore) state._restore();
    if (!r || !r.ok) return false;
    atk.atkReadyAt = nowMs() + COMBAT.attackIntervalMs(atk.unit);
    if (defn.unit.atb === 0 && prevAtb > 0) {
      defn.atkReadyAt = nowMs() + COMBAT.attackIntervalMs(defn.unit);
    }
    if (!atk.unit.cds[skillId]) atk.unit.cds[skillId] = COMBAT.GLOBAL_CD_MS;
    if (defn.kind !== "player") defn.aggro = true;
    if (atk.kind === "player" && defn.kind !== "player") S.targetId = defn.id;
    if (defn.unit.hp <= 0) onDeath(defn, atk);
    if (!S || S.ending) return true;
    if (atk.unit.hp <= 0) onDeath(atk, defn);
    if (!S || S.ending) return true;
    syncPlayerSave();
    return true;
  }

  function dummyFoe(ent) {
    const other = S.entities.find(function (e) {
      return e !== ent && !e.dead;
    });
    return other || ent;
  }

  WORLD.cast = function (skillId, side) {
    if (!S || !skillId) return false;
    const ent = side === "right" && S.foe ? S.foe : S.player;
    if (!ent || ent.dead) return false;
    if (ent.kind === "player" && ent.sitting) setPlayerSitting(false);
    if (ent.kind === "player" && playerWeightOver()) {
      toastWeightOverAtk();
      return false;
    }
    const def = skillDef(ent, skillId);
    if (!def) return false;
    if (!COMBAT.skillReady(ent.unit, skillId, def)) {
      toast("สกิลยังไม่พร้อม");
      return false;
    }
    let foe = WORLD.targetEntity();
    if (S.mode === "arena") {
      foe = ent === S.player ? S.foe : S.player;
    }
    if (def.type === "self") {
      foe = foe && !foe.dead ? foe : dummyFoe(ent);
      return executeOn(ent, foe, skillId);
    }
    if (!foe || foe.dead || foe === ent) {
      toast("เลือกเป้าหมายก่อน");
      return false;
    }
    if (!inSkillRange(ent, foe, skillId)) {
      toast("ระยะไม่ถึง");
      return false;
    }
    return executeOn(ent, foe, skillId);
  };

  WORLD.setTarget = function (id) {
    if (!S) return;
    const ent = S.entities.find(function (e) {
      return e.id === id && !e.dead && e.kind !== "player";
    });
    S.targetId = ent ? ent.id : null;
    paintEntities();
    paintHud(false);
  };

  WORLD.holdIfInRange = function () {
    if (!S || !S.player || S.player.dead) return false;
    const tgt = WORLD.targetEntity();
    if (!tgt || tgt.dead) return false;
    const sid = basicSkillOf(S.player);
    if (!sid || !inSkillRange(S.player, tgt, sid)) return false;
    if (MAP && MAP.stopWalking) MAP.stopWalking();
    return true;
  };

  WORLD.clickEntity = function (ent) {
    if (!S || !ent || ent.dead) return;
    if (ent.kind === "player") return;
    WORLD.setTarget(ent.id);
    if (S.mode === "arena") return;
    if (S.save && S.save.autoFarm) return;
    const p = playerPos();
    const sid = basicSkillOf(S.player);
    if (sid && inSkillRange(S.player, ent, sid)) return;
    if (chebyshev(p, ent) <= 1) return;
    if (MAP && MAP.walkToAdjacent) MAP.walkToAdjacent(p, ent);
  };

  function playerPos() {
    if (!S) return { x: 0, y: 0 };
    if (S.mode === "arena") return { x: S.player.x, y: S.player.y };
    if (MAP && MAP.getPos) {
      const p = MAP.getPos();
      S.player.x = p.x;
      S.player.y = p.y;
      return p;
    }
    return { x: S.player.x, y: S.player.y };
  }

  function trySwing(ent) {
    if (!ent || ent.dead || S.ending) return;
    if (ent.kind === "player" && ent.sitting) return;
    if (ent.kind === "player" && playerWeightOver()) {
      toastWeightOverAtk();
      return;
    }
    if (nowMs() < (ent.atkReadyAt || 0)) return;
    let foe = null;
    if (ent.kind === "player") {
      foe = WORLD.targetEntity();
      if (S.mode === "arena") foe = S.foe;
    } else if (S.mode === "arena") {
      foe = S.player;
    } else {
      foe = S.player;
    }
    if (!foe || foe.dead) return;
    const sid = basicSkillOf(ent);
    if (!sid) return;
    if (!inSkillRange(ent, foe, sid)) return;
    if (ent.kind !== "player" && !ent.aggro && chebyshev(ent, foe) > 1) return;
    executeOn(ent, foe, sid);
  }

  function tryMobSkill(ent) {
    if (!ent || ent.dead || ent.kind === "player") return;
    if (nowMs() < (ent.atkReadyAt || 0)) return;
    const foe = S.mode === "arena" ? (ent === S.player ? S.foe : S.player) : S.player;
    if (!foe || foe.dead) return;
    if (!ent.aggro && S.mode !== "arena") return;
    if (ent.unit.isBoss || ent.unit.isMonster) {
      const sid = COMBAT.chooseBossSkill(ent.unit);
      if (!sid) return;
      const def = DATA.BOSS_SKILLS[sid];
      if (def && def.kind === "basic") return;
      if (!inSkillRange(ent, foe, sid) && !(def && def.type === "self")) return;
      executeOn(ent, foe, sid);
    }
  }

  function stepToward(ent, tx, ty) {
    if (!ent || ent.dead) return;
    const delay = ent.kind === "boss" ? WORLD.BOSS_MOVE_MS : WORLD.MOB_MOVE_MS;
    if (nowMs() < (ent.moveReadyAt || 0)) return;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    let best = null;
    let bestD = manh(ent, { x: tx, y: ty });
    dirs.forEach(function (d) {
      const nx = ent.x + d[0];
      const ny = ent.y + d[1];
      if (!isWalkable(nx, ny)) return;
      if (d[0] && d[1] && (!isWalkable(ent.x + d[0], ent.y) || !isWalkable(ent.x, ent.y + d[1]))) return;
      if (WORLD.blocksTile(nx, ny, ent.id)) return;
      if (S.player && nx === S.player.x && ny === S.player.y && ent !== S.player) return;
      const dist = Math.abs(nx - tx) + Math.abs(ny - ty);
      if (dist < bestD) {
        bestD = dist;
        best = { x: nx, y: ny };
      }
    });
    if (!best) return;
    ent.facing = (root.FX && FX.facingFromDelta) ? FX.facingFromDelta(best.x - ent.x, best.y - ent.y) : "s";
    if (ent.unit) ent.unit.facing = ent.facing;
    ent.x = best.x;
    ent.y = best.y;
    ent.walkFrame = ent.walkFrame === 1 ? 2 : 1;
    if (ent.unit) ent.unit.walkFrame = ent.walkFrame;
    ent.moveReadyAt = nowMs() + delay;
    if (S && S.hostEl) {
      const el = S.hostEl.querySelector('[data-eid="' + ent.id + '"]');
      if (el && root.FX && FX.markWalk) FX.markWalk(el);
    }
  }

  function tickAggro(ent) {
    if (ent.kind === "player" || ent.dead) return;
    const p = S.player;
    if (!p || p.dead) return;
    if (S.mode === "arena") {
      ent.aggro = true;
      if (chebyshev(ent, p) > 1) stepToward(ent, p.x, p.y);
      return;
    }
    if (chebyshev(ent, p) <= 1) ent.aggro = true;
    if (!ent.aggro) return;
    if (manh(ent, p) > WORLD.AGGRO_LEASH) {
      ent.aggro = false;
      if (ent.x !== ent.spawnX || ent.y !== ent.spawnY) stepToward(ent, ent.spawnX, ent.spawnY);
      return;
    }
    if (chebyshev(ent, p) > 1) stepToward(ent, p.x, p.y);
  }

  function tickRespawn(ent) {
    if (!ent.dead || !ent.deadUntil) return;
    if (nowMs() < ent.deadUntil) return;
    if (ent.kind === "mob") {
      ent.unit = PVE.buildMonsterUnit(ent.monsterId);
      ent.unit.side = "right";
    } else if (ent.kind === "boss") {
      ent.unit = PVE.buildBossUnit(ent.bossId);
      ent.unit.side = "right";
    } else {
      return;
    }
    ent.dead = false;
    ent.deadUntil = 0;
    ent.aggro = false;
    ent.x = ent.spawnX;
    ent.y = ent.spawnY;
    ent.atkReadyAt = nowMs() + 400;
    COMBAT.resetTemps(ent.unit);
    ent.unit.hp = ent.unit.maxHp;
    ent.unit.mp = ent.unit.maxMp;
  }

  /* Sit regen = 2× stand (hpRegen/mpRegen per second while sitting). */
  WORLD.SIT_REGEN_MULT = 2;

  function setPlayerSitting(on) {
    if (!S || !S.player) return;
    S.player.sitting = !!on;
    if (S.player.unit) S.player.unit.sitting = !!on;
    if (on && MAP && MAP.stopWalking) MAP.stopWalking();
    if (S.hostEl) {
      const av = S.hostEl.querySelector(".map-avatar");
      if (av) av.classList.toggle("sitting", !!on);
    }
  }

  WORLD.applySitRegen = function (unit, dt) {
    if (!unit) return 0;
    if (S && S.save && root.PVE && PVE.weightState && PVE.weightState(S.save).noRegen) return 0;
    if (unit.noRegen) return 0;
    dt = Number(dt) || 0;
    if (dt <= 0) return 0;
    const mult = WORLD.SIT_REGEN_MULT || 2;
    unit._sitRegenAcc = (unit._sitRegenAcc || 0) + dt;
    let n = 0;
    while (unit._sitRegenAcc >= 1000) {
      unit._sitRegenAcc -= 1000;
      COMBAT.healUnit(unit, (unit.hpRegen || 0) * mult);
      COMBAT.restoreMp(unit, (unit.mpRegen || 0) * mult);
      n += 1;
    }
    return n;
  };

  WORLD.pickFarmSkill = function (save, playerEnt, foeEnt) {
    if (!save || !playerEnt) return null;
    const unit = playerEnt.unit || playerEnt;
    const cfg = PVE.ensureAutoFarmCfg(save);
    const learned = PVE.learnedSkillIds(save);
    const list = cfg.skills || [];
    let i;
    for (i = 0; i < list.length; i++) {
      const id = list[i];
      if (!id) continue;
      if (learned.indexOf(id) < 0) continue;
      const def = DATA.SKILLS[id];
      if (!def) continue;
      if (!COMBAT.skillReady(unit, id, def)) continue;
      if (def.type === "self") return id;
      const ent = playerEnt.unit ? playerEnt : { x: playerEnt.x || 0, y: playerEnt.y || 0, unit: unit };
      if (foeEnt && inSkillRange(ent, foeEnt, id)) return id;
    }
    return null;
  };

  WORLD.tryFarmSkills = function (save, playerEnt, foeEnt) {
    const id = WORLD.pickFarmSkill(save, playerEnt, foeEnt);
    if (!id) return false;
    return WORLD.cast(id, "left");
  };

  function tickAutoFarm(dt) {
    if (!S || S.mode !== "field" || !S.player) return;
    if (!S.save || !S.save.autoFarm) {
      if (S.player.sitting) setPlayerSitting(false);
      return;
    }
    const p = S.player;
    if (!p || p.dead) return;
    PVE.maybeAutoPotion(S.save, p.unit);
    syncPlayerSave();
    const hpPct = p.unit.maxHp ? p.unit.hp / p.unit.maxHp : 1;
    if (hpPct < (DATA.AUTO_FARM_STOP_HP || 0.15) && !PVE.hasHpPotion(S.save)) {
      S.save.autoFarm = false;
      setPlayerSitting(false);
      toast("HP ต่ำและยาหมด — หยุด Auto Farm");
      paintHud(true);
      return;
    }
    if (PVE.shouldSit(S.save, p.unit)) {
      setPlayerSitting(true);
      WORLD.applySitRegen(p.unit, dt);
      syncPlayerSave();
      return;
    }
    if (p.sitting) setPlayerSitting(false);
    let tgt = WORLD.targetEntity();
    if (!tgt || tgt.dead) {
      tgt = nearestLiving(p, "mob");
      if (tgt) WORLD.setTarget(tgt.id);
    }
    if (!tgt) return;
    const sid = basicSkillOf(p);
    if (sid && inSkillRange(p, tgt, sid)) {
      if (MAP && MAP.stopWalking) MAP.stopWalking();
    } else {
      if (MAP && MAP.isWalking && MAP.isWalking()) return;
      if (MAP && MAP.walkToAdjacent) MAP.walkToAdjacent(playerPos(), tgt);
      return;
    }
    if (WORLD.tryFarmSkills(S.save, p, tgt)) return;
    if (hpPct < (DATA.AUTO_HEAL_SKILL_HP || 0.35)) {
      const heal = (p.unit.skills || []).find(function (hid) {
        const def = DATA.SKILLS[hid];
        return def && (hid === "heal" || hid === "sanctuary") && COMBAT.skillReady(p.unit, hid, def);
      });
      if (heal) {
        WORLD.cast(heal, "left");
        return;
      }
    }
    const dmg = (p.unit.skills || []).find(function (hid) {
      const def = DATA.SKILLS[hid];
      if (!def || def.type !== "attack") return false;
      if ((def.cd || 0) === 0 && (def.mp || 0) === 0) return false;
      return COMBAT.skillReady(p.unit, hid, def);
    });
    if (dmg) WORLD.cast(dmg, "left");
  }

  function nearestLiving(from, kind) {
    let best = null;
    let bestD = 1e9;
    S.entities.forEach(function (e) {
      if (e.dead || e === from) return;
      if (kind && e.kind !== kind) return;
      const d = manh(from, e);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    });
    return best;
  }

  function tickArenaAi() {
    if (!S || S.mode !== "arena" || S.localBoth) return;
    const foe = S.foe;
    if (!foe || foe.dead) return;
    if (nowMs() < (S.aiSkillAt || 0)) return;
    S.aiSkillAt = nowMs() + 700;
    const id = COMBAT.chooseHeroAutoSkill(foe.unit);
    if (!id) return;
    const def = DATA.SKILLS[id];
    if (def && (def.cd || 0) === 0 && (def.mp || 0) === 0) return;
    WORLD.cast(id, "right");
  }

  function tick(dt) {
    if (!S) return;
    playerPos();
    const pulse = { log: [], fx: [], fxQueue: [] };
    S.entities.forEach(function (e) {
      if (!S || S.ending) return;
      if (e.dead) {
        tickRespawn(e);
        return;
      }
      COMBAT.tickRealtime(pulse, e.unit, dt);
      if (e.unit.hp <= 0) {
        const killer = e === S.player ? nearestLiving(e) : S.player;
        onDeath(e, killer);
      }
    });
    if (!S || S.ending) return;
    flushFx(pulse, S.player, WORLD.targetEntity() || S.foe || S.player);
    if (!S || S.ending) return;

    S.entities.forEach(function (e) {
      if (!S || S.ending || e.dead) return;
      tickAggro(e);
      if (!S || S.ending) return;
      if (e.kind !== "player") tryMobSkill(e);
      if (!S || S.ending) return;
      trySwing(e);
    });
    if (S.mode === "arena" && S.localBoth) {
      trySwing(S.foe);
    }
    tickAutoFarm(dt);
    tickArenaAi();
    syncPlayerSave();
    S.hudAcc = (S.hudAcc || 0) + dt;
    if (S.hudAcc >= 180) {
      S.hudAcc = 0;
      paintHud(false);
    }
    paintEntities();
  }

  function stopLoop() {
    if (S && S.timer) {
      clearInterval(S.timer);
      S.timer = null;
    }
    if (S) S.ending = true;
  }

  function startLoop() {
    if (!S) return;
    if (S.timer) clearInterval(S.timer);
    S.ending = false;
    S.lastTs = nowMs();
    S.timer = setInterval(function () {
      if (!S) return;
      const n = nowMs();
      const dt = Math.min(200, n - (S.lastTs || n));
      S.lastTs = n;
      tick(dt);
    }, WORLD.TICK_MS);
  }

  function makePlayerEntity(save, x, y) {
    const unit = PVE.buildHeroUnit(save);
    unit.side = "left";
    return {
      id: "player",
      kind: "player",
      x: x,
      y: y,
      spawnX: x,
      spawnY: y,
      unit: unit,
      atkReadyAt: 0,
      moveReadyAt: 0,
      aggro: false,
      dead: false,
      deadUntil: 0,
    };
  }

  function makeMob(monsterId, x, y, uid) {
    const unit = PVE.buildMonsterUnit(monsterId);
    unit.side = "right";
    return {
      id: uid,
      kind: "mob",
      x: x,
      y: y,
      spawnX: x,
      spawnY: y,
      unit: unit,
      monsterId: monsterId,
      atkReadyAt: nowMs() + 250,
      moveReadyAt: 0,
      aggro: false,
      dead: false,
      deadUntil: 0,
    };
  }

  function makeBoss(bossId, x, y) {
    const unit = PVE.buildBossUnit(bossId);
    unit.side = "right";
    return {
      id: "boss-" + bossId,
      kind: "boss",
      x: x,
      y: y,
      spawnX: x,
      spawnY: y,
      unit: unit,
      bossId: bossId,
      atkReadyAt: nowMs() + 400,
      moveReadyAt: 0,
      aggro: false,
      dead: false,
      deadUntil: 0,
    };
  }

  function spawnField() {
    const list = (MAP.listFieldSpawns && MAP.listFieldSpawns()) || [];
    list.forEach(function (m) {
      S.entities.push(makeMob(m.monsterId, m.x, m.y, m.uid || ("m" + m.x + "," + m.y)));
    });
  }

  function spawnBosses() {
    const list = (MAP.listBossSpawns && MAP.listBossSpawns()) || (MAP.bossList || []);
    list.forEach(function (b) {
      S.entities.push(makeBoss(b.id, b.x, b.y));
    });
  }

  function paintEntities() {
    if (!S || !S.hostEl) return;
    const grid = S.hostEl.querySelector(".map-grid");
    if (!grid) return;
    const g = zoneGrid();
    let layer = grid.querySelector(".ent-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "ent-layer";
      grid.appendChild(layer);
    }
    const now = nowMs();
    const live = S.entities.filter(function (e) {
      if (e.kind === "player") return false;
      if (!e.dead) return true;
      return e.fadeUntil && now < e.fadeUntil;
    });
    const have = {};
    live.forEach(function (e) {
      have[e.id] = true;
      let el = layer.querySelector('[data-eid="' + e.id + '"]');
      if (!el) {
        el = document.createElement("div");
        el.className = "map-ent";
        el.setAttribute("data-eid", e.id);
        el.innerHTML =
          '<div class="ent-art"></div><div class="ent-hp"><i></i></div><small class="ent-lab"></small>';
        layer.appendChild(el);
        el.addEventListener("click", function (ev) {
          ev.stopPropagation();
          const ent = S.entities.find(function (x) {
            return x.id === e.id;
          });
          WORLD.clickEntity(ent);
        });
      }
      el.classList.toggle("targeted", S.targetId === e.id);
      el.classList.toggle("boss", e.kind === "boss");
      el.classList.toggle("dying", !!e.dead);
      const vw = (MAP && MAP.VIEW_W) || 45;
      const vh = (MAP && MAP.VIEW_H) || 33;
      let sx = e.x;
      let sy = e.y;
      if (MAP && MAP.worldToScreen && S.mode !== "arena") {
        const sp = MAP.worldToScreen(e.x, e.y);
        sx = sp.x;
        sy = sp.y;
      }
      if (sx < -1 || sy < -1 || sx > vw || sy > vh) {
        el.style.display = "none";
      } else {
        el.style.display = "";
        el.style.left = (sx * 100 / vw) + "%";
        el.style.top = (sy * 100 / vh) + "%";
      }
      const art = el.querySelector(".ent-art");
      const u = e.unit;
      const src = (root.FX && FX.spriteSrc && FX.spriteSrc(u.heroId, u)) || u.sprite || u.portrait || "";
      const tint = (u.isMonster && src.indexOf("monster_sprite") !== -1)
        ? " tint-" + (e.monsterId || "poring")
        : "";
      const size = e.kind === "boss" ? " tall" : u.isMonster ? " mob" : "";
      const img = art.querySelector("img.map-sprite");
      if (src) {
        if (!img || img.getAttribute("src") !== src) {
          art.innerHTML = '<img class="map-sprite' + tint + size + '" src="' + src + '" alt="">';
        } else {
          img.className = "map-sprite" + tint + size;
        }
        if (root.FX && FX.applyFacing) FX.applyFacing(el, e.facing || (u && u.facing) || "s");
      } else if (!art.querySelector(".ent-emo")) {
        art.innerHTML = '<span class="ent-emo">' + (u.emoji || "") + "</span>";
      }
      if (!el.querySelector(".ent-slash")) {
        const sl = document.createElement("div");
        sl.className = "ent-slash";
        el.appendChild(sl);
      }
      const hp = el.querySelector(".ent-hp i");
      const pct = u.maxHp ? Math.max(0, Math.min(100, (100 * u.hp) / u.maxHp)) : 0;
      if (hp) hp.style.width = pct.toFixed(1) + "%";
      const lab = el.querySelector(".ent-lab");
      if (lab) lab.textContent = (u.name || "") + (u.level ? " Lv." + u.level : "");
    });
    layer.querySelectorAll(".map-ent").forEach(function (el) {
      const id = el.getAttribute("data-eid");
      if (!have[id]) el.parentNode.removeChild(el);
    });

    if (S.mode === "arena" && S.player && S.foe) {
      paintArenaAvatars();
    }

    if (S.hostEl && S.mode !== "arena") {
      S.hostEl.querySelectorAll(".map-tile.mob, .map-tile.boss").forEach(function (tile) {
        const x = Number(tile.getAttribute("data-mx"));
        const y = Number(tile.getAttribute("data-my"));
        const liveHere = WORLD.entityAt(x, y);
        tile.classList.toggle("mob-dead", S.mode === "field" && !liveHere);
        const emo = tile.querySelector(".map-boss-emo");
        const lab = tile.querySelector(".map-boss-lab");
        if (S.mode === "field") {
          if (emo) emo.textContent = "";
          if (lab) lab.textContent = "";
        }
        if (S.mode === "bosses") {
          if (emo) emo.style.opacity = liveHere ? "0.15" : "0.35";
        }
      });
    }
  }

  function paintArenaAvatars() {
    const grid = S.hostEl && S.hostEl.querySelector(".map-grid");
    if (!grid) return;
    const g = zoneGrid();
    [S.player, S.foe].forEach(function (e, i) {
      let av = grid.querySelector(i === 0 ? ".map-avatar.p1" : ".map-avatar.p2");
      if (!av) {
        av = document.createElement("div");
        av.className = "map-avatar " + (i === 0 ? "p1" : "p2");
        av.innerHTML = '<img alt=""><small></small>';
        grid.appendChild(av);
      }
      const vw = g.cols || 23;
      const vh = g.rows || 23;
      av.style.left = e.x * (100 / vw) + "%";
      av.style.top = e.y * (100 / vh) + "%";
      const img = av.querySelector("img");
      if (img) {
        img.className = "map-sprite hero";
        img.src = (root.FX && FX.spriteSrc && FX.spriteSrc(e.unit.heroId, e.unit)) ||
          ("assets/chars/" + (e.unit.heroId || "warrior") + "_s.png");
        if (root.FX && FX.applyFacing) FX.applyFacing(av, e.facing || (e.unit && e.unit.facing) || "s");
      }
      const sm = av.querySelector("small");
      if (sm) sm.textContent = "";
    });
  }

  function paintHud(full) {
    if (!S) return;
    if (S.save && root.UI && UI.refreshHud) UI.refreshHud(S.save);
    if (root.UI && UI.refreshRt) UI.refreshRt(WORLD.hudModel());
    if (full && S.save && root.UI && UI.refreshHud) UI.refreshHud(S.save);
  }

  WORLD.hudModel = function () {
    if (!S) return null;
    const p = S.player && S.player.unit;
    const t = WORLD.targetEntity();
    const tu = t && t.unit;
    return {
      mode: S.mode,
      aspd: p ? COMBAT.attackIntervalMs(p) : 0,
      intervalMs: p ? COMBAT.attackIntervalMs(p) : 0,
      aspeed: p ? COMBAT.effectiveAspeed(p) : 0,
      finalAspd: p ? COMBAT.effectiveAspeed(p) : 0,
      aspdScore: p && p.aspd != null ? p.aspd : null,
      skills: WORLD.hotbarSkills("left"),
      unit: p,
      target: tu
        ? {
            name: tu.name,
            emoji: tu.emoji,
            hp: tu.hp,
            maxHp: tu.maxHp,
            level: tu.level,
          }
        : null,
      cds: p ? p.cds : {},
      mp: p ? p.mp : 0,
      maxMp: p ? p.maxMp : 0,
      localBoth: !!(S.localBoth),
      foeSkills: S.localBoth ? WORLD.hotbarSkills("right") : [],
      foeUnit: S.localBoth && S.foe ? S.foe.unit : null,
    };
  };

  WORLD.mount = function (hostEl, save) {
    WORLD.teardown();
    if (!hostEl || !save) return;
    const mode = save.mapId === "bosses" ? "bosses" : save.mapId === "field" ? "field" : null;
    if (!mode) return;
    PVE.syncVitals(save);
    const pos = MAP && MAP.getPos ? MAP.getPos() : { x: 2, y: 7 };
    S = {
      mode: mode,
      save: save,
      hostEl: hostEl,
      entities: [],
      targetId: null,
      rng: COMBAT.createRng((Date.now() % 2147483647) || 1),
      player: null,
      foe: null,
      localBoth: false,
      onEnd: null,
      timer: null,
      ending: false,
      hudAcc: 0,
    };
    S.player = makePlayerEntity(save, pos.x, pos.y);
    S.entities.push(S.player);
    if (mode === "field") spawnField();
    else spawnBosses();
    startLoop();
    paintEntities();
    paintHud(true);
  };

  WORLD.mountArena = function (hostEl, leftUnit, rightUnit, opts) {
    WORLD.teardown();
    opts = opts || {};
    const cols = 23;
    const rows = 23;
    leftUnit.side = "left";
    rightUnit.side = "right";
    COMBAT.resetTemps(leftUnit);
    COMBAT.resetTemps(rightUnit);
    leftUnit.hp = leftUnit.maxHp;
    leftUnit.mp = leftUnit.maxMp;
    rightUnit.hp = rightUnit.maxHp;
    rightUnit.mp = rightUnit.maxMp;
    const p1 = {
      id: "p1",
      kind: "player",
      x: 6,
      y: 11,
      spawnX: 6,
      spawnY: 11,
      unit: leftUnit,
      atkReadyAt: 200,
      moveReadyAt: 0,
      aggro: true,
      dead: false,
    };
    const p2 = {
      id: "p2",
      kind: "pvp",
      x: 16,
      y: 11,
      spawnX: 16,
      spawnY: 11,
      unit: rightUnit,
      atkReadyAt: 280,
      moveReadyAt: 0,
      aggro: true,
      dead: false,
    };
    S = {
      mode: "arena",
      save: null,
      hostEl: hostEl,
      cols: cols,
      rows: rows,
      entities: [p1, p2],
      targetId: "p2",
      rng: COMBAT.createRng(opts.seed || (Date.now() % 2147483647) || 1),
      player: p1,
      foe: p2,
      localBoth: !!opts.local,
      onEnd: opts.onEnd || null,
      timer: null,
      ending: false,
      hudAcc: 0,
      aiSkillAt: 0,
    };
    startLoop();
    paintEntities();
    paintHud(true);
    bindArenaPad();
  };

  let arenaPadTimer = null;
  let arenaPadDir = null;
  function bindArenaPad() {
    const pad = typeof document !== "undefined" ? document.getElementById("walk-pad") : null;
    if (!pad) return;
    function down(ev) {
      const btn = ev.target.closest && ev.target.closest("[data-dx]");
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      const dx = Number(btn.getAttribute("data-dx"));
      const dy = Number(btn.getAttribute("data-dy"));
      arenaPadDir = { x: dx, y: dy };
      WORLD.tryStepArena(dx, dy, "left");
      if (arenaPadTimer) clearInterval(arenaPadTimer);
      arenaPadTimer = setInterval(function () {
        if (!arenaPadDir) return;
        WORLD.tryStepArena(arenaPadDir.x, arenaPadDir.y, "left");
      }, 140);
    }
    function up() {
      arenaPadDir = null;
      if (arenaPadTimer) {
        clearInterval(arenaPadTimer);
        arenaPadTimer = null;
      }
    }
    pad.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    S.arenaPad = { down: down, up: up, pad: pad };
  }

  WORLD.teardown = function () {
    if (S && S.arenaPad) {
      S.arenaPad.pad.removeEventListener("pointerdown", S.arenaPad.down);
      window.removeEventListener("pointerup", S.arenaPad.up);
    }
    arenaPadDir = null;
    if (arenaPadTimer) {
      clearInterval(arenaPadTimer);
      arenaPadTimer = null;
    }
    if (S && S.timer) clearInterval(S.timer);
    if (S && S.save && S.player && S.player.unit) {
      S.save.hp = S.player.unit.hp;
      S.save.mp = S.player.unit.mp;
    }
    S = null;
  };

  WORLD.adjacentAggro = function (x, y) {
    if (!S) return;
    S.entities.forEach(function (e) {
      if (e.dead || e.kind === "player") return;
      if (Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) <= 1) {
        e.aggro = true;
        if (!S.targetId) S.targetId = e.id;
      }
    });
  };

  WORLD.tryStepArena = function (dx, dy, side) {
    if (!S || S.mode !== "arena") return false;
    const ent = side === "right" ? S.foe : S.player;
    if (!ent || ent.dead) return false;
    if (dx && dy && (!isWalkable(ent.x + dx, ent.y) || !isWalkable(ent.x, ent.y + dy))) {
      const openX = isWalkable(ent.x + dx, ent.y);
      const openY = isWalkable(ent.x, ent.y + dy);
      if (openX && !openY) dy = 0;
      else if (openY && !openX) dx = 0;
      else return false;
    }
    const nx = ent.x + dx;
    const ny = ent.y + dy;
    if (!isWalkable(nx, ny)) return false;
    if (WORLD.blocksTile(nx, ny, ent.id)) return false;
    ent.x = nx;
    ent.y = ny;
    paintEntities();
    return true;
  };

  root.WORLD = WORLD;
})(typeof globalThis !== "undefined" ? globalThis : window);
