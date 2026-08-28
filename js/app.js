/**
 * App controller — screens, PvE (boss select + ATB) / field RT / PvP wiring.
 */
(function (root) {
  const DATA = root.DATA;
  const STATS = root.STATS;
  const COMBAT = root.COMBAT;
  const PVE = root.PVE;
  const PVP = root.PVP;
  const UI = root.UI;

  const App = {
    screen: "home",
    flow: null,
    save: null,
    allocSess: null,
    pendingHero: null,
    combat: null,
    timer: null,
    pvp: null,
    afterWin: null,
    skillSess: null,
    skillFinal: false,
    skillMode: null,
    pendingAlloc: null,
    pendingName: null,
  };

  function stopLoop() {
    if (App.timer) {
      clearInterval(App.timer);
      App.timer = null;
    }
  }

  function copyText(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.select();
    el.setSelectionRange(0, 999999);
    try {
      navigator.clipboard.writeText(el.value);
      UI.toast("คัดลอกแล้ว");
    } catch (e) {
      try {
        document.execCommand("copy");
        UI.toast("คัดลอกแล้ว");
      } catch (e2) {
        UI.toast("คัดลอกไม่สำเร็จ — เลือกข้อความแล้วคัดลอกเอง");
      }
    }
  }

  App.goHome = function () {
    if (App.save) {
      App.goCity();
      return;
    }
    stopLoop();
    if (typeof WORLD !== "undefined" && WORLD.teardown) WORLD.teardown();
    if (typeof MAP !== "undefined") {
      MAP.teardown();
      if (MAP.resetField) MAP.resetField();
    }
    if (typeof ROOM !== "undefined") ROOM.leave();
    UI.closeBag && UI.closeBag();
    UI.closeCityWin && UI.closeCityWin();
    App._ended = false;
    App.screen = "hero";
    App.flow = null;
    App.save = null;
    App.allocSess = null;
    App.pendingHero = null;
    App.combat = null;
    App.pvp = null;
    App.afterWin = null;
    App.skillSess = null;
    App.skillFinal = false;
    App.skillMode = null;
    App.pendingAlloc = null;
    App.pendingName = null;
    App.levelAlloc = false;
    App.goCharSelect();
  };

  App.goPve = function (opts) {
    opts = opts || {};
    App.flow = "pve";
    App.pvp = null;
    App.screen = "hero";
    UI.heroSelect({
      title: "เลือกอาชีพ",
      subtitle: "นักรบผู้กล้า · มือสังหารเงา · นักล่าผู้ใช้เหยี่ยว",
      hideBack: false,
    });
  };

  App.goCharSelect = function () {
    stopLoop();
    if (typeof WORLD !== "undefined" && WORLD.teardown) WORLD.teardown();
    if (typeof MAP !== "undefined") MAP.teardown();
    UI.closeBag && UI.closeBag();
    UI.closeCityWin && UI.closeCityWin();
    App.flow = "pve";
    App.save = null;
    App.pendingHero = null;
    App.pendingName = null;
    App.allocSess = null;
    App.screen = "char-select";
    UI.charSelect();
  };

  App.loadAccount = function (username) {
    const save = PVE.readAccount(username);
    if (!save) {
      UI.toast("ไม่พบข้อมูล username นี้");
      return;
    }
    App.flow = "pve";
    App.save = save;
    if (App.goWorld && save.mapId && save.mapId !== "city") App.goWorld();
    else App.goCity();
  };

  App.loginByUsername = function () {
    const el = document.getElementById("login-user");
    App.loadAccount(el ? el.value : "");
  };

  App.goSave = function () {
    if (!App.save) {
      UI.toast("ยังไม่มีตัวละคร");
      return;
    }
    if (App.mapIsLive && App.mapIsLive()) {
      if (App.toggleCityWin) App.toggleCityWin("save");
      else UI.openCityWin("save", App.save);
      return;
    }
    UI.openCityWin("save", App.save);
  };

  App.confirmSave = function () {
    const el = document.getElementById("save-user");
    const v = PVE.validateUsername(el ? el.value : "");
    if (!v.ok) {
      UI.toast("ใส่ Username 1–24 ตัว ใช้ภาษาไทยได้");
      return;
    }
    App.save.username = v.name;
    const r = PVE.writeAccount(v.name, App.save);
    if (!r.ok) {
      UI.toast("บันทึกไม่สำเร็จ");
      return;
    }
    UI.toast("บันทึกแล้ว: " + v.name);
    UI.closeCityWin && UI.closeCityWin();
  };

  App.goPvpMenu = function () {
    stopLoop();
    App.flow = "pvp";
    App.combat = null;
    App.screen = "pvp-menu";
    UI.pvpMenu();
  };

  App.heroSelectBack = function () {
    if (App.pvp && App.pvp.kind === "room") {
      UI.roomLobby(typeof ROOM !== "undefined" ? ROOM.snapshot : {});
      return;
    }
    if (App.flow === "pvp") {
      App.goPvpMenu();
      return;
    }
    if (App.flow === "pve") {
      App.goCharSelect();
      return;
    }
    App.goHome();
  };

  App.pickHero = function (heroId) {
    App.pendingHero = heroId;
    if (App.pvp && App.pvp.kind === "room") {
      App.pvp.phase = "alloc";
      App.allocSess = STATS.createAllocSession(DATA.emptyAllocated(), DATA.STAT_POINTS_TOTAL);
      UI.alloc(App.allocSess, heroId, { blurb: "ห้อง PvP — แจกแต้ม " + DATA.STAT_POINTS_TOTAL + " (ไม่มีอุปกรณ์)" });
      return;
    }
    if (App.flow === "pve") {
      App.screen = "name";
      const hero = DATA.HEROES[heroId];
      UI.nameChar(heroId, hero && hero.name);
      return;
    }
    if (App.pvp && App.pvp.phase === "p1-hero") {
      App.pvp.p1 = { heroId: heroId, allocated: null };
      App.pvp.phase = "p1-alloc";
      App.allocSess = STATS.createAllocSession(DATA.emptyAllocated(), DATA.STAT_POINTS_TOTAL);
      UI.alloc(App.allocSess, heroId, { blurb: "ผู้เล่น 1 — แจกแต้ม " + DATA.STAT_POINTS_TOTAL + " แต้ม" });
      return;
    }
    if (App.pvp && App.pvp.phase === "p2-hero") {
      App.pvp.p2 = { heroId: heroId, allocated: null };
      App.pvp.phase = "p2-alloc";
      App.allocSess = STATS.createAllocSession(DATA.emptyAllocated(), DATA.STAT_POINTS_TOTAL);
      UI.alloc(App.allocSess, heroId, { blurb: "ผู้เล่น 2 — แจกแต้ม " + DATA.STAT_POINTS_TOTAL + " แต้ม" });
      return;
    }
  };

  App.validateCharName = function (name) {
    return PVE.validateCharName(name);
  };

  App.confirmName = function () {
    const el = document.getElementById("char-name");
    const v = App.validateCharName(el ? el.value : "");
    if (!v.ok) {
      UI.toast("ตั้งชื่อ 1–24 ตัวอักษร ใช้ภาษาไทยได้");
      return;
    }
    App.pendingName = v.name;
    App.allocSess = STATS.createAllocSession(DATA.emptyAllocated(), DATA.STAT_POINTS_TOTAL);
    App.screen = "alloc";
    UI.alloc(App.allocSess, App.pendingHero, {
      level: 1,
      blurb: "แจกแต้มเริ่มต้น " + DATA.STAT_POINTS_TOTAL + " แต้ม (ไม่บังคับแจกครบ) แต้มที่ล็อกแล้วดึงคืนไม่ได้",
    });
  };

  App.allocMin = function (key) {
    STATS.allocMin(App.allocSess, key);
    App.refreshAlloc();
  };
  App.allocMax = function (key) {
    STATS.allocMax(App.allocSess, key);
    App.refreshAlloc();
  };
  App.allocAdd = function (key, d) {
    STATS.allocAdd(App.allocSess, key, d);
    App.refreshAlloc();
  };

  App.refreshAlloc = function () {
    const heroId =
      App.flow === "pve"
        ? App.afterWin
          ? App.save.heroId
          : App.pendingHero
        : App.pvp && App.pvp.kind === "room"
          ? App.pendingHero
        : App.pvp && App.pvp.phase === "p2-alloc"
          ? App.pvp.p2.heroId
          : App.pvp && App.pvp.p1
            ? App.pvp.p1.heroId
            : App.pendingHero;
    const opts = {
      level: App.save ? App.save.level : 1,
      equip: App.save ? App.save.equip : DATA.emptyEquip(),
      refine: App.save ? App.save.refine : {},
    };
    if (App.afterWin) {
      opts.blurb = "แต้มโบนัส +" + (App.afterWin.bonusPoints || 0) + " หลังชนะบอส — แต้มเดิมดึงคืนไม่ได้";
    } else if (App.pvp && App.pvp.phase === "p1-alloc") {
      opts.blurb = "ผู้เล่น 1 — แจกแต้ม " + DATA.STAT_POINTS_TOTAL + " แต้ม";
    } else if (App.pvp && App.pvp.phase === "p2-alloc") {
      opts.blurb = "ผู้เล่น 2 — แจกแต้ม " + DATA.STAT_POINTS_TOTAL + " แต้ม";
    }
    if (App.cityWinOpen() && UI._cityWinKind === "status") {
      UI.openCityWin("status", App.save);
      return;
    }
    UI.alloc(App.allocSess, heroId, opts);
  };

  App.allocConfirm = function () {
    const committed = STATS.commitSession(App.allocSess);
    if (App.flow === "pve" && App.levelAlloc) {
      App.save.allocated = committed;
      App.save.unspentStatPoints = STATS.sessionRemaining(App.allocSess);
      App.levelAlloc = false;
      App.allocSess = null;
      PVE.syncVitals(App.save);
      App._statusPtsOpened = 0;
      if (App.mapIsLive() || App.cityWinOpen()) {
        UI.closeCityWin && UI.closeCityWin();
        UI.refreshHud && UI.refreshHud(App.save);
        App.syncLiveHero();
        return;
      }
      App.goWorld();
      return;
    }
    if (App.flow === "pve" && App.afterWin) {
      App.save.allocated = committed;
      App.afterWin = null;
      App.allocSess = null;
      PVE.restoreAfterAlloc(App.save);
      App.goBossSelect();
      return;
    }
    if (App.flow === "pve") {
      App.save = PVE.createSave(App.pendingHero, committed, App.pendingName || "");
      if (!App.save.charName) {
        const hero = DATA.HEROES[App.pendingHero];
        App.save.charName = (hero && hero.name) || "";
      }
      PVE.syncVitals(App.save);
      App.allocSess = null;
      App.goCity();
      UI.toast("กด SAVE เพื่อบันทึกด้วย username");
      return;
    }
    if (App.pvp && App.pvp.kind === "room") {
      App.pendingAlloc = committed;
      App.goSkills({ room: true });
      return;
    }
    if (App.pvp && App.pvp.phase === "p1-alloc") {
      App.pvp.p1.allocated = committed;
      App.goSkills({ p1: true });
      return;
    }
    if (App.pvp && App.pvp.phase === "p2-alloc") {
      App.pvp.p2.allocated = committed;
      App.allocSess = null;
      App.goSkills({ p2: true });
    }
  };

  App.goCitySkills = function () {
    if (!App.save) return;
    App.skillFinal = false;
    App.skillMode = "pve";
    const heroId = App.save.heroId;
    const locked = App.save.skillRanks || DATA.defaultSkillRanks(heroId);
    const pool = App.save.skillPoints == null ? DATA.SKILL_POINT_START : App.save.skillPoints;
    App.skillSess = DATA.createSkillSession(locked, pool, heroId);
    if (App.mapIsLive()) {
      UI.openCityWin("skills", App.save);
      return;
    }
    App.goSkills();
  };

  App.goCityStatus = function () {
    if (!App.save) return;
    const pts = App.save.unspentStatPoints || 0;
    App.levelAlloc = true;
    App._statusPtsOpened = pts;
    App.allocSess = STATS.createAllocSession(App.save.allocated, pts);
    App.save.unspentStatPoints = 0;
    if (App.mapIsLive()) {
      UI.openCityWin("status", App.save);
      return;
    }
    App.screen = "alloc";
    UI.alloc(App.allocSess, App.save.heroId, {
      level: App.save.level,
      equip: App.save.equip,
      refine: App.save.refine,
      blurb: "แจกแต้มสถานะ — ไม่บังคับแจกครบ",
    });
  };

  App.goSkills = function (opts) {
    opts = opts || {};
    if (App.mapIsLive() && App.save && !opts.finalVictory && !opts.room && !opts.p1 && !opts.p2) {
      App.goCitySkills();
      return;
    }
    UI.closeCityWin && UI.closeCityWin();
    if (typeof MAP !== "undefined") MAP.teardown();
    App.skillFinal = !!opts.finalVictory;
    if (opts.room) App.skillMode = "room";
    else if (opts.p1) App.skillMode = "p1";
    else if (opts.p2) App.skillMode = "p2";
    else App.skillMode = App.flow === "pve" ? "pve" : "pvp";

    let heroId;
    if (App.save) heroId = App.save.heroId;
    else if (App.skillMode === "p2" && App.pvp && App.pvp.p2) heroId = App.pvp.p2.heroId;
    else if (App.skillMode === "p1" && App.pvp && App.pvp.p1) heroId = App.pvp.p1.heroId;
    else heroId = App.pendingHero;

    let locked;
    let pool;
    if (App.save) {
      locked = App.save.skillRanks || DATA.defaultSkillRanks(heroId);
      pool = App.save.skillPoints == null ? DATA.SKILL_POINT_START : App.save.skillPoints;
    } else {
      locked = DATA.defaultSkillRanks(heroId);
      pool = DATA.SKILL_POINT_START;
    }
    App.skillSess = DATA.createSkillSession(locked, pool, heroId);
    App.screen = "skills";
    UI.skills(App.skillSess, heroId, {
      finalVictory: App.skillFinal,
      pvp: App.flow === "pvp",
    });
  };

  App.skillAdd = function (id) {
    if (!DATA.skillAdd(App.skillSess, id)) {
      UI.toast("เพิ่มแรงก์ไม่ได้");
      return;
    }
    App.refreshSkills();
  };

  App.skillSub = function (id) {
    if (!DATA.skillSub(App.skillSess, id)) {
      UI.toast("ลดแรงก์ไม่ได้");
      return;
    }
    App.refreshSkills();
  };

  App.refreshSkills = function () {
    if (!App.skillSess) return;
    if (App.cityWinOpen() && UI._cityWinKind === "skills") {
      UI.openCityWin("skills", App.save);
      return;
    }
    UI.skills(App.skillSess, App.skillSess.heroId, {
      finalVictory: App.skillFinal,
      pvp: App.flow === "pvp",
      overlay: false,
    });
  };

  App.skillsConfirm = function () {
    const committed = DATA.commitSkillSession(App.skillSess);
    const remain = DATA.skillSessionRemaining(App.skillSess);
    App.skillSess = null;
    if (App.save) {
      App.save.skillRanks = committed;
      App.save.skillPoints = remain;
    }
    if (App.skillFinal) {
      App.skillFinal = false;
      UI.finalWin(DATA.HEROES[App.save.heroId].name);
      return;
    }
    if (App.flow === "pve") {
      if (App.mapIsLive() || App.cityWinOpen()) {
        UI.closeCityWin && UI.closeCityWin();
        UI.refreshHud && UI.refreshHud(App.save);
        App.syncLiveHero();
        return;
      }
      if (!App.save.mapId) App.save.mapId = "city";
      App.goBossSelect();
      return;
    }
    if (App.skillMode === "room") {
      const hid = App.pendingHero;
      ROOM.action({ type: "pick", heroId: hid, allocated: App.pendingAlloc, skillRanks: committed }).then(function (r) {
        if (!r || !r.ok) {
          UI.toast((r && r.error) || "ส่งฮีโร่ไม่สำเร็จ");
          return;
        }
        App.pvp.phase = "lobby";
        UI.roomLobby(r);
      });
      return;
    }
    if (App.skillMode === "p1") {
      App.pvp.p1.skillRanks = committed;
      if (App.pvp.kind === "create") {
        const invite = PVP.makeInvite(App.pvp.p1.heroId, App.pvp.p1.allocated, App.pvp.p1.skillRanks);
        App.pvp.inviteCode = PVP.encode(invite);
        App.pvp.phase = "host-wait";
        App.pvp.mySide = "left";
        UI.inviteShow(App.pvp.inviteCode);
        return;
      }
      App.pvp.phase = "p2-hero";
      UI.heroSelect({ title: "ผู้เล่น 2 เลือกฮีโร่", subtitle: "ผู้เล่น 1 พร้อมแล้ว — ส่งเครื่องให้ผู้เล่น 2" });
      return;
    }
    if (App.skillMode === "p2") {
      App.pvp.p2.skillRanks = committed;
      if (App.pvp.kind === "join") {
        App.pvp.mySide = "right";
        App.pvp.remote = true;
        App.startPvpArena({ local: false, swap: false });
        return;
      }
      App.pvp.remote = false;
      App.startPvpArena({ local: true });
    }
  };

  App.cityHotkeyNext = function (kind, cur) {
    if (kind === "shop") {
      if (cur === "shop") return "potions";
      if (cur === "potions") return "close";
      return "shop";
    }
    if (cur === kind) return "close";
    return kind;
  };

  App.toggleCityWin = function (kind) {
    if (!App.save || App.screen === "arena") return;
    if (typeof WORLD !== "undefined" && WORLD.mode && WORLD.mode() === "arena") return;
    const cur = App.cityWinOpen() ? UI._cityWinKind : null;
    const next = App.cityHotkeyNext(kind, cur);
    if (next === "close") {
      App.closeCityWin();
      return;
    }
    if (cur && cur !== next) App.closeCityWin();
    if (next === "equip") App.goEquip();
    else if (next === "shop") App.goShop();
    else if (next === "potions") App.goPotionShop();
    else if (next === "status") App.goCityStatus();
    else if (next === "skills") App.goCitySkills();
    else if (next === "refine") App.goRefine();
    else if (next === "save") UI.openCityWin("save", App.save);
    else if (next === "farm") App.goFarm();
    else if (next === "farm-mobs") App.goFarmMobs();
    else if (next === "inv") App.goInv();
  };

  App.syncLiveHero = function () {
    if (typeof WORLD !== "undefined" && WORLD.live && WORLD.live() && WORLD.syncLiveHero) {
      WORLD.syncLiveHero(App.save);
      if (UI.refreshHud) UI.refreshHud(App.save);
      if (UI.refreshRt && WORLD.hudModel) UI.refreshRt(WORLD.hudModel());
    }
    if (typeof MAP !== "undefined" && MAP.resumeAutoIfNeeded) MAP.resumeAutoIfNeeded(App.save);
  };

    App.mapIsLive = function () {
    return App.screen === "map" && typeof document !== "undefined" && !!document.getElementById("world-map");
  };

  App.cityWinOpen = function () {
    const el = typeof document !== "undefined" && document.getElementById("city-win-overlay");
    return !!(el && el.className === "show");
  };

  App.closeCityWin = function () {
    if (App.levelAlloc && App.allocSess && UI._cityWinKind === "status") {
      App.save.unspentStatPoints = App._statusPtsOpened || 0;
      App.levelAlloc = false;
      App.allocSess = null;
      App._statusPtsOpened = 0;
    }
    if (App.skillSess && UI._cityWinKind === "skills" && App.skillMode === "pve") {
      App.skillSess = null;
    }
    UI.closeCityWin && UI.closeCityWin();
    if (App.save) UI.refreshHud && UI.refreshHud(App.save);
  };

  App.refreshCityOrPage = function (kind) {
    if (App.cityWinOpen()) {
      UI.openCityWin(kind || UI._cityWinKind || "shop", App.save);
      UI.refreshHud && UI.refreshHud(App.save);
      App.syncLiveHero();
      return;
    }
    if (kind === "shop") UI.shop(App.save);
    else if (kind === "equip") UI.equip(App.save);
    else if (kind === "refine") UI.refine(App.save);
    else if (kind === "potions") UI.potionShop(App.save);
    else if (kind === "skills") App.refreshSkills();
    else if (kind === "status") App.refreshAlloc();
    App.syncLiveHero();
  };

  App.goShop = function () {
    PVE.syncVitals(App.save);
    if (App.mapIsLive()) {
      UI.openCityWin("shop", App.save);
      return;
    }
    if (typeof MAP !== "undefined") MAP.teardown();
    UI.closeCityWin && UI.closeCityWin();
    App.screen = "shop";
    UI.shop(App.save);
  };

  App.goPotionShop = function () {
    PVE.syncVitals(App.save);
    if (App.mapIsLive()) {
      UI.openCityWin("potions", App.save);
      return;
    }
    if (typeof MAP !== "undefined") MAP.teardown();
    UI.closeCityWin && UI.closeCityWin();
    App.screen = "potions";
    UI.potionShop(App.save);
  };

  App.buyPotion = function (id) {
    const r = PVE.buyPotion(App.save, id);
    if (!r.ok) UI.toast(r.reason || "ซื้อไม่ได้");
    else UI.toast("ซื้อแล้ว");
    App.refreshCityOrPage("potions");
  };

  App.buyAmmo = function (id, qty) {
    const r = PVE.buyAmmo(App.save, id, qty);
    if (!r.ok) UI.toast(r.reason || "ซื้อไม่ได้");
    else UI.toast("ซื้อแล้ว");
    App.refreshCityOrPage("potions");
  };

  App.openNpc = function (id) {
    if (id === "gear") App.goShop();
    else if (id === "potion") App.goPotionShop();
    else if (id === "kafra") App.goKafra();
    else if (id === "castle") App.goBossSelect();
  };

  App.goKafra = function () {
    UI.closeCityWin && UI.closeCityWin();
    if (typeof MAP !== "undefined") MAP.teardown();
    PVE.syncVitals(App.save);
    App.screen = "kafra";
    UI.kafra(App.save);
  };

  App.kafraHeal = function () {
    const r = PVE.kafraHeal(App.save);
    if (!r.ok) UI.toast(r.reason || "รักษาไม่ได้");
    else UI.toast("คาฟร้ารักษาเต็มแล้ว (−" + r.cost + " Zeno)");
    UI.kafra(App.save);
  };

  App.openBag = function () {
    if (!App.save) return;
    App.goInv();
  };

  App.closeBag = function () {
    UI.closeBag && UI.closeBag();
    if (UI._cityWinKind === "inv") App.closeCityWin();
  };

  App.goFarm = function () {
    if (!App.save) return;
    PVE.ensureProgress(App.save);
    UI.openCityWin("farm", App.save);
  };

  App.goFarmMobs = function () {
    if (!App.save) return;
    PVE.ensureProgress(App.save);
    UI.openCityWin("farm-mobs", App.save);
  };

  App.toggleFarmMob = function (id) {
    if (!App.save) return;
    PVE.toggleFarmMob(App.save, id);
    UI.openCityWin("farm-mobs", App.save);
    App.syncLiveHero();
  };

  App.setFarmMobsAll = function () {
    if (!App.save) return;
    PVE.setFarmMobsAll(App.save);
    UI.openCityWin("farm-mobs", App.save);
    App.syncLiveHero();
  };

  App.setFarmMobsNone = function () {
    if (!App.save) return;
    PVE.setFarmMobsNone(App.save);
    UI.openCityWin("farm-mobs", App.save);
    App.syncLiveHero();
  };

  App.goInv = function () {
    if (!App.save) return;
    PVE.ensureProgress(App.save);
    UI.openCityWin("inv", App.save);
  };

  App.toggleSit = function () {
    if (!App.save || !(App.mapIsLive && App.mapIsLive())) return;
    var on = false;
    if (typeof MAP !== "undefined" && MAP.toggleSit) on = MAP.toggleSit();
    else if (typeof WORLD !== "undefined" && WORLD.toggleSit) on = WORLD.toggleSit();
    if (UI && UI.toast) UI.toast(on ? "นั่งพัก" : "ยืนขึ้น");
  };

  App.setAutoFarm = function (on) {
    if (!App.save) return;
    App.save.autoFarm = !!on;
    UI.toast(App.save.autoFarm ? "Auto Farm เปิด" : "Auto Farm ปิด");
    UI.refreshHud && UI.refreshHud(App.save);
    App.syncLiveHero();
    if (App.cityWinOpen() && UI._cityWinKind === "farm") UI.openCityWin("farm", App.save);
  };

  App.setFarmSit = function (spec) {
    if (!App.save) return;
    PVE.setFarmSit(App.save, spec);
    UI.openCityWin("farm", App.save);
    App.syncLiveHero();
  };

  App.setFarmSkill = function (slot, skillId) {
    if (!App.save) return;
    PVE.setFarmSkill(App.save, slot, skillId);
    UI.openCityWin("farm", App.save);
    App.syncLiveHero();
  };

  App.setFarmPot = function (slot, spec) {
    if (!App.save) return;
    PVE.setFarmPot(App.save, slot, spec);
    UI.openCityWin("farm", App.save);
    App.syncLiveHero();
  };

  App._farmPickSkill = function (skillId) {
    App._farmPickedSkill = skillId || null;
    if (typeof document === "undefined") return;
    var pal = document.querySelectorAll(".farm-pal-skill");
    pal.forEach(function (el) {
      el.classList.toggle("picked", el.getAttribute("data-skill") === App._farmPickedSkill);
    });
  };

  App.setInvTab = function (tab) {
    UI._invTab = tab === "equip" || tab === "mat" ? tab : "use";
    if (App.save) UI.openCityWin("inv", App.save);
  };

  App.usePotion = function (id) {
    if (!App.save) return;
    const unit =
      (typeof WORLD !== "undefined" && WORLD.live && WORLD.live() && WORLD.playerUnit()) ||
      (App.combat && !App.combat.over ? App.combat.left : null);
    const r = PVE.usePotion(App.save, id, unit);
    if (!r.ok) {
      UI.toast(r.reason || "ใช้ยาไม่ได้");
      return;
    }
    const item = DATA.POTIONS[id];
    if (r.buff) UI.toast(item.name + " · " + item.desc);
    else UI.toast((item && item.name) + " +" + (r.healedHp || 0) + " HP +" + (r.healedMp || 0) + " MP");
    if (App.cityWinOpen() && UI._cityWinKind === "inv") {
      UI.openCityWin("inv", App.save);
    } else if (document.getElementById("bag-overlay") && document.getElementById("bag-overlay").className === "show") {
      UI.openBag(App.save);
    }
    if (App.combat && App.screen === "combat") App.updateGauges();
    UI.refreshHud(App.save);
    if (typeof WORLD !== "undefined" && WORLD.live && WORLD.live() && UI.refreshRt) {
      UI.refreshRt(WORLD.hudModel());
    }
    App.syncLiveHero();
  };

  App.toggleAutoFarm = function () {
    if (!App.save) return;
    App.save.autoFarm = !App.save.autoFarm;
    UI.toast(App.save.autoFarm ? "Auto Farm เปิด" : "Auto Farm ปิด");
    UI.refreshHud(App.save);
    App.syncLiveHero();
    if (App.cityWinOpen() && UI._cityWinKind === "farm") UI.openCityWin("farm", App.save);
    if (!App.save.autoFarm && typeof MAP !== "undefined" && App.screen === "map") {
      /* walker stops on next tick via save flag */
    }
  };

  App.spendStatPoints = function () {
    if (!App.save) return;
    if (App.mapIsLive()) {
      App.goCityStatus();
      return;
    }
    const pts = App.save.unspentStatPoints || 0;
    if (!pts) {
      UI.toast("ไม่มีแต้มให้แจก");
      return;
    }
    UI.closeCityWin && UI.closeCityWin();
    if (typeof MAP !== "undefined") MAP.teardown();
    App.levelAlloc = true;
    App._statusPtsOpened = pts;
    App.allocSess = STATS.createAllocSession(App.save.allocated, pts);
    App.save.unspentStatPoints = 0;
    App.screen = "alloc";
    UI.alloc(App.allocSess, App.save.heroId, {
      level: App.save.level,
      equip: App.save.equip,
      refine: App.save.refine,
      blurb: "แต้มจาก Base Level Up +" + pts + " — ไม่บังคับแจกครบ แต้มที่เหลือเก็บไว้ได้",
    });
  };

  App.backFromSkills = function () {
    if (App.save && App.save.mapId) App.goWorld();
    else App.goEquip();
  };

  App.goWorld = function () {
    if (!App.save) return;
    PVE.ensureProgress(App.save);
    const id = App.save.mapId || "city";
    if (id === "field") App.goField();
    else if (id === "bosses") App.goBossSelect();
    else App.goCity();
  };

  App.goCity = function (opts) {
    opts = opts || {};
    stopLoop();
    UI.closeCityWin && UI.closeCityWin();
    if (typeof MAP !== "undefined") MAP.teardown();
    App.combat = null;
    App.save.mapId = "city";
    if (opts.fromField) {
      const gs = (typeof MAP !== "undefined" && MAP.ZONES && MAP.ZONES.city && MAP.ZONES.city.gateSpawn) || { x: 75, y: 40 };
      App.save.cityPos = { x: gs.x, y: gs.y };
    }
    App.screen = "map";
    if (typeof AUDIO !== "undefined" && AUDIO.bgm) AUDIO.bgm("city");
    UI.worldMap(App.save);
  };

  App.goField = function () {
    stopLoop();
    UI.closeCityWin && UI.closeCityWin();
    if (typeof MAP !== "undefined") MAP.teardown();
    App.combat = null;
    App.save.mapId = "field";
    const fspawn = (typeof MAP !== "undefined" && MAP.ZONES && MAP.ZONES.field && MAP.ZONES.field.spawn) || { x: 5, y: 94 };
    if (!App.save.fieldPos || (App.save.fieldPos.x === 2 && App.save.fieldPos.y === 7)) {
      App.save.fieldPos = { x: fspawn.x, y: fspawn.y };
    }
    App.screen = "map";
    if (typeof AUDIO !== "undefined" && AUDIO.bgm) AUDIO.bgm("field");
    UI.worldMap(App.save);
  };

  App.goBossSelect = function () {
    if (!App.save) return;
    stopLoop();
    if (typeof WORLD !== "undefined" && WORLD.teardown) WORLD.teardown();
    if (typeof MAP !== "undefined") MAP.teardown();
    if (UI.closeBag) UI.closeBag();
    UI.closeCityWin && UI.closeCityWin();
    if (App.save.hp != null && App.save.hp <= 0) {
      PVE.respawnInCity(App.save);
    }
    App.combat = null;
    App._ended = false;
    App.flow = "pve";
    App.screen = "boss-select";
    UI.bossSelect(App.save);
  };

  App.pickBoss = function (bossId) {
    if (!App.save) return;
    stopLoop();
    if (typeof WORLD !== "undefined" && WORLD.teardown) WORLD.teardown();
    if (typeof MAP !== "undefined") MAP.teardown();
    if (UI.closeBag) UI.closeBag();
    PVE.syncVitals(App.save);
    App._ended = false;
    if (typeof AUDIO !== "undefined" && AUDIO.duckBgm) AUDIO.duckBgm();
    App.combat = PVE.startFight(App.save, bossId);
    App.flow = "pve";
    App.startCombatLoop();
  };

  App.goBossMap = function () {
    App.goBossSelect();
  };

  App.buyItem = function (id) {
    const r = PVE.buy(App.save, id);
    if (!r.ok) UI.toast(r.reason || "ซื้อไม่ได้");
    else UI.toast("ซื้อแล้ว");
    App.refreshCityOrPage("shop");
  };

  App.inProntera = function () {
    return PVE.inProntera(App.save);
  };

  App.qtyOf = function (inputId, max) {
    max = Math.max(1, Math.floor(Number(max) || 1));
    var el = typeof document !== "undefined" && document.getElementById(inputId);
    var n = el ? Math.floor(Number(el.value) || 1) : 1;
    if (n < 1) n = 1;
    if (n > max) n = max;
    return n;
  };

  App._refreshAfterSellDrop = function () {
    if (!App.save) return;
    if (App.cityWinOpen && App.cityWinOpen()) {
      var kind = (typeof UI !== "undefined" && UI._cityWinKind) || App.screen || "inv";
      if (kind === "inv") {
        UI.openCityWin("inv", App.save);
        if (UI.refreshHud) UI.refreshHud(App.save);
        App.syncLiveHero();
        return;
      }
      App.refreshCityOrPage(kind);
      return;
    }
    if (App.screen === "shop" || App.screen === "potions" || App.screen === "equip") {
      App.refreshCityOrPage(App.screen);
      return;
    }
    App.syncLiveHero();
  };

  App.sellItem = function (id, qty) {
    if (!App.save) return;
    if (!PVE.inProntera(App.save)) {
      UI.toast("ขายได้แค่ในพรอนเทรา");
      return;
    }
    var r = PVE.sellItem(App.save, id, qty);
    if (!r.ok) UI.toast(r.reason || "ขายไม่ได้");
    else UI.toast(r.toast);
    App.syncLiveHero();
    App._refreshAfterSellDrop();
  };

  App.dropItem = function (id, qty, confirmed) {
    if (!App.save) return;
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var kind = PVE.itemKind(id);
    var name = DATA.lootName(id);
    if (kind === "gear") qty = 1;
    if ((kind === "gear" || qty > 1) && !confirmed) {
      if (typeof window !== "undefined" && window.confirm) {
        if (!window.confirm("โยนทิ้ง " + name + " ×" + qty + "?")) return;
      }
    }
    var r = PVE.dropItem(App.save, id, qty);
    if (!r.ok) UI.toast(r.reason || "โยนทิ้งไม่ได้");
    else UI.toast(r.toast);
    App.syncLiveHero();
    App._refreshAfterSellDrop();
  };

  App.goEquip = function () {
    PVE.syncVitals(App.save);
    if (App.mapIsLive()) {
      UI.openCityWin("equip", App.save);
      return;
    }
    if (typeof MAP !== "undefined") MAP.teardown();
    UI.closeCityWin && UI.closeCityWin();
    App.screen = "equip";
    UI.equip(App.save);
  };

  App.goRefine = function () {
    if (!App.save) return;
    PVE.syncVitals(App.save);
    if (App.mapIsLive()) {
      UI.openCityWin("refine", App.save);
      return;
    }
    if (typeof MAP !== "undefined") MAP.teardown();
    UI.closeCityWin && UI.closeCityWin();
    App.screen = "refine";
    UI.refine(App.save);
  };

  App.attemptRefine = function (itemId) {
    if (!App.save) return;
    const r = PVE.attemptRefine(App.save, itemId);
    if (r.ok && typeof AUDIO !== "undefined" && AUDIO.play) {
      AUDIO.play("ui_refine_hit", { bus: "ui" });
      const resultId = r.success ? "ui_refine_ok" : "ui_refine_fail";
      setTimeout(function () {
        AUDIO.play(resultId, { bus: "ui" });
      }, 150);
    }
    if (!r.ok) {
      UI.toast(r.reason || "ตีบวกไม่ได้");
    } else if (r.success) {
      UI.toast("สำเร็จ! +" + r.plus);
    } else {
      UI.toast("ล้มเหลว — คง +" + r.plus + " (เสีย " + r.cost + " Zeno ไม่พัง)");
    }
    App.refreshCityOrPage("refine");
  };

  App.setEquip = function (slot, itemId) {
    PVE.equipItem(App.save, slot, itemId || null);
    App.refreshCityOrPage("equip");
  };

  App.toggleInvItem = function (itemId) {
    const r = PVE.toggleInventoryItem(App.save, itemId);
    if (!r || !r.ok) UI.toast((r && r.reason) || "สวมใส่ไม่ได้");
    if (App.cityWinOpen() && UI._cityWinKind === "inv") {
      UI.openCityWin("inv", App.save);
      UI.refreshHud && UI.refreshHud(App.save);
      App.syncLiveHero();
      return;
    }
    App.refreshCityOrPage("equip");
  };

  App.unequipSlot = function (slotId) {
    PVE.unequipSlot(App.save, slotId);
    App.refreshCityOrPage("equip");
  };

  App.goMap = function () {
    App.goBossSelect();
  };

  App.startPveFight = function () {
    App.goBossSelect();
  };

  App.startFieldFight = function () {
    App.goField();
  };

  App.afterFarmWin = function () {
    PVE.restoreAfterAlloc(App.save);
    App.afterWin = null;
    App.goBossSelect();
  };

  App.afterDefeatCity = function () {
    PVE.respawnInCity(App.save);
    App.goCity();
  };

  App.announceLevelUps = function (exp) {
    if (!exp) return;
    (exp.baseUps || []).forEach(function (u) {
      UI.toast("Base Level Up! " + u.from + " → " + u.to + " · +10 แต้มสถานะ", 2800);
    });
    (exp.jobUps || []).forEach(function (u) {
      UI.toast("Job Level Up! " + u.from + " → " + u.to + " · +1 แต้มสกิล", 2800);
    });
  };

  App.continueAfterVictory = function () {
    App.afterWinAlloc();
  };

  App.pvpLocal = function () {
    App.pvp = { kind: "local", phase: "p1-hero", p1: null, p2: null, remote: false };
    App.flow = "pvp";
    UI.heroSelect({ title: "ผู้เล่น 1 เลือกฮีโร่", subtitle: "โหมด Local — ไม่มีอุปกรณ์" });
  };

  App.pvpCreate = function () {
    App.pvp = { kind: "create", phase: "p1-hero", p1: null, p2: null, remote: true, mySide: "left" };
    App.flow = "pvp";
    UI.heroSelect({ title: "สร้างคำเชิญ — เลือกฮีโร่ของคุณ", subtitle: "หลังแจกแต้มจะได้โค้ดคำเชิญ" });
  };

  App.pvpJoinScreen = function () {
    App.pvp = { kind: "join", phase: "join-paste", remote: true, mySide: "right" };
    App.flow = "pvp";
    UI.joinScreen();
  };

  App.acceptInvite = function () {
    const raw = document.getElementById("invite-in").value;
    try {
      const inv = PVP.parseInvite(raw);
      App.pvp.p1 = inv.p1;
      App.pvp.phase = "p2-hero";
      UI.heroSelect({
        title: "เข้าร่วมดวล — เลือกฮีโร่ของคุณ",
        subtitle: "คู่ต่อสู้: " + DATA.HEROES[inv.p1.heroId].name,
      });
    } catch (e) {
      UI.toast(e.message || "โค้ดไม่ถูกต้อง");
    }
  };

  App.copyInvite = function () {
    copyText("invite-out");
  };
  App.copyStateOut = function () {
    copyText("state-out");
  };

  App.loadStateCode = function () {
    const raw = document.getElementById("state-in") && document.getElementById("state-in").value;
    if (!raw) {
      UI.toast("วางโค้ดก่อน");
      return;
    }
    try {
      const parsed = PVP.parseState(raw);
      App._ended = !!parsed.state.over;
      App.combat = parsed.state;
      if (!App.pvp) App.pvp = { kind: "create", remote: true, mySide: "left" };
      App.pvp.remote = true;
      if (App.pvp.mySide == null) App.pvp.mySide = "left";
      if (App.combat.over) {
        stopLoop();
        const w = App.combat.winner === "left" ? App.combat.left : App.combat.right;
        UI.pvpResult(w.name);
        return;
      }
      App.startPvpArena({ local: false, fromState: true });
    } catch (e) {
      UI.toast(e.message || "โหลดโค้ดไม่สำเร็จ");
    }
  };

  App.makeRemoteCode = function () {
    if (!App.combat) return "";
    return PVP.encode(PVP.makeStateCode(App.combat, { from: App.pvp && App.pvp.mySide }));
  };

  App.isMyTurn = function () {
    if (!App.combat || !App.combat.waitingAction) return false;
    if (!App.pvp || !App.pvp.remote) return true;
    return App.combat.waitingAction === App.pvp.mySide;
  };

  App.actorIsPlayer = function (actor) {
    if (!actor) return false;
    if (App.flow === "pve") return actor.side === "left";
    if (App.pvp && App.pvp.remote) return actor.side === App.pvp.mySide;
    return true;
  };

  App.renderCombat = function () {
    if (!App.combat) return;
    const opts = { skillOpts: {} };
    const acting = App.combat.waitingAction;
    const actor = acting === "left" ? App.combat.left : acting === "right" ? App.combat.right : null;
    if (App.pvp && App.pvp.kind === "local" && actor) {
      opts.skillOpts.who = (actor.side === "left" ? "ผู้เล่น 1 · " : "ผู้เล่น 2 · ") + actor.name;
    }
    if (App.pvp && App.pvp.remote) {
      opts.remotePanel = true;
      opts.stateCode = App.makeRemoteCode();
      if (actor && !App.isMyTurn()) {
        opts.skillOpts.locked = true;
        opts.skillOpts.lockMsg = "ตาของ " + actor.name + " — คัดลอกโค้ดสถานะส่งให้เพื่อน แล้วรอโค้ดกลับ";
      }
      if (!actor && App.pvp.remote) {
        opts.skillOpts.locked = false;
      }
    }
    if (App.pvp && App.pvp.kind === "room") {
      opts.remotePanel = false;
      if (actor && !App.isMyTurn()) {
        opts.skillOpts.locked = true;
        opts.skillOpts.lockMsg = "รอ " + actor.name + " เลือกสกิล";
      }
    }
    UI.combat(App.combat, opts);
    if (typeof FX !== "undefined") FX.play(App.combat);
  };

  App.useSkill = function (skillId) {
    if (typeof WORLD !== "undefined" && WORLD.live && WORLD.live()) {
      if (WORLD.noteManual) WORLD.noteManual(1800);
      WORLD.cast(skillId, "left");
      return;
    }
    if (!App.combat || App.combat.over) return;
    const side = App.combat.waitingAction;
    if (!side) return;
    if (App.pvp && App.pvp.kind === "room") {
      if (side !== App.pvp.mySide) {
        UI.toast("ยังไม่ถึงตาคุณ");
        return;
      }
      if (App.pvp.seat === "guest") {
        ROOM.action({ type: "skill", skillId: skillId }).then(function (r) {
          if (!r || !r.ok) UI.toast((r && r.error) || "ส่งสกิลไม่สำเร็จ");
        });
        return;
      }
    }
    if (App.pvp && App.pvp.remote && App.pvp.kind !== "room" && side !== App.pvp.mySide) {
      UI.toast("ยังไม่ถึงตาคุณ");
      return;
    }
    const actor = side === "left" ? App.combat.left : App.combat.right;
    const r = COMBAT.executeSkill(App.combat, actor, skillId);
    if (!r || !r.ok) {
      UI.toast("ใช้สกิลไม่ได้");
      return;
    }
    App.combat.waitingAction = null;
    if (App.pvp && App.pvp.kind === "room" && App.pvp.seat === "host") {
      ROOM.pushSnapshot(App.combat, true);
    }
    if (App.combat.over) {
      App.onCombatEnd();
      return;
    }
    App.renderCombat();
  };

  App.onCombatEnd = function () {
    if (App._ended) return;
    App._ended = true;
    stopLoop();
    const state = App.combat;
    if (App.flow === "pve") {
      PVE.snapshotVitals(App.save, state.left);
      if (App.save.fightKind === "field") {
        if (state.winner === "left") {
          const reward = PVE.applyFieldRewards(App.save, App.save.currentMonsterId);
          if (App._fieldMob && typeof MAP !== "undefined" && MAP.markMobDead) {
            MAP.markMobDead(App._fieldMob.x, App._fieldMob.y);
          }
          const loot = (reward.loot || []).map(function (id) {
            return DATA.lootName ? DATA.lootName(id) : id;
          }).join(", ");
          let msg = "+" + reward.baseExp + " Base EXP · +" + reward.jobExp + " Job EXP · +" + reward.zeno + " Zeno";
          if (loot) msg += " · ได้ " + loot;
          (reward.baseUps || []).forEach(function (u) { msg += " · Base Level Up! " + u.from + " → " + u.to; });
          (reward.jobUps || []).forEach(function (u) { msg += " · Job Level Up! " + u.from + " → " + u.to; });
          UI.toast(msg, 3200);
          if (typeof MAP !== "undefined" && MAP.pauseAuto) MAP.pauseAuto(700);
          App.goField();
        } else {
          UI.defeat(state.right.name, { city: true });
        }
        return;
      }
      if (state.winner === "left") {
        const reward = PVE.applyWinRewards(App.save, App.save.currentBossId);
        App.afterWin = reward;
        UI.betweenWin(App.save, reward);
      } else {
        UI.defeat(state.right.name, { city: true, retryBoss: true });
      }
      return;
    }
    const w = state.winner === "left" ? state.left : state.right;
    if (App.pvp && App.pvp.kind === "room") {
      if (App.pvp.seat === "host") ROOM.pushSnapshot(state, true);
      UI.pvpResult(w.name);
      return;
    }
    if (App.pvp && App.pvp.remote) {
      UI.pvpResult(w.name, App.makeRemoteCode());
      return;
    }
    UI.pvpResult(w.name);
  };

  App.afterWinAlloc = function () {
    const bonus = (App.afterWin && App.afterWin.bonusPoints) || 0;
    const extra = App.save.unspentStatPoints || 0;
    App.save.unspentStatPoints = 0;
    App.allocSess = STATS.createAllocSession(App.save.allocated, bonus + extra);
    App.screen = "alloc";
    UI.alloc(App.allocSess, App.save.heroId, {
      level: App.save.level,
      equip: App.save.equip,
      refine: App.save.refine,
      blurb: "แต้มโบนัส +" + bonus + (extra ? " และจากเลเวล +" + extra : "") + " หลังชนะบอส — แต้มเดิมดึงคืนไม่ได้",
    });
  };

  App.forfeit = function () {
    stopLoop();
    if (App.flow === "pve" && App.save) {
      if (App.combat) PVE.snapshotVitals(App.save, App.combat.left);
      App.goCity();
      return;
    }
    App.goHome();
  };

  App.tryAutoHero = function () {
    if (!App.combat || App.combat.over || !App.combat.waitingAction) return false;
    if (App.flow !== "pve" || !App.save || !App.save.autoFarm) return false;
    if (App.save.fightKind !== "field") return false;
    const actor = App.combat.waitingAction === "left" ? App.combat.left : App.combat.right;
    if (!App.actorIsPlayer(actor)) return false;
    PVE.maybeAutoPotion(App.save, App.combat.left);
    const dHp = App.combat.left.maxHp ? App.combat.left.hp / App.combat.left.maxHp : 1;
    if (dHp < (DATA.AUTO_FARM_STOP_HP || 0.15) && !PVE.hasHpPotion(App.save)) {
      App.save.autoFarm = false;
      UI.toast("HP ต่ำและยาหมด — หยุด Auto Farm");
      UI.refreshHud(App.save);
      return false;
    }
    const id = COMBAT.chooseHeroAutoSkill(actor);
    if (!id) return false;
    const r = COMBAT.executeSkill(App.combat, actor, id);
    if (!r || !r.ok) return false;
    App.combat.waitingAction = null;
    return true;
  };

  App.startCombatLoop = function () {
    stopLoop();
    App.screen = "combat";
    App.renderCombat();
    let aiLock = false;
    App.timer = setInterval(function () {
      if (!App.combat || App.combat.over) {
        if (App.combat && App.combat.over) App.onCombatEnd();
        return;
      }
      if (App.combat.waitingAction) {
        const actor = App.combat.waitingAction === "left" ? App.combat.left : App.combat.right;
        if (!App.actorIsPlayer(actor) && !aiLock) {
          aiLock = true;
          setTimeout(function () {
            if (!App.combat || App.combat.over || !App.combat.waitingAction) {
              aiLock = false;
              return;
            }
            const a = App.combat.waitingAction === "left" ? App.combat.left : App.combat.right;
            COMBAT.autoAct(App.combat, a);
            App.combat.waitingAction = null;
            aiLock = false;
            if (App.combat.over) App.onCombatEnd();
            else App.renderCombat();
          }, 420);
        }
        return;
      }
      if (aiLock) return;
      const stepped = COMBAT.tickAtb(App.combat);
      if (App.combat.over) {
        App.onCombatEnd();
        return;
      }
      if (stepped) App.renderCombat();
      else {
        const atbL = App.elAtb();
        if (atbL) {
          /* lightweight bar update without full rerender every 20ms would be nicer;
             full rerender is ok at 20ms for two bars — keep it simple and readable. */
        }
      }
    }, DATA.SPEED_TICK_MS);
  };

  App.elAtb = function () {
    return document.querySelector(".atb-fill");
  };

  /* Smooth ATB: rerender gauges only when waiting, else update widths. */
  const _tickRender = App.startCombatLoop;
  App.startCombatLoop = function () {
    stopLoop();
    App.screen = "combat";
    App.renderCombat();
    let aiLock = false;
    let lastWait = null;
    App.timer = setInterval(function () {
      if (!App.combat || App.combat.over) {
        if (App.combat && App.combat.over) App.onCombatEnd();
        return;
      }
      if (App.combat.waitingAction) {
        if (lastWait !== App.combat.waitingAction) {
          lastWait = App.combat.waitingAction;
          App.renderCombat();
        }
        const actor = App.combat.waitingAction === "left" ? App.combat.left : App.combat.right;
        if (App.flow === "pve" && App.save && App.save.autoFarm && App.save.fightKind === "field") {
          if (App.combat.left) PVE.maybeAutoPotion(App.save, App.combat.left);
          if (!aiLock && App.actorIsPlayer(actor)) {
            aiLock = true;
            setTimeout(function () {
              aiLock = false;
              if (!App.combat || App.combat.over || !App.combat.waitingAction) return;
              if (App.tryAutoHero()) {
                lastWait = null;
                if (App.combat.over) App.onCombatEnd();
                else App.renderCombat();
              }
            }, 280);
          }
        }
        if (App.pvp && App.pvp.kind === "room") {
          if (App.pvp.seat === "host" && actor.side !== App.pvp.mySide) {
            App._roomApplyPending();
          }
          return;
        }
        if (!App.actorIsPlayer(actor) && !aiLock) {
          aiLock = true;
          setTimeout(function () {
            if (!App.combat || App.combat.over || !App.combat.waitingAction) {
              aiLock = false;
              return;
            }
            const a = App.combat.waitingAction === "left" ? App.combat.left : App.combat.right;
            COMBAT.autoAct(App.combat, a);
            App.combat.waitingAction = null;
            lastWait = null;
            aiLock = false;
            if (App.pvp && App.pvp.kind === "room" && App.pvp.seat === "host") {
              ROOM.pushSnapshot(App.combat, true);
            }
            if (App.combat.over) App.onCombatEnd();
            else App.renderCombat();
          }, 450);
        }
        return;
      }
      if (App.pvp && App.pvp.kind === "room" && App.pvp.seat === "guest") {
        return;
      }
      if (aiLock) return;
      const stepped = COMBAT.tickAtb(App.combat);
      if (App.combat.over) {
        App.onCombatEnd();
        return;
      }
      if (stepped) {
        lastWait = App.combat.waitingAction;
        App.renderCombat();
        if (App.pvp && App.pvp.kind === "room" && App.pvp.seat === "host") {
          ROOM.pushSnapshot(App.combat, true);
        }
      } else {
        App.updateGauges();
        if (App.pvp && App.pvp.kind === "room" && App.pvp.seat === "host") {
          App._roomAtbN = (App._roomAtbN || 0) + 1;
          if (App._roomAtbN >= 12) {
            App._roomAtbN = 0;
            ROOM.pushSnapshot(App.combat, false);
          }
        }
      }
    }, DATA.SPEED_TICK_MS);
  };

  App.updateGauges = function () {
    if (!App.combat) return;
    const units = [App.combat.left, App.combat.right];
    document.querySelectorAll(".fighter").forEach(function (card, i) {
      const u = units[i];
      if (!u) return;
      card.querySelectorAll(".bar-wrap").forEach(function (wrap) {
        const fill = wrap.querySelector(".bar-fill");
        const lab = wrap.querySelector(".bar-label span:last-child");
        if (!fill) return;
        if (wrap.classList.contains("bar-atb")) {
          const pct = Math.max(0, Math.min(100, (u.atb / DATA.SPEED_MAX) * 100));
          fill.style.width = pct.toFixed(2) + "%";
          if (lab) lab.textContent = UI.fmt(u.atb, 0) + " / 1000";
        } else if (wrap.classList.contains("bar-hp")) {
          fill.style.width = (u.maxHp ? (100 * u.hp / u.maxHp) : 0).toFixed(2) + "%";
          if (lab) lab.textContent = UI.fmt(u.hp, 0) + " / " + UI.fmt(u.maxHp, 0);
        } else if (wrap.classList.contains("bar-mp")) {
          fill.style.width = (u.maxMp ? (100 * u.mp / u.maxMp) : 0).toFixed(2) + "%";
          if (lab) lab.textContent = UI.fmt(u.mp, 0) + " / " + UI.fmt(u.maxMp, 0);
        }
      });
    });
  };

  App._roomApplyPending = function () {
    if (!App.combat || App.combat.over) return;
    const snap = typeof ROOM !== "undefined" ? ROOM.snapshot : null;
    const sid = snap && snap.pendingSkill;
    if (!sid || App.combat.waitingAction !== "right") return;
    const actor = App.combat.right;
    const r = COMBAT.executeSkill(App.combat, actor, sid);
    ROOM.action({ type: "ack_skill" });
    if (!r || !r.ok) return;
    App.combat.waitingAction = null;
    ROOM.pushSnapshot(App.combat, true);
    if (App.combat.over) App.onCombatEnd();
    else App.renderCombat();
  };

  App._roomSyncCombat = function (snap) {
    if (!snap || !snap.combat) return;
    if (App.pvp && App.pvp.seat === "host" && App.combat && !App.combat.over) {
      return;
    }
    const incoming = COMBAT.deserializeState(snap.combat);
    const sameTurn =
      App.combat &&
      App.combat.waitingAction === incoming.waitingAction &&
      App.combat.turnCount === incoming.turnCount &&
      !(incoming.fx && incoming.fx.length);
    App.combat = incoming;
    App.screen = "combat";
    if (incoming.over) {
      App.onCombatEnd();
      return;
    }
    if (sameTurn && document.querySelector(".combat-screen")) {
      App.updateGauges();
      return;
    }
    App.renderCombat();
  };

  App.onRoomUpdate = function (snap) {
    if (!snap) return;
    if (snap.dead || snap.phase === "dead") {
      stopLoop();
      ROOM.stopLoop();
      UI.roomGone(snap.msg || "เพื่อนออกจากห้อง");
      return;
    }
    if (snap.phase === "lobby" || (!snap.phase && App.screen !== "combat")) {
      if (App.screen === "alloc" || (App.pvp && App.pvp.phase === "alloc")) return;
      if (App.screen === "hero") return;
      UI.roomLobby(snap);
      if (snap.host && snap.guest && snap.host.ready && snap.guest.ready && App.pvp.seat === "host" && !App.combat) {
        App.roomStartFight(snap);
      }
      return;
    }
    if (snap.phase === "fight" || snap.phase === "over") {
      if (App.screen === "arena") return;
      if (App.pvp.seat === "guest" && snap.combat && App.screen !== "arena") {
        App.combat = COMBAT.deserializeState(snap.combat);
        App.startPvpArena({ local: false, fromCombat: true });
        return;
      }
      if (App.pvp.seat === "guest" || !App.combat) {
        App._roomSyncCombat(snap);
      }
      if (App.pvp.seat === "host" && snap.pendingSkill) {
        App._roomApplyPending();
      }
    }
  };

  App.roomStartFight = function (snap) {
    if (App.combat) return;
    const h = snap.host;
    const g = snap.guest;
    App._ended = false;
    App.combat = PVP.createLocalFight(
      { heroId: h.heroId, allocated: App._roomAlloc(h), skillRanks: h.skillRanks },
      { heroId: g.heroId, allocated: App._roomAlloc(g), skillRanks: g.skillRanks }
    );
    App.combat.mode = "pvp-room";
    App.pvp.remote = true;
    App.pvp.mySide = "left";
    ROOM.pushSnapshot(App.combat, true);
    App.startPvpArena({ local: false, fromCombat: true });
  };

  App._roomAlloc = function (who) {
    if (who && who.allocated) return who.allocated;
    return DATA.emptyAllocated();
  };

  App.pvpRoomCreate = function () {
    if (typeof ROOM === "undefined" || !ROOM.available()) {
      UI.roomNeedServer();
      return;
    }
    ROOM.loadInfo().catch(function () {});
    ROOM.create("เจ้าของห้อง").then(function (r) {
      App.flow = "pvp";
      App.pvp = { kind: "room", seat: "host", mySide: "left", remote: true, phase: "lobby" };
      App.screen = "room";
      ROOM.startLoop(App.onRoomUpdate);
      UI.roomLobby(r);
    }).catch(function (e) {
      UI.toast(e.message || "สร้างห้องไม่สำเร็จ");
    });
  };

  App.pvpRoomJoinScreen = function () {
    if (typeof ROOM === "undefined" || !ROOM.available()) {
      UI.roomNeedServer();
      return;
    }
    UI.roomJoinScreen();
  };

  App.pvpRoomJoin = function () {
    const code = (document.getElementById("room-code") && document.getElementById("room-code").value) || "";
    const name = (document.getElementById("room-name") && document.getElementById("room-name").value) || "ผู้เข้าร่วม";
    ROOM.loadInfo().catch(function () {});
    ROOM.join(code, name).then(function (r) {
      App.flow = "pvp";
      App.pvp = { kind: "room", seat: "guest", mySide: "right", remote: true, phase: "lobby" };
      App.screen = "room";
      ROOM.startLoop(App.onRoomUpdate);
      UI.roomLobby(r);
    }).catch(function (e) {
      UI.toast(e.message || "เข้าห้องไม่สำเร็จ");
    });
  };

  App.copyRoomCode = function () {
    const el = document.getElementById("room-code-big");
    const t = el ? el.textContent : (ROOM.code || "");
    try {
      navigator.clipboard.writeText(t);
      UI.toast("คัดลอกแล้ว");
    } catch (e) {
      UI.toast(t);
    }
  };

  App.roomSetName = function () {
    const el = document.getElementById("room-name");
    const name = el ? el.value.trim() : "";
    if (!name) return;
    ROOM.action({ type: "name", name: name }).then(function (r) {
      if (r && r.ok) UI.roomLobby(r);
    });
  };

  App.roomChooseHero = function () {
    App.pvp.phase = "hero";
    App.screen = "hero";
    UI.heroSelect({ title: "เลือกฮีโร่ — ห้อง " + (ROOM.code || ""), subtitle: "แจกแต้ม " + DATA.STAT_POINTS_TOTAL + " แล้วกลับไปล็อบบี้ · ไม่มีอุปกรณ์" });
  };

  App.roomReady = function () {
    const snap = ROOM.snapshot || {};
    const me = App.pvp.seat === "guest" ? snap.guest : snap.host;
    const next = !(me && me.ready);
    ROOM.action({ type: "ready", ready: next }).then(function (r) {
      if (!r || !r.ok) {
        UI.toast((r && r.error) || "กดพร้อมไม่สำเร็จ");
        return;
      }
      UI.roomLobby(r);
    });
  };

  App.useSkillP2 = function (skillId) {
    if (typeof WORLD !== "undefined" && WORLD.live && WORLD.live()) WORLD.cast(skillId, "right");
  };

  App.startPvpArena = function (opts) {
    opts = opts || {};
    stopLoop();
    if (typeof MAP !== "undefined") MAP.teardown();
    let left;
    let right;
    if (opts.fromState && App.combat) {
      left = App.combat.left;
      right = App.combat.right;
    } else if (opts.fromCombat && App.combat) {
      left = App.combat.left;
      right = App.combat.right;
    } else if (App.pvp && App.pvp.p1 && App.pvp.p2) {
      const st = PVP.createLocalFight(App.pvp.p1, App.pvp.p2);
      left = st.left;
      right = st.right;
      App.combat = st;
    } else {
      UI.toast("ยังไม่มีคู่ดวล");
      return;
    }
    App.screen = "arena";
    App._ended = false;
    UI.arena({
      left: left,
      right: right,
      local: !!opts.local,
      save: App.flow === "pve" ? App.save : null,
    });
    const host = document.getElementById("world-map");
    if (typeof WORLD !== "undefined" && WORLD.mountArena && host) {
      WORLD.mountArena(host, left, right, {
        local: !!opts.local,
        onEnd: function (side, name) {
          App._ended = true;
          UI.pvpResult(name);
        },
      });
    }
  };

  App.init = function () {
    document.getElementById("title-bar").textContent = DATA.TITLE;
    document.addEventListener("keydown", function (ev) {
      const tag = (ev.target && ev.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((ev.key === "f" || ev.key === "F") && App.flow === "pve" && App.save && (App.screen === "combat" || App.screen === "map" || App.screen === "arena")) {
        ev.preventDefault();
        App.toggleAutoFarm();
      }
      if (App.screen === "map" && App.save) {
        const arenaOn = typeof WORLD !== "undefined" && WORLD.mode && WORLD.mode() === "arena";
        if (!arenaOn) {
          const hk = ev.key;
          if (ev.key === "n" || ev.key === "N") { ev.preventDefault(); App.toggleSit(); return; }
          if (hk === "e" || hk === "E") { ev.preventDefault(); App.toggleCityWin("equip"); return; }
          if (hk === "r" || hk === "R") { ev.preventDefault(); App.toggleCityWin("shop"); return; }
          if (hk === "c" || hk === "C") { ev.preventDefault(); App.toggleCityWin("status"); return; }
          if (hk === "k" || hk === "K") { ev.preventDefault(); App.toggleCityWin("skills"); return; }
          if (hk === "i" || hk === "I") { ev.preventDefault(); App.toggleCityWin("inv"); return; }
        }
      }
      if (typeof WORLD !== "undefined" && WORLD.live && WORLD.live()) {
        if (ev.key >= "1" && ev.key <= "6") {
          ev.preventDefault();
          const skills = WORLD.hotbarSkills("left");
          const sid = skills[Number(ev.key) - 1];
          if (sid) {
            if (WORLD.noteManual) WORLD.noteManual(1800);
            WORLD.cast(sid, "left");
          }
          return;
        }
        const model = WORLD.hudModel && WORLD.hudModel();
        const p2map = { q: 0, u: 1, e: 2, r: 3, t: 4, y: 5, Q: 0, U: 1, E: 2, R: 3, T: 4, Y: 5 };
        if (model && model.localBoth && p2map.hasOwnProperty(ev.key)) {
          const skills = WORLD.hotbarSkills("right");
          const sid = skills[p2map[ev.key]];
          if (sid) {
            ev.preventDefault();
            WORLD.cast(sid, "right");
          }
          return;
        }
        const move1 = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1], A: [-1, 0], D: [1, 0], W: [0, -1], S: [0, 1] };
        if (WORLD.mode && WORLD.mode() === "arena" && move1[ev.key]) {
          ev.preventDefault();
          WORLD.tryStepArena(move1[ev.key][0], move1[ev.key][1], "left");
          return;
        }
        const move2 = { i: [0, -1], k: [0, 1], j: [-1, 0], l: [1, 0], I: [0, -1], K: [0, 1], J: [-1, 0], L: [1, 0] };
        if (WORLD.mode && WORLD.mode() === "arena" && move2[ev.key]) {
          ev.preventDefault();
          WORLD.tryStepArena(move2[ev.key][0], move2[ev.key][1], "right");
        }
      }
    });
    App.goCharSelect();
    if (typeof location !== "undefined" && /(?:\?|&)shot=/.test(location.search)) {
      const q = new URLSearchParams(location.search);
      const shot = q.get("shot");
      App.save = PVE.createSave("warrior", {}, "Shot");
      App.flow = "pve";
      if (shot === "field") {
        App.save.mapId = "field";
        App.goWorld();
        return;
      }
      if (shot === "sit") {
        App.save.cityPos = { x: 40, y: 44 };
        App.goCity();
        setTimeout(function () {
          if (typeof MAP !== "undefined" && MAP.setSitting) MAP.setSitting(true);
        }, 500);
        return;
      }
      if (shot === "plaza") App.save.cityPos = { x: 40, y: 44 };
      else if (shot === "park") App.save.cityPos = { x: 12, y: 68 };
      App.goCity();
    }
  };

  root.App = App;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", App.init);
    } else {
      App.init();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
