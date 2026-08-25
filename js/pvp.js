/**
 * PvP: local hot-seat + async invite-code / state-code (no server).
 */
(function (root) {
  const DATA = root.DATA;
  const STATS = root.STATS;
  const COMBAT = root.COMBAT;
  const PVP = {};

  function toB64(bin) {
    if (typeof btoa === "function") return btoa(bin);
    return Buffer.from(bin, "binary").toString("base64");
  }
  function fromB64(b64) {
    if (typeof atob === "function") return atob(b64);
    return Buffer.from(b64, "base64").toString("binary");
  }

  PVP.encode = function (obj) {
    const json = JSON.stringify(obj);
    return toB64(unescape(encodeURIComponent(json)));
  };

  PVP.decode = function (str) {
    const raw = String(str || "").replace(/\s+/g, "");
    const json = decodeURIComponent(escape(fromB64(raw)));
    return JSON.parse(json);
  };

  PVP.buildHeroUnit = function (heroId, allocated, side, skillRanks) {
    const d = STATS.computeHeroStats(heroId, allocated, DATA.emptyEquip(), 1);
    const ranks = skillRanks || DATA.defaultSkillRanks(heroId);
    d.skillRanks = Object.assign({}, ranks);
    d.skills = DATA.learnedSkills(heroId, ranks);
    const unit = COMBAT.createUnit(d, side);
    COMBAT.resetTemps(unit);
    unit.hp = unit.maxHp;
    unit.mp = unit.maxMp;
    return unit;
  };

  PVP.createLocalFight = function (p1, p2) {
    const left = PVP.buildHeroUnit(p1.heroId, p1.allocated, "left", p1.skillRanks);
    const right = PVP.buildHeroUnit(p2.heroId, p2.allocated, "right", p2.skillRanks);
    const state = COMBAT.createState(left, right, { mode: "pvp-local" });
    COMBAT.pushLog(
      state,
      '<span class="log-system">ดวลท้องถิ่น — ' +
        left.emoji +
        " " +
        left.name +
        " vs " +
        right.emoji +
        " " +
        right.name +
        "</span>"
    );
    return state;
  };

  PVP.makeInvite = function (heroId, allocated, skillRanks) {
    return {
      v: 1,
      type: "invite",
      p1: {
        heroId: heroId,
        allocated: Object.assign(DATA.emptyAllocated(), allocated),
        skillRanks: skillRanks || DATA.defaultSkillRanks(heroId),
      },
    };
  };

  PVP.parseInvite = function (code) {
    const obj = PVP.decode(code);
    if (!obj || obj.type !== "invite" || !obj.p1 || !obj.p1.heroId) {
      throw new Error("โค้ดคำเชิญไม่ถูกต้อง");
    }
    if (!DATA.HEROES[obj.p1.heroId]) throw new Error("ฮีโร่ในโค้ดไม่รู้จัก");
    return obj;
  };

  PVP.startRemoteFight = function (p1, p2, seed) {
    const left = PVP.buildHeroUnit(p1.heroId, p1.allocated, "left", p1.skillRanks);
    const right = PVP.buildHeroUnit(p2.heroId, p2.allocated, "right", p2.skillRanks);
    const state = COMBAT.createState(left, right, { mode: "pvp-remote", seed: seed });
    COMBAT.pushLog(
      state,
      '<span class="log-system">ดวลระยะไกล — ' +
        left.emoji +
        " " +
        left.name +
        " vs " +
        right.emoji +
        " " +
        right.name +
        "</span>"
    );
    return state;
  };

  PVP.makeStateCode = function (state, meta) {
    return {
      v: 1,
      type: "state",
      combat: COMBAT.serializeState(state),
      meta: meta || {},
    };
  };

  PVP.parseState = function (code) {
    const obj = PVP.decode(code);
    if (!obj || obj.type !== "state" || !obj.combat) {
      throw new Error("โค้ดสถานะไม่ถูกต้อง");
    }
    const state = COMBAT.deserializeState(obj.combat);
    return { state: state, meta: obj.meta || {} };
  };

  PVP.sideLabel = function (side) {
    return side === "left" ? "ผู้เล่น 1" : "ผู้เล่น 2";
  };

  root.PVP = PVP;
})(typeof globalThis !== "undefined" ? globalThis : window);
