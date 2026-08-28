/**
 * Thai UI renderer — dark fantasy screens for every flow.
 */
(function (root) {
  const DATA = root.DATA;
  const STATS = root.STATS;
  const COMBAT = root.COMBAT;
  const UI = {};

  UI.el = function () {
    return document.getElementById("screen");
  };

  UI.setWalkMode = function (on) {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("walking", !!on);
    const bar = document.getElementById("title-bar");
    if (bar) bar.hidden = !!on;
  };

  UI.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  UI.jobsText = function (item) {
    return DATA.jobsText(item);
  };

  UI.bonusText = function (b) {
    if (!b) return "";
    const parts = [];
    const map = [
      ["hp", "HP"],
      ["mp", "MP"],
      ["atk", "ATK"],
      ["matk", "MATK"],
      ["def", "Soft DEF"],
      ["mdef", "Soft MDEF"],
      ["aspeed", "A.speed"],
      ["aspdPct", "% ASPD"],
      ["aspdFlat", " ASPD"],
      ["hardDef", " Hard DEF"],
      ["crit", "% คริ"],
      ["critMult", "% ตัวคูณคริ"],
      ["hit", " HIT"],
      ["flee", " FLEE"],
      ["perfectDodge", " Perfect Dodge"],
      ["dodge", "% หลบ"],
      ["accuracy", "% แม่นยำ"],
      ["hpRegen", " HP ฟื้น/ตา"],
      ["mpRegen", " MP ฟื้น/ตา"],
      ["statusResist", "% ต้านสถานะ"],
      ["str", " STR"],
      ["vit", " VIT"],
      ["int", " INT"],
      ["agi", " AGI"],
      ["dex", " DEX"],
      ["luk", " LUK"],
    ];
    map.forEach(function (pair) {
      const k = pair[0];
      if (b[k]) {
        const sign = b[k] > 0 ? "+" : "";
        parts.push(sign + b[k] + (pair[1].charAt(0) === " " || pair[1].charAt(0) === "%" ? pair[1] : " " + pair[1]));
      }
    });
    return parts.join(", ");
  };

  UI.fmt = function (n, d) {
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return Number(n).toFixed(d == null ? 1 : d);
  };

  UI.plusTag = function (plus) {
    plus = Math.floor(Number(plus) || 0);
    return plus > 0 ? " +" + plus : "";
  };

  UI.hardLine = function (label, n, asPercent) {
    n = Number(n) || 0;
    const isMdef = /MDEF/i.test(label || "");
    if (asPercent === true || isMdef) {
      return label + " <b>" + n.toFixed(1) + " (" + UI.fmt(n, 1) + "%)</b>";
    }
    const factor = STATS.hardFactor ? STATS.hardFactor(n) : 1;
    const pct = (1 - factor) * 100;
    return label + " <b>" + UI.fmt(n, 1) + " (" + UI.fmt(pct, 1) + "%)</b>";
  };

  UI.aspeedLine = function (st, g) {
    g = g || {};
    const rate = st.finalAspd != null ? st.finalAspd : st.aspeed;
    let s = UI.derPlus("A.speed", rate, g.aspeed, 2);
    if (st.aspd != null) s += " <small>(" + UI.fmt(st.aspd, 2) + ")</small>";
    return s;
  };

  /* Allocated rank + equipment stat-points. Hide +0. */
  UI.ptsPlus = function (label, allocated, gear) {
    allocated = allocated || 0;
    gear = gear || 0;
    if (!gear) return label + " <b>" + allocated + "</b>";
    const sign = gear > 0 ? "+" : "";
    return label + " <b>" + allocated + " " + sign + gear + " = " + (allocated + gear) + "</b>";
  };

  /* Derived combat stat: base +gear = total when gear changes it. */
  UI.derPlus = function (label, total, bonus, digits) {
    bonus = bonus || 0;
    if (!bonus) return label + " <b>" + UI.fmt(total, digits) + "</b>";
    const sign = bonus > 0 ? "+" : "";
    return label + " <b>" + UI.fmt(total - bonus, digits) + " " + sign + UI.fmt(bonus, digits) + " = " + UI.fmt(total, digits) + "</b>";
  };

  UI.statBlock = function (st) {
    const g = st.gearDelta || {};
    const eq = st.eqPts || {};
    const alloc = st.allocated || {};
    return (
      '<div class="stat-zones">' +
      '<div class="stat-zone"><h4>ค่าหลัก</h4><div class="stat-grid">' +
      "<div>" + UI.ptsPlus("STR", alloc.str, eq.str) + "</div>" +
      "<div>" + UI.ptsPlus("VIT", alloc.vit, eq.vit) + "</div>" +
      "<div>" + UI.ptsPlus("INT", alloc.int, eq.int) + "</div>" +
      "<div>" + UI.ptsPlus("AGI", alloc.agi, eq.agi) + "</div>" +
      "<div>" + UI.ptsPlus("DEX", alloc.dex, eq.dex) + "</div>" +
      "<div>" + UI.ptsPlus("LUK", alloc.luk, eq.luk) + "</div>" +
      "</div></div>" +
      '<div class="stat-zone"><h4>ค่าสู้</h4><div class="stat-grid">' +
      "<div>" + UI.derPlus("HP", st.maxHp, g.maxHp, 0) + "</div>" +
      "<div>" + UI.derPlus("MP", st.maxMp, g.maxMp, 0) + "</div>" +
      "<div>" + UI.derPlus("ATK", st.atk, g.atk) + "</div>" +
      "<div>" + UI.derPlus("MATK", st.matk, g.matk) + "</div>" +
      "<div>" + UI.derPlus("Soft DEF", st.softDef != null ? st.softDef : st.def, g.softDef != null ? g.softDef : g.def) + "</div>" +
      "<div>" + UI.hardLine("Hard DEF", st.hardDef) + "</div>" +
      "<div>" + UI.derPlus("Soft MDEF", st.softMdef != null ? st.softMdef : st.mdef, g.mdef) + "</div>" +
      "<div>" + UI.hardLine("Hard MDEF", st.hardMdef) + "</div>" +
      "</div></div>" +
      '<div class="stat-zone"><h4>ค่าพิเศษ</h4><div class="stat-grid">' +
      "<div>" + UI.aspeedLine(st, g) + "</div>" +
      "<div>คริ <b>" + UI.fmt(st.crit) + "%</b></div>" +
      "<div>ตัวคูณคริ <b>" + UI.fmt(st.critMult) + "%</b></div>" +
      "<div>" + UI.derPlus("HIT", st.hit, g.hit) + "</div>" +
      "<div>" + UI.derPlus("FLEE", st.flee, g.flee) + "</div>" +
      "<div>Perfect Dodge <b>" + (Number(st.perfectDodge) || 0).toFixed(1) + "</b></div>" +
      "<div>ต้านสถานะ <b>" + UI.fmt(st.statusResist) + "%</b></div>" +
      "<div>ฟื้น HP/ตา <b>" + UI.fmt(st.hpRegen) + "</b></div>" +
      "<div>ฟื้น MP/ตา <b>" + UI.fmt(st.mpRegen) + "</b></div>" +
      "</div></div></div>"
    );
  };

  UI.bar = function (kind, cur, max, label) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
    return (
      '<div class="bar-wrap bar-' +
      kind +
      '">' +
      '<div class="bar-label"><span>' +
      label +
      '</span><span>' +
      UI.fmt(cur, 0) +
      " / " +
      UI.fmt(max, 0) +
      "</span></div>" +
      '<div class="bar-track"><div class="bar-fill" style="width:' +
      pct.toFixed(2) +
      '%"></div></div>' +
      "</div>"
    );
  };

  UI.statusPills = function (u) {
    const pills = [];
    if (u.poisons && u.poisons.length) {
      pills.push('<span class="pill poison">พิษ ×' + u.poisons.length + "</span>");
    }
    if (u.weakenTurns > 0) pills.push('<span class="pill weaken">อ่อนแอ ' + u.weakenTurns + "</span>");
    if (u.guard) pills.push('<span class="pill guard">เกราะเวท</span>');
    if (u.guardCritPending > 0) pills.push('<span class="pill crit">คริชาร์จ +' + UI.fmt(u.guardCritPending) + "%</span>");
    if (u.counter) pills.push('<span class="pill counter">สวนกลับ</span>');
    if (u.veilTurns > 0) pills.push('<span class="pill veil">เงาพราง ' + u.veilTurns + "</span>");
    if (u.focusTurns > 0) pills.push('<span class="pill focus">เพ่งสมาธิ ' + u.focusTurns + "</span>");
    if (u.stoneShield) pills.push('<span class="pill shield">โล่หินผา</span>');
    if (u.fogTurns > 0) pills.push('<span class="pill fog">สายหมอก ' + u.fogTurns + "</span>");
    if (u.rageTurns > 0) pills.push('<span class="pill rage">โกรธเกรี้ยว ' + u.rageTurns + "</span>");
    if (u.curseTurns > 0) pills.push('<span class="pill curse">สาปมรณะ ' + u.curseTurns + "</span>");
    if (u.dragonStacks > 0) pills.push('<span class="pill dragon">ลมปราณ ×' + u.dragonStacks + "</span>");
    if (u.sanctuary) pills.push('<span class="pill guard">วงก์บุญ</span>');
    if (u.phantomTurns > 0) pills.push('<span class="pill veil">ภาพผี ' + u.phantomTurns + "</span>");
    if (u.markTurns > 0) pills.push('<span class="pill focus">ประทับเหยี่ยว ' + u.markTurns + "</span>");
    if (u.angelVeilTurns > 0) pills.push('<span class="pill veil">ปกปกาศ ' + u.angelVeilTurns + "</span>");
    if (u.wrathTurns > 0) pills.push('<span class="pill rage">เกร็กวินาศ ' + u.wrathTurns + "</span>");
    if (!pills.length) return '<div class="pills empty">ไม่มีสถานะ</div>';
    return '<div class="pills">' + pills.join("") + "</div>";
  };

  UI.home = function () {
    /* No player-facing PvP entry. If a save exists, resume Prontera; else character select. */
    if (typeof App !== "undefined" && App.save && App.goCity) {
      App.goCity();
      return;
    }
    if (typeof App !== "undefined" && App.goCharSelect) {
      App.goCharSelect();
      return;
    }
    if (typeof App !== "undefined" && App.goPve) {
      App.goPve({ firstRun: true });
      return;
    }
    UI.setWalkMode(false);
    UI.el().innerHTML =
      '<section class="panel home-panel ro-win">' +
      '<div class="ro-title"><span>โหมดผจญภัย</span></div>' +
      '<div class="ro-body">' +
      '<p class="lead">เริ่มที่เมืองพรอนเทรา</p>' +
      '<div class="mode-row">' +
      '<button class="mode-card pve" type="button" onclick="App.goPve({ firstRun: true })">' +
      '<span class="mode-emoji">🐉</span><span class="mode-title">PvE โหมดผจญภัย</span>' +
      "<small>เริ่มที่เมืองพรอนเทรา · ร้านอาวุธ/ร้านยา · ฟาร์มมอนสเตอร์ · ปราสาทโลหิต 7 บอส</small>" +
      "</button>" +
      "</div>" +
      '<p class="hint">ทุ่ง: เดินเข้ามอนฟันอัตโนมัติ · บอส: เลือกจากรายการแล้วสู้เทิร์นเบส ATB</p>' +
      "</div></section>";
  };

  UI.pvpMenu = function () {
    UI.setWalkMode(false);
    UI.el().innerHTML =
      '<section class="panel">' +
      "<h2>⚔️ โหมด PvP</h2>" +
      '<p class="lead">ดวลเรียลไทม์ ไม่มีร้านค้า/อุปกรณ์ — แจกแต้ม ' + DATA.STAT_POINTS_TOTAL + ' แล้วขึ้นลานประลอง</p>' +
      '<div class="btn-col">' +
      '<button type="button" class="btn gold" onclick="App.pvpRoomCreate()">สร้างห้อง</button>' +
      '<button type="button" class="btn gold" onclick="App.pvpRoomJoinScreen()">เข้าห้อง</button>' +
      '<button type="button" class="btn gold" onclick="App.pvpLocal()">เล่นบนเครื่องเดียวกัน (Local)</button>' +
      '<button type="button" class="btn" onclick="App.pvpCreate()">สร้างคำเชิญให้เพื่อน (โค้ด)</button>' +
      '<button type="button" class="btn" onclick="App.pvpJoinScreen()">เข้าร่วมด้วยโค้ดคำเชิญ</button>' +
      '<button type="button" class="btn ghost" onclick="App.goHome()">กลับหน้าแรก</button>' +
      "</div></section>";
  };

  UI.charSelect = function () {
    UI.setWalkMode(false);
    const accounts = (typeof PVE !== "undefined" && PVE.listAccounts) ? PVE.listAccounts() : [];
    const last = (typeof PVE !== "undefined" && PVE.lastUsername) ? (PVE.lastUsername() || "") : "";
    const cards = accounts.length
      ? accounts.map(function (a) {
          const enc = encodeURIComponent(a.username || "");
          return (
            '<button type="button" class="char-slot" data-user="' +
            UI.esc(a.username) +
            '" onclick="App.loadAccount(decodeURIComponent(\'' +
            enc +
            "'))\">" +
            '<div class="char-slot-art"><img src="assets/chars/' +
            UI.esc(a.heroId || "warrior") +
            '.png" alt=""></div>' +
            '<div class="char-slot-meta">' +
            "<b>" +
            UI.esc(a.charName) +
            "</b>" +
            "<small>" +
            UI.esc(a.jobName) +
            "</small>" +
            "<small>Base Lv " +
            (a.baseLevel || 1) +
            " / Job Lv " +
            (a.jobLevel || 1) +
            "</small>" +
            '<small class="char-slot-user">' +
            UI.esc(a.username) +
            "</small>" +
            "</div></button>"
          );
        }).join("")
      : '<p class="hint char-empty">ยังไม่มีตัวละครบันทึก — กดสร้างตัวใหม่</p>';
    UI.el().innerHTML =
      '<section class="panel ro-win char-select">' +
      '<div class="ro-title"><span>เลือกตัวละคร</span></div>' +
      '<div class="ro-body">' +
      '<p class="lead">เลือกตัวที่บันทึกไว้ หรือสร้างตัวใหม่ เพื่อเข้าเกม</p>' +
      '<div class="char-slot-row">' +
      cards +
      "</div>" +
      '<button type="button" class="btn gold wide" onclick="App.goPve({ firstRun: true })">สร้างตัวละครใหม่</button>' +
      '<div class="char-login-row">' +
      '<input id="login-user" class="ro-input" type="text" maxlength="24" lang="th" placeholder="ใส่ Username เพื่อเล่นต่อ" value="' +
      UI.esc(last) +
      '" autocomplete="username" />' +
      '<button type="button" class="ro-btn" onclick="App.loginByUsername()">เล่นต่อ</button>' +
      "</div></div></section>";
    const inp = document.getElementById("login-user");
    if (inp) {
      inp.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          App.loginByUsername();
        }
      });
    }
  };

  UI.saveForm = function (save) {
    const pre = (save && save.username) || (typeof PVE !== "undefined" && PVE.lastUsername && PVE.lastUsername()) || "";
    return (
      '<div class="save-form">' +
      '<input id="save-user" class="ro-input" type="text" maxlength="24" lang="th" placeholder="Username" value="' +
      UI.esc(pre) +
      '" autocomplete="username" onkeydown="if(event.key===\'Enter\'){event.preventDefault();App.confirmSave();}" />' +
      '<button type="button" class="ro-btn" onclick="App.confirmSave()">บันทึก</button>' +
      '<p class="hint">ใช้ username นี้ตอนเริ่มเกมเพื่อเล่นต่อ</p>' +
      "</div>"
    );
  };

  UI.heroSelect = function (opts) {
    UI.setWalkMode(false);
    opts = opts || {};
    const cards = Object.keys(DATA.HEROES)
      .map(function (id) {
        const h = DATA.HEROES[id];
        const skills = h.skills
          .map(function (sid) {
            const sk = DATA.SKILLS[sid];
            const icon = (typeof FX !== "undefined" && FX.skillIcon(sid, sk)) || (sk.icon || "");
            const hint = (sk.button && sk.button.indexOf(" — ") >= 0) ? sk.button.split(" — ").slice(1).join(" — ") : (sk.button || "");
            return (
              '<li class="skill-mini-row">' +
              (icon ? '<img class="skill-icon-sm" src="' + icon + '" alt="">' : "") +
              "<div><b>" +
              sk.name +
              "</b><small>" +
              hint +
              "</small></div></li>"
            );
          })
          .join("");
        return (
          '<button type="button" class="hero-card" style="--hero:' +
          h.color +
          '" onclick="App.pickHero(\'' +
          id +
          "')\">" +
          '<div class="hero-portrait-wrap"><img class="hero-portrait" src="assets/chars/' +
          id +
          '.png" alt="' +
          h.name +
          '"><span class="hero-emoji">' +
          h.emoji +
          "</span></div>" +
          "<h3>" +
          h.name +
          "</h3>" +
          '<ul class="mini-stats">' +
          "<li>HP " +
          h.hp +
          " · MP " +
          h.mp +
          "</li>" +
          "<li>ATK " +
          h.atk +
          " · MATK " +
          h.matk +
          "</li>" +
          "<li>DEF " +
          h.def +
          " · MDEF " +
          h.mdef +
          "</li>" +
          "<li>A.speed " +
          h.aspeed +
          "</li>" +
          "</ul>" +
          '<ul class="skill-mini">' +
          skills +
          "</ul>" +
          "</button>"
        );
      })
      .join("");
    const back = opts.hideBack
      ? ""
      : '<button type="button" class="btn ghost" onclick="App.heroSelectBack()">กลับ</button>';
    UI.el().innerHTML =
      '<section class="panel ro-win hero-select-panel">' +
      '<div class="ro-title"><span>' +
      UI.esc(opts.title || "เลือกอาชีพ") +
      "</span></div>" +
      '<div class="ro-body">' +
      (opts.subtitle ? '<p class="lead">' + UI.esc(opts.subtitle) + "</p>" : "") +
      '<div class="hero-row">' +
      cards +
      "</div>" +
      back +
      "</div></section>";
  };

  UI.nameChar = function (heroId, draftName) {
    UI.setWalkMode(false);
    const hero = DATA.HEROES[heroId] || {};
    const draft = draftName || hero.name || "";
    UI.el().innerHTML =
      '<section class="panel ro-win name-char-panel">' +
      '<div class="ro-title"><span>ตั้งชื่อตัวละคร</span></div>' +
      '<div class="ro-body name-char-body">' +
      '<div class="hero-portrait-wrap"><img class="hero-portrait" src="assets/chars/' +
      UI.esc(heroId) +
      '.png" alt="' +
      UI.esc(hero.name || "") +
      '"></div>' +
      '<p class="lead">' +
      UI.esc(hero.name || "") +
      "</p>" +
      '<input id="char-name" class="ro-input" type="text" maxlength="24" lang="th" placeholder="' +
      UI.esc(hero.name || "") +
      '" value="' +
      UI.esc(draft) +
      '" autocomplete="off" />' +
      '<p class="hint">ใช้ภาษาไทยได้ · ไม่เกิน 24 ตัวอักษร</p>' +
      '<button type="button" class="btn gold wide" onclick="App.confirmName()">ยืนยัน</button>' +
      '<button type="button" class="btn ghost" onclick="App.goPve({ firstRun: true })">กลับ</button>' +
      "</div></section>";
    const inp = document.getElementById("char-name");
    if (inp) {
      inp.focus();
      inp.select();
      inp.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          App.confirmName();
        }
      });
    }
  };

  UI.alloc = function (sess, heroId, opts) {
    opts = opts || {};
    if (!opts.overlay) UI.setWalkMode(false);
    const hero = DATA.HEROES[heroId];
    const previewAlloc = STATS.commitSession(sess);
    const preview = STATS.computeHeroStats(heroId, previewAlloc, (opts.equip) || DATA.emptyEquip(), opts.level || 1, opts.refine || {});
    const remain = STATS.sessionRemaining(sess);
    const eqPts = preview.eqPts || STATS.equipmentStatPoints(opts.equip || DATA.emptyEquip());
    const rows = DATA.STAT_KEYS.map(function (k) {
      const locked = sess.locked[k] || 0;
      const cur = STATS.sessionTotal(sess, k);
      const gear = eqPts[k] || 0;
      const nextCost = STATS.costToRaise(cur);
      const atCap = cur >= DATA.STAT_MAX_PER_STAT;
      const costChip = atCap
        ? '<span class="cost-chip cap">ถึงเพดาน</span>'
        : '<span class="cost-chip">ใช้ ' + nextCost + ' แต้ม</span>';
      return (
        '<div class="alloc-row">' +
        '<div class="alloc-name">' +
        UI.ptsPlus(DATA.STAT_LABELS[k], cur, gear) +
        (locked ? '<small>ล็อก ' + locked + "</small>" : "") +
        "</div>" +
        '<div class="alloc-ctrl">' +
        '<button type="button" class="btn tiny" onclick="App.allocMin(\'' + k + "')\">MIN</button>" +
        '<button type="button" class="btn tiny" onclick="App.allocAdd(\'' + k + "',-1)\">−</button>" +
        '<span class="alloc-val">' +
        cur +
        "</span>" +
        '<button type="button" class="btn tiny" onclick="App.allocAdd(\'' + k + "',1)\">+</button>" +
        '<button type="button" class="btn tiny" onclick="App.allocMax(\'' + k + "')\">MAX</button>" +
        costChip +
        "</div></div>"
      );
    }).join("");
    if (opts.overlay) {
      return (
        '<div class="remain-chip">แต้มคงเหลือ <b>' + remain + "</b> / พูล " + sess.pool + " · เพดานต่อสเตตัส 99</div>" +
        '<p class="lead">' + UI.esc(opts.blurb || "แจกแต้มสถานะ") + "</p>" +
        '<div class="alloc-layout">' +
        '<div class="alloc-left">' + rows +
        '<button type="button" class="btn gold wide" onclick="App.allocConfirm()">ยืนยัน</button></div>' +
        '<div class="alloc-right"><h3>พรีวิว</h3>' + UI.statBlock(preview) + "</div></div>" +
        '<button type="button" class="btn ghost wide" onclick="App.closeCityWin()">ปิด</button>'
      );
    }
    UI.el().innerHTML =
      '<section class="panel alloc-panel ro-win">' +
      '<div class="ro-title"><span>แจกแต้มสถานะ ' +
      UI.esc(hero.name) +
      "</span></div>" +
      '<div class="ro-body">' +
      "<h2>แจกแต้มสถานะ " +
      hero.emoji +
      " " +
      hero.name +
      "</h2>" +
      '<p class="lead">' +
      UI.esc(opts.blurb || ("แต้มเริ่มต้น " + DATA.STAT_POINTS_TOTAL + " — ไม่บังคับแจกให้ครบ ดึงแต้มที่ล็อกแล้วคืนไม่ได้")) +
      "</p>" +
      '<div class="remain-chip">แต้มคงเหลือ <b>' +
      remain +
      "</b> / พูล " +
      sess.pool +
      " · เพดานต่อสเตตัส 99</div>" +
      '<div class="alloc-layout">' +
      '<div class="alloc-left">' +
      rows +
      '<button type="button" class="btn gold wide" onclick="App.allocConfirm()">ยืนยันและไปต่อ</button>' +
      "</div>" +
      '<div class="alloc-right">' +
      "<h3>พรีวิวค่าสถานะ (เลเวล " +
      preview.level +
      ")</h3>" +
      UI.statBlock(preview) +
      "</div></div></div></section>";
  };

  UI.shop = function (save, opts) {
    opts = opts || {};
    const groups = ["helm", "eyes", "mouth", "armor", "weapon", "shield", "cloak", "boots", "acc"];
    const icons = { helm: "🪖", eyes: "🕶️", mouth: "😷", armor: "👕", weapon: "🗡️", shield: "🛡️", cloak: "🧥", boots: "👢", acc: "💍" };
    const names = {
      helm: "หมวก",
      eyes: "อุปกรณ์ส่วนตา",
      mouth: "อุปกรณ์ส่วนปาก",
      armor: "เสื้อ",
      weapon: "อาวุธ",
      shield: "โล่",
      cloak: "ผ้าคลุม",
      boots: "รองเท้า",
      acc: "เครื่องประดับ (ซ้าย/ขวาใช้คลังร่วมกัน)",
    };
    const html = groups
      .map(function (type) {
        const items = DATA.ITEMS_BY_TYPE[type]
          .map(function (it) {
            const owned = !!save.owned[it.id];
            const can = save.zeno >= it.price;
            const sellZ = DATA.sellZeno(it.price);
            const btn = owned
              ? '<span class="owned-tag">เป็นเจ้าของแล้ว</span>' +
                '<button type="button" class="btn small sell" onclick="App.sellItem(\'' + it.id + "',1)\">ขาย " + sellZ + "</button>"
              : '<button type="button" class="btn small ' +
                (can ? "gold" : "disabled") +
                '" ' +
                (can ? 'onclick="App.buyItem(\'' + it.id + "')\"" : "disabled") +
                ">ซื้อ " +
                it.price +
                " · " +
                DATA.itemWeight(it) +
                "g</button>";
            const tier = it.tier === "high" ? '<span class="tier-high">ชั้นสูง</span>' : "";
            const plus = owned ? PVE.refineOf(save, it.id) : 0;
            return (
              '<div class="item-row' +
              (owned ? " owned" : "") +
              (it.tier === "high" ? " high-tier" : "") +
              '"><div><b>' +
              it.name +
              UI.plusTag(plus) +
              "</b>" +
              tier +
              "<div class=\"item-bon\">" +
              (DATA.itemStatLine ? DATA.itemStatLine(it) : (UI.bonusText(it.bonuses) + " · " + UI.jobsText(it))) +
              " · " + DATA.itemWeight(it) + "g" +
              '</div></div><div class="item-buy">' +
              btn +
              "</div></div>"
            );
          })
          .join("");
        return "<h3>" + icons[type] + " " + names[type] + "</h3>" + '<div class="item-list">' + items + "</div>";
      })
      .join("");
    const nav = opts.overlay
      ? '<div class="btn-row">' +
        '<button type="button" class="btn gold" onclick="App.goEquip()">ไปหน้าสวมใส่อุปกรณ์</button>' +
        '<button type="button" class="btn" onclick="App.goRefine()">ตีบวกอุปกรณ์</button>' +
        '<button type="button" class="btn ghost" onclick="App.closeCityWin()">ปิด</button>' +
        "</div>"
      : '<div class="btn-row">' +
        '<button type="button" class="btn gold" onclick="App.goEquip()">ไปหน้าสวมใส่อุปกรณ์</button>' +
        '<button type="button" class="btn" onclick="App.goRefine()">ตีบวกอุปกรณ์</button>' +
        '<button type="button" class="btn ghost" onclick="App.goWorld()">กลับเมือง / แผนที่</button>' +
        "</div>";
    const inner =
      (opts.overlay ? "" : "<h2>ร้านค้า</h2>") +
      '<div class="zeno-chip">เงินคงเหลือ <b>' +
      save.zeno +
      "</b> Zeno</div>" +
      '<p class="hint">ซื้อแล้วเป็นเจ้าของถาวรจนกว่าจะเลือกฮีโร่ใหม่ · เครื่องประดับซื้อชิ้นเดียวใส่ได้ทั้งสองข้าง</p>' +
      html +
      nav;
    if (opts.overlay) return inner;
    UI.setWalkMode(false);
    UI.el().innerHTML = '<section class="panel shop-panel ro-win">' + inner + "</section>";
  };

  UI.equip = function (save, opts) {
    opts = opts || {};
    const d = STATS.computeHeroStats(save.heroId, save.allocated, save.equip, save.level, save.refine);
    const leftIds = ["helm", "eyes", "mouth", "armor", "weapon"];
    const rightIds = ["shield", "cloak", "boots", "accL", "accR"];
    function dollSlot(slot) {
      const cur = save.equip[slot.id];
      const item = cur ? DATA.ITEMS[cur] : null;
      return (
        '<button type="button" class="doll-slot' +
        (item ? " filled" : " empty") +
        '" onclick="App.unequipSlot(\'' +
        slot.id +
        "')\">" +
        '<span class="doll-ico">' +
        slot.icon +
        "</span>" +
        '<span class="doll-lab">' +
        slot.name +
        "</span>" +
        '<span class="doll-item">' +
        (item ? UI.esc(item.name) + UI.plusTag(PVE.refineOf(save, item.id)) : "ว่าง") +
        "</span></button>"
      );
    }
    const leftCol = DATA.SLOTS.filter(function (s) { return leftIds.indexOf(s.id) >= 0; })
      .map(dollSlot).join("");
    const rightCol = DATA.SLOTS.filter(function (s) { return rightIds.indexOf(s.id) >= 0; })
      .map(dollSlot).join("");
    const ownedIds = Object.keys(DATA.ITEMS).filter(function (id) { return save.owned[id]; });
    const cards = ownedIds.length
      ? ownedIds.map(function (id) {
          const it = DATA.ITEMS[id];
          const wornSlots = DATA.SLOTS.filter(function (s) { return save.equip[s.id] === id; });
          const worn = wornSlots.length > 0;
          const badge = worn
            ? '<span class="inv-badge on">ใส่อยู่' + (wornSlots.length > 1 ? " ×" + wornSlots.length : "") + "</span>"
            : '<span class="inv-badge off">ในคลัง</span>';
          const slotName = (DATA.SLOTS.find(function (s) { return s.type === it.type; }) || {}).name || it.type;
          const canWear = DATA.canJobWear(save.heroId, it);
          const blocked = !canWear && !worn;
          return (
            '<button type="button" class="inv-card' +
            (worn ? " equipped" : "") +
            (blocked ? " blocked" : "") +
            '" ' +
            (blocked ? "disabled" : 'onclick="App.toggleInvItem(\'' + it.id + '\')"') +
            ">" +
            badge +
            "<b>" +
            UI.esc(it.name) +
            UI.plusTag(PVE.refineOf(save, it.id)) +
            "</b>" +
            '<small class="inv-slot">' +
            UI.esc(slotName) +
            "</small>" +
            '<div class="item-bon">' +
            (DATA.itemStatLine ? DATA.itemStatLine(it) : (UI.bonusText(it.bonuses) + " · " + UI.jobsText(it))) +
            "</div></button>"
          );
        }).join("")
      : '<p class="hint">ยังไม่มีไอเทมในคลัง — กลับไปซื้อที่ร้านค้า</p>';
    const nav = opts.overlay
      ? '<div class="btn-row">' +
        '<button type="button" class="btn gold" onclick="App.goRefine()">ตีบวกอุปกรณ์</button>' +
        '<button type="button" class="btn" onclick="App.goSkills()">ต้นไม้สกิล</button>' +
        '<button type="button" class="btn ghost" onclick="App.goShop()">กลับร้านอาวุธ</button>' +
        '<button type="button" class="btn ghost" onclick="App.closeCityWin()">ปิด</button>' +
        "</div>"
      : '<div class="btn-row">' +
        '<button type="button" class="btn gold" onclick="App.goRefine()">ตีบวกอุปกรณ์</button>' +
        '<button type="button" class="btn" onclick="App.goSkills()">ต้นไม้สกิล</button>' +
        '<button type="button" class="btn ghost" onclick="App.goShop()">กลับร้านอาวุธ</button>' +
        '<button type="button" class="btn gold" onclick="App.goWorld()">ข้ามไปเมือง / แผนที่</button>' +
        "</div>";
    const inner =
      (opts.overlay ? "" : "<h2>สวมใส่อุปกรณ์ — " + d.emoji + " " + d.name + " Lv." + d.level + "</h2>") +
      '<div class="zeno-chip">HP ' +
      UI.fmt(save.hp == null ? d.maxHp : save.hp, 0) +
      "/" +
      UI.fmt(d.maxHp, 0) +
      " · MP " +
      UI.fmt(save.mp == null ? d.maxMp : Math.min(save.mp, d.maxMp), 0) +
      "/" +
      UI.fmt(d.maxMp, 0) +
      " · " +
      save.zeno +
      " Zeno</div>" +
      '<p class="hint">คลิกการ์ดในคลังเพื่อสวม / คลิกชิ้นที่ใส่อยู่หรือช่องหุ่นเพื่อถอด</p>' +
      '<div class="equip-layout">' +
      '<div class="paper-doll">' +
      '<div class="doll-col">' + leftCol + "</div>" +
      '<div class="doll-hero"><img src="assets/chars/' +
      save.heroId +
      '.png" alt=""></div>' +
      '<div class="doll-col">' + rightCol + "</div>" +
      "</div>" +
      '<div class="inv-pane"><h3>คลังไอเทม</h3><div class="inv-grid">' +
      cards +
      "</div></div></div>" +
      '<div class="alloc-right equip-stats"><h3>ค่าสถานะรวม</h3>' +
      UI.statBlock(d) +
      "</div>" +
      nav;
    if (opts.overlay) return inner;
    UI.setWalkMode(false);
    UI.el().innerHTML = '<section class="panel equip-panel ro-win">' + inner + "</section>";
  };


  UI.refine = function (save, opts) {
    opts = opts || {};
    PVE.ensureProgress(save);
    const d = PVE.derived(save);
    const ids = PVE.listRefinableOwned(save);
    const rows = ids.length
      ? ids.map(function (id) {
          const it = DATA.ITEMS[id];
          const plus = PVE.refineOf(save, id);
          const maxed = plus >= DATA.REFINE_MAX;
          const next = plus + 1;
          const cost = maxed ? 0 : DATA.refineCostTo(next);
          const chance = maxed ? 0 : DATA.refineChanceTo(next);
          const oreId = maxed ? null : DATA.refineOreFor(it, next);
          const oreName = (oreId && DATA.MATERIALS[oreId] && DATA.MATERIALS[oreId].name) || oreId || "";
          const oreHave = oreId ? ((save.materials && save.materials[oreId]) || 0) : 0;
          const can = !maxed && save.zeno >= cost && oreHave >= 1;
          const worn = PVE.isEquipped(save, id);
          const extra = it.type === "weapon"
            ? "อาวุธ: +8 ATK / +8 MATK ต่อระดับ (ไม่เพิ่ม Hard DEF)"
            : "Hard DEF/MDEF +" + DATA.HARD_PER_REFINE + " ต่อระดับ";
          return (
            '<div class="item-row refine-row">' +
            "<div><b>" +
            UI.esc(it.name) +
            " +" +
            plus +
            "</b>" +
            (worn ? '<span class="inv-badge on">ใส่อยู่</span>' : "") +
            '<div class="item-bon">' +
            extra +
            (maxed
              ? " · สูงสุดแล้ว"
              : " · ครั้งถัดไป +" + next + " ค่าใช้จ่าย " + cost + " Zeno · ต้อง 1 " + oreName + " · โอกาส " + chance + "%") +
            "<br>ล้มเหลว: คงระดับเดิม ไม่พัง ไม่ลดระดับ (เสีย Zeno และแร่)</div></div>" +
            '<div class="item-buy">' +
            (maxed
              ? '<span class="owned-tag">+10</span>'
              : '<button type="button" class="btn small ' +
                (can ? "gold" : "disabled") +
                '" ' +
                (can ? 'onclick="App.attemptRefine(\'' + id + "')\"" : "disabled") +
                ">ตีบวก</button>") +
            "</div></div>"
          );
        }).join("")
      : '<p class="hint">ยังไม่มีอุปกรณ์ที่ตีบวกได้ — ซื้อหมวก เสื้อ รองเท้า ผ้าคลุม โล่ หรืออาวุธก่อน (ตา/ปาก/เครื่องประดับตีบวกไม่ได้)</p>';
    const nav = opts.overlay
      ? '<div class="btn-row">' +
        '<button type="button" class="btn ghost" onclick="App.goEquip()">กลับหน้าสวมใส่</button>' +
        '<button type="button" class="btn" onclick="App.goShop()">ร้านอาวุธ</button>' +
        '<button type="button" class="btn" onclick="App.goSkills()">ข้ามไปต้นไม้สกิล</button>' +
        '<button type="button" class="btn ghost" onclick="App.closeCityWin()">ปิด</button>' +
        "</div>"
      : '<div class="btn-row">' +
        '<button type="button" class="btn ghost" onclick="App.goEquip()">กลับหน้าสวมใส่</button>' +
        '<button type="button" class="btn" onclick="App.goShop()">ร้านอาวุธ</button>' +
        '<button type="button" class="btn" onclick="App.goSkills()">ข้ามไปต้นไม้สกิล</button>' +
        '<button type="button" class="btn gold" onclick="App.goWorld()">ข้ามไปเมือง / แผนที่</button>' +
        "</div>";
    const inner =
      (opts.overlay ? "" : " <h2>ตีบวกอุปกรณ์</h2>") +
      '<div class="zeno-chip">เงินคงเหลือ <b>' +
      save.zeno +
      "</b> Zeno</div>" +
      '<p class="hint">ตีบวกของที่ซื้อแล้วได้ทั้งที่ใส่และในคลัง · ล้มเหลวปลอดภัย: ไม่พัง ไม่ลดระดับ เสียเฉพาะ Zeno</p>' +
      '<div class="remain-chip">พรีวิว Hard DEF <b>' +
      Number(d.hardDef || 0).toFixed(1) +
      " (" +
      UI.fmt(d.hardDef || 0, 1) +
      "%)</b> · Hard MDEF <b>" +
      Number(d.hardMdef || 0).toFixed(1) +
      " (" +
      UI.fmt(d.hardMdef || 0, 1) +
      "%)</b></div>" +
      '<div class="item-list">' +
      rows +
      "</div>" +
      UI.statBlock(d) +
      nav;
    if (opts.overlay) return inner;
    UI.setWalkMode(false);
    UI.el().innerHTML = '<section class="panel shop-panel refine-panel ro-win">' + inner + "</section>";
  };

  UI.skills = function (sess, heroId, opts) {
    opts = opts || {};
    if (!opts.overlay) UI.setWalkMode(false);
    const hero = DATA.HEROES[heroId];
    const remain = DATA.skillSessionRemaining(sess);
    const preview = DATA.skillSessionPreview(sess);
    const branches = DATA.SKILL_BRANCHES[heroId] || [];
    function nodeHtml(id) {
      const def = DATA.SKILLS[id];
      if (!def) return "";
      const rank = DATA.skillSessionRank(sess, id);
      const unlocked = DATA.skillUnlocked(id, preview, heroId);
      const canPlus = unlocked && rank < DATA.SKILL_MAX_RANK && remain >= 1;
      const canMinus = (sess.session[id] || 0) > 0;
      const scaled = COMBAT.skillPreview(id, Math.max(1, rank));
      const hint = scaled.text;
      const icon = (typeof FX !== "undefined" && FX.skillIcon(id, def)) || def.icon || "";
      const lvBadge = rank >= 1 ? '<em class="lv-badge">Lv.' + rank + "</em>" : "";
      return (
        '<div class="sk-node' +
        (unlocked ? "" : " locked") +
        (rank >= 1 ? " learned" : "") +
        '">' +
        (unlocked
          ? ""
          : '<div class="sk-lock">ล็อก<br><small>' + UI.esc(DATA.prereqText(id, heroId)) + "</small></div>") +
        '<button type="button" class="sk-hit"' +
        (canPlus ? ' onclick="App.skillAdd(\'' + id + "')\"" : " disabled") +
        ">" +
        (icon ? '<img src="' + icon + '" alt="">' : "") +
        "<b>" +
        def.name +
        " " +
        lvBadge +
        "</b>" +
        "<span>Lv " +
        rank +
        "/" +
        DATA.SKILL_MAX_RANK +
        "</span></button>" +
        '<div class="sk-ops">' +
        '<button type="button" class="btn tiny"' +
        (canMinus ? ' onclick="App.skillSub(\'' + id + "')\"" : " disabled") +
        ">−</button>" +
        '<button type="button" class="btn tiny"' +
        (canPlus ? ' onclick="App.skillAdd(\'' + id + "')\"" : " disabled") +
        ">+</button></div>" +
        '<small class="sk-desc">' +
        UI.esc(hint) +
        "</small></div>"
      );
    }
    const cols = branches
      .map(function (col) {
        return (
          '<div class="sk-col">' +
          col
            .map(function (id, i) {
              return nodeHtml(id) + (i < col.length - 1 ? '<div class="sk-line"></div>' : "");
            })
            .join("") +
          "</div>"
        );
      })
      .join("");
    const confirmLabel = opts.finalVictory
      ? "ยืนยันและจบการผจญภัย"
      : opts.pvp
        ? "ยืนยันและไปต่อ"
        : "ยืนยันและเลือกบอส";
    const back = App.flow === "pve" && !opts.finalVictory
      ? '<button type="button" class="btn ghost" onclick="App.backFromSkills()">กลับ</button>'
      : "";
    if (opts.overlay) {
      return (
        '<div class="remain-chip">แต้มสกิลคงเหลือ <b>' + remain + "</b> / พูล " + sess.pool + "</div>" +
        '<p class="lead">คลิกโหนดเพื่อใช้ 1 แต้มต่อแรงก์ · แรงก์สูงสุด 5</p>' +
        '<div class="skill-tree">' + cols + "</div>" +
        '<div class="btn-row">' +
        '<button type="button" class="btn gold" onclick="App.skillsConfirm()">ยืนยัน</button>' +
        '<button type="button" class="btn ghost" onclick="App.closeCityWin()">ปิด</button></div>'
      );
    }
    UI.el().innerHTML =
      '<section class="panel skills-panel-page">' +
      "<h2>ต้นไม้สกิล " +
      hero.emoji +
      " " +
      hero.name +
      "</h2>" +
      '<p class="lead">คลิกโหนดเพื่อใช้ 1 แต้มต่อแรงก์ · แรงก์สูงสุด 5 · ดึงคืนได้เฉพาะแรงก์ที่ซื้อรอบนี้</p>' +
      '<div class="remain-chip">แต้มสกิลคงเหลือ <b>' +
      remain +
      "</b> / พูล " +
      sess.pool +
      "</div>" +
      '<div class="skill-tree">' +
      cols +
      "</div>" +
      '<div class="btn-row">' +
      back +
      '<button type="button" class="btn gold" onclick="App.skillsConfirm()">' +
      confirmLabel +
      "</button></div></section>";
  };

  UI.fighterCard = function (u, acting) {
    const atbPct = Math.max(0, Math.min(100, (u.atb / DATA.SPEED_MAX) * 100));
    return (
      '<article class="fighter' +
      (acting ? " acting" : "") +
      '" data-side="' +
      u.side +
      '" style="--hero:' +
      (u.color || "#c9a227") +
      '">' +
      '<div class="char-stage ' +
      u.side +
      '" data-side="' +
      u.side +
      '" data-hero="' +
      UI.esc(u.heroId) +
      '">' +
      '<div class="fx-layer"></div>' +
      '<div class="char-sprite-wrap">' +
      '<img class="char-sprite" src="' +
      UI.esc(u.portrait || ("assets/chars/" + u.heroId + ".png")) +
      '" alt="' +
      UI.esc(u.name) +
      '">' +
      '<div class="weapon-flash"></div>' +
      "</div></div>" +
      '<div class="fighter-head"><span class="f-emoji">' +
      u.emoji +
      '</span><div><h3>' +
      UI.esc(u.name) +
      "</h3><small>Lv." +
      u.level +
      (u.isMonster ? " มอนสเตอร์" : u.isBoss ? " บอส" : "") +
      "</small></div></div>" +
      UI.bar("hp", u.hp, u.maxHp, "HP") +
      UI.bar("mp", u.mp, u.maxMp, "MP") +
      '<div class="bar-wrap bar-atb"><div class="bar-label"><span>A.speed</span><span>' +
      UI.fmt(u.atb, 0) +
      " / 1000</span></div>" +
      '<div class="bar-track"><div class="bar-fill atb-fill" style="width:' +
      atbPct.toFixed(2) +
      '%"></div></div></div>' +
      UI.statusPills(u) +
      (function () {
        const g = u.gearDelta || {};
        const eq = u.eqPts || {};
        const al = u.allocated || {};
        const pts = u.isHero
          ? '<div class="fighter-pts">' + DATA.STAT_KEYS.map(function (k) {
              return UI.ptsPlus(DATA.STAT_LABELS[k], al[k], eq[k]);
            }).join('<span class="dot"> · </span>') + "</div>"
          : "";
        const refineBits = [];
        if (u.isHero && u.equip) {
          DATA.SLOTS.forEach(function (s) {
            const id = u.equip[s.id];
            if (!id) return;
            const plus = STATS.refineOf(u.refine, id);
            if (plus > 0) refineBits.push(s.name + " +" + plus);
          });
        }
        const refineLine = refineBits.length
          ? '<div class="fighter-refine">' + refineBits.join(" · ") + "</div>"
          : "";
        return (
          pts +
          refineLine +
          '<div class="fighter-stats">' +
          UI.derPlus("HP", u.maxHp, g.maxHp, 0) +
          " · " +
          UI.derPlus("MP", u.maxMp, g.maxMp, 0) +
          " · " +
          UI.derPlus("ATK", u.atk, g.atk) +
          " · " +
          UI.derPlus("MATK", u.matk, g.matk) +
          " · " +
          UI.derPlus("Soft DEF", u.softDef != null ? u.softDef : u.def, g.softDef != null ? g.softDef : g.def) +
          " · " +
          UI.hardLine("Hard DEF", u.hardDef) +
          " · " +
          UI.derPlus("Soft MDEF", u.softMdef != null ? u.softMdef : u.mdef, g.mdef) +
          " · " +
          UI.hardLine("Hard MDEF", u.hardMdef) +
          " · " +
          UI.aspeedLine(u, g) +
          " · คริ " +
          UI.fmt(COMBAT.effectiveCrit(u)) +
          "% · HIT " +
          UI.fmt(u.hit) +
          " · FLEE " +
          UI.fmt(u.flee) +
          " · Perfect Dodge " +
          (Number(u.perfectDodge) || 0).toFixed(1) +
          "</div>"
        );
      })() +
      "</article>"
    );
  };

  UI.skillButtons = function (actor, opts) {
    opts = opts || {};
    if (!actor) {
      return '<div class="skill-wait">กำลังเติมเกจ A.speed...</div>';
    }
    if (opts.locked) {
      return (
        '<div class="skill-wait">' +
        UI.esc(opts.lockMsg || "รออีกฝ่ายลงมือ — คัดลอกโค้ดสถานะด้านล่างส่งให้เพื่อน") +
        "</div>"
      );
    }
    const buttons = actor.skills
      .map(function (sid) {
        const def = actor.isBoss ? DATA.BOSS_SKILLS[sid] : DATA.SKILLS[sid];
        if (!def) return "";
        const ready = COMBAT.skillReady(actor, sid, def);
        const cdLeft = actor.cds[sid] || 0;
        const rank = actor.isBoss ? 1 : COMBAT.rankOf(actor, sid);
        const prevw = actor.isBoss ? null : COMBAT.skillPreview(sid, rank);
        const mpCost = actor.isBoss ? (def.mp || 0) : prevw.mp;
        const label = actor.isBoss
          ? (def.button || def.name + (def.mp ? " | MP " + def.mp : "") + (def.cd ? " | CD " + def.cd : ""))
          : prevw.text;
        const lvBadge = !actor.isBoss && rank >= 1 ? '<em class="lv-badge">Lv.' + rank + "</em>" : "";
        return (
          '<button type="button" class="skill-btn' +
          (ready ? "" : " disabled") +
          '" ' +
          (ready ? 'onclick="App.useSkill(\'' + sid + "')\"" : "disabled") +
          ">" +
          (def.icon ? '<img class="skill-icon" src="' + def.icon + '" alt="">' : "") +
          "<b>" +
          def.name +
          " " +
          lvBadge +
          "</b><span>" +
          label +
          "</span>" +
          (cdLeft > 0 ? '<i class="cd">CD ' + cdLeft + "</i>" : "") +
          (mpCost ? '<i class="mp">MP ' + mpCost + "</i>" : "") +
          "</button>"
        );
      })
      .join("");
    const who = opts.who || actor.name;
    return (
      '<div class="skill-head">ตาของ <b>' +
      UI.esc(who) +
      "</b> — เลือกสกิล</div>" +
      '<div class="skill-grid">' +
      buttons +
      "</div>"
    );
  };

  UI.combat = function (state, opts) {
    UI.setWalkMode(false);
    opts = opts || {};
    const actingSide = state.waitingAction;
    const actor = actingSide === "left" ? state.left : actingSide === "right" ? state.right : null;
    const log = (state.log || [])
      .slice()
      .reverse()
      .map(function (line) {
        return "<div>" + line + "</div>";
      })
      .join("");
    let remote = "";
    if (opts.remotePanel) {
      remote =
        '<details class="remote-box"><summary>โค้ดสถานะ (ส่งให้อีกฝ่าย)</summary>' +
        "<h3>โค้ดสถานะ (ส่งให้อีกฝ่าย)</h3>" +
        '<textarea id="state-out" readonly rows="4">' +
        UI.esc(opts.stateCode || "") +
        "</textarea>" +
        '<div class="btn-row">' +
        '<button type="button" class="btn gold" onclick="App.copyStateOut()">คัดลอกโค้ด</button>' +
        "</div>" +
        "<h3>วางโค้ดที่ได้รับ แล้วกดโหลดโค้ด</h3>" +
        '<textarea id="state-in" rows="3" placeholder="วางโค้ดสถานะที่นี่"></textarea>' +
        '<button type="button" class="btn gold" onclick="App.loadStateCode()">โหลดโค้ด</button>' +
        "</details>";
    }
    const pveHud = (typeof App !== "undefined" && App.flow === "pve" && App.save)
      ? UI.adventureHud(App.save, {
          extra: '<button type="button" class="btn tiny ghost" onclick="App.forfeit()">ถอนตัว</button>',
        })
      : "";
    UI.el().innerHTML =
      '<section class="combat-screen compact">' +
      pveHud +
      '<div class="arena">' +
      UI.fighterCard(state.left, actingSide === "left") +
      '<div class="vs">VS</div>' +
      UI.fighterCard(state.right, actingSide === "right") +
      "</div>" +
      '<div class="combat-bottom">' +
      '<div class="skills-panel">' +
      UI.skillButtons(actor, opts.skillOpts || {}) +
      "</div>" +
      '<div class="log-panel"><h3>บันทึกการต่อสู้</h3><div class="log-body">' +
      log +
      "</div></div>" +
      "</div>" +
      remote +
      '<button type="button" class="forfeit-link" onclick="App.forfeit()">ถอนตัว</button>' +
      "</section>";
    const logBody = UI.el().querySelector(".log-body");
    if (logBody) logBody.scrollTop = 0;
  };

  UI.betweenWin = function (save, reward) {
    UI.setWalkMode(false);
    reward = reward || {};
    if (reward.adventureWin) {
      UI.finalWin(DATA.HEROES[save.heroId].name, { keepPlaying: true, reward: reward, save: save });
      return;
    }
    const idx = reward.defeatedIndex != null ? reward.defeatedIndex : save.bossIndex;
    const boss = DATA.BOSSES[idx];
    const first = reward.first !== false;
    let list;
    let btn;
    if (first) {
      list =
        "<li>เลเวลฮีโร่ +1 → Lv." + save.level + "</li>" +
        "<li>แต้มสถานะโบนัส +" + (reward.bonusPoints || 0) + "</li>" +
        "<li>แต้มสกิล +" + DATA.SKILL_POINTS_PER_BOSS + " (คงเหลือ " + (save.skillPoints == null ? 0 : save.skillPoints) + ")</li>" +
        "<li>เงิน +" + (reward.zeno || 0) + " Zeno (รวม " + save.zeno + ")</li>" +
        "<li>ฟื้นฟู HP/MP 25% ของค่าสูงสุด (หลังแจกแต้ม)</li>" +
        "<li>คูลดาวน์และสถานะชั่วคราวถูกรีเซ็ต</li>";
      btn = '<button type="button" class="btn gold" onclick="App.afterWinAlloc()">ไปหน้าแจกแต้มโบนัส</button>';
    } else {
      list =
        "<li>บอสที่เคยชนะแล้ว — ฟาร์มทอง</li>" +
        "<li>เงิน +" + (reward.zeno || 0) + " Zeno (รวม " + save.zeno + ")</li>" +
        "<li>ฟื้นฟู HP/MP 25% ของค่าสูงสุด</li>" +
        "<li>ไม่มีเลเวล / แต้มสถานะ / แต้มสกิลเพิ่ม</li>";
      btn = '<button type="button" class="btn gold" onclick="App.afterFarmWin()">เลือกบอสอีกครั้ง</button>';
    }
    UI.el().innerHTML =
      '<section class="panel result win">' +
      "<h2>ชนะ " +
      (boss ? boss.emoji + " " + boss.name : "บอส") +
      "!</h2>" +
      "<ul class=\"reward-list\">" +
      list +
      "</ul>" +
      btn +
      "</section>";
  };

  UI.finalWin = function (heroName, opts) {
    UI.setWalkMode(false);
    opts = opts || {};
    const extra = opts.keepPlaying
      ? '<p class="lead">ชนะบอสครบ 7 ตัวเป็นครั้งแรก — ยังเลือกบอสซ้ำเพื่อฟาร์มทองได้</p>' +
        '<button type="button" class="btn gold" onclick="App.continueAfterVictory()">เลือกบอสอีกครั้ง</button>'
      : '<p class="lead">' + UI.esc(heroName) + " เอาชนะบอสทั้ง 7 ตัว — จบโหมดผจญภัย</p>" +
        '<button type="button" class="btn gold" onclick="App.goHome()">กลับเมือง</button>';
    UI.el().innerHTML =
      '<section class="panel result win">' +
      "<h2>พระผู้สร้างโลกล่มสลาย!</h2>" +
      extra +
      "</section>";
  };

  UI.expBar = function (kind, cur, need, label) {
    const pct = need > 0 ? Math.max(0, Math.min(100, (cur / need) * 100)) : 0;
    return (
      '<div class="bar-wrap bar-exp bar-' + kind + '">' +
      '<div class="bar-label"><span>' + label + '</span><span>' +
      UI.fmt(cur, 0) + " / " + UI.fmt(need, 0) +
      "</span></div>" +
      '<div class="bar-track"><div class="bar-fill" style="width:' +
      pct.toFixed(2) + '%"></div></div></div>'
    );
  };

  UI.thinBar = function (kind, cur, max, label) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
    return (
      '<div class="bar-wrap bar-' + kind + ' thin">' +
      '<div class="bar-label"><span>' + label + '</span><span>' +
      UI.fmt(cur, 0) + "/" + UI.fmt(max, 0) +
      "</span></div>" +
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(2) + '%"></div></div></div>'
    );
  };

  UI.weightChip = function (save, derived) {
    var ws = (derived && derived.weight && typeof derived.weight === "object")
      ? derived.weight
      : PVE.weightState(save);
    var ratio = ws.ratio != null ? ws.ratio : (ws.max ? ws.cur / ws.max : 0);
    var cls = ratio >= 1 ? " full" : ratio >= 0.9 ? " over" : ratio >= 0.7 ? " heavy" : "";
    return (
      '<span class="hud-weight' + cls + '" title="น้ำหนัก">น้ำหนัก ' +
      Math.floor(ws.cur) + "/" + ws.max + " g</span>"
    );
  };

  UI.adventureHud = function (save, opts) {
    opts = opts || {};
    PVE.ensureProgress(save);
    const d = PVE.derived(save);
    const hero = DATA.HEROES[save.heroId] || {};
    const baseNeed = PVE.baseExpToNext(save.baseLevel);
    const jobNeed = PVE.jobExpToNext(save.jobLevel);
    const farmOn = !!save.autoFarm;
    const hp = save.hp == null ? d.maxHp : save.hp;
    const mp = save.mp == null ? d.maxMp : save.mp;
    const spend = save.unspentStatPoints
      ? '<button type="button" class="hud-ico gold" onclick="App.spendStatPoints()" title="แจกแต้ม">+' + save.unspentStatPoints + "</button>"
      : "";
    const extra = opts.extra || "";
    const zone = opts.zone || save.mapId || "";
    const inCombat = typeof App !== "undefined" && App.screen === "combat";
    const fightBtn = (!inCombat && zone !== "boss-select")
      ? '<button type="button" class="hud-ico gold" onclick="App.goBossSelect()" title="สู้บอส">🐉</button>'
      : "";
    const cityBtns = zone === "city"
      ? '<button type="button" class="hud-ico" onclick="App.goShop()" title="ร้านอาวุธ">⚔</button>' +
        '<button type="button" class="hud-ico" onclick="App.goPotionShop()" title="ร้านยา">🧪</button>' +
        '<button type="button" class="hud-ico" onclick="App.goEquip()" title="สวมใส่">🎽</button>' +
        '<button type="button" class="hud-ico" onclick="App.goSkills()" title="สกิล">✨</button>' +
        fightBtn
      : zone === "field"
        ? '<button type="button" class="hud-ico" onclick="App.goCity({fromField:true})" title="กลับเมือง">🏘</button>' + fightBtn
        : zone === "bosses" || zone === "boss-select"
          ? '<button type="button" class="hud-ico" onclick="App.goCity()" title="กลับเมือง">🏘</button>'
          : fightBtn;
    return (
      '<div class="adv-hud overlay" id="adv-hud">' +
      '<div class="hud-top">' +
      '<img class="hud-face" src="assets/chars/' + (save.heroId || "warrior") + '.png" alt="">' +
      '<div class="hud-id"><b>' + UI.esc(save.charName || hero.name || "") + "</b>" +
      "<small>Base " + save.baseLevel + " · Job " + save.jobLevel + "</small></div>" +
      '<div class="hud-vitals">' +
      UI.thinBar("hp", hp, d.maxHp, "HP") +
      UI.thinBar("mp", mp, d.maxMp, "MP") +
      UI.thinBar("base", save.baseExp, baseNeed, "EXP") +
      "</div>" +
      '<span class="zeno-chip hud-zeno">' + save.zeno + "</span>" +
      UI.weightChip(save, d) +
      '<span class="rt-aspd" id="rt-aspd">ASPD —</span>' +
      '<button type="button" class="hud-ico' + (farmOn ? " gold" : "") + '" onclick="App.goFarm()" title="Auto Farm">F</button>' +
      '<button type="button" class="hud-ico" onclick="App.openBag()" title="กระเป๋า">🎒</button>' +
      spend + cityBtns + extra +
      '<button type="button" class="hud-ico ghost" onclick="App.goHome()" title="หน้าแรก">⌂</button>' +
      "</div></div>"
    );
  };

  UI.refreshHud = function (save) {
    const el = document.getElementById("adv-hud");
    if (!el || !save) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = UI.adventureHud(save, typeof App !== "undefined" && App.screen === "boss-select" ? { zone: "boss-select" } : {});
    const next = wrap.firstChild;
    if (next) el.replaceWith(next);
  };

  UI.rtStrip = function (save) {
    const skills = [];
    if (save && save.heroId) {
      const ranks = save.skillRanks || DATA.defaultSkillRanks(save.heroId);
      (DATA.learnedSkills(save.heroId, ranks) || []).slice(0, 6).forEach(function (id) {
        skills.push(id);
      });
    }
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const sid = skills[i];
      const def = sid ? DATA.SKILLS[sid] : null;
      const icon = def && ((typeof FX !== "undefined" && FX.skillIcon(sid, def)) || def.icon);
      slots.push(
        '<button type="button" class="rt-skill' + (sid ? "" : " empty") + '" data-slot="' + i + '" ' +
        (sid ? 'onclick="App.useSkill(\'' + sid + "')\"" : "disabled") +
        ">" +
        (icon ? '<img src="' + icon + '" alt="">' : "") +
        '<em class="rt-key">' + (i + 1) + "</em>" +
        '<i class="rt-cd" hidden></i>' +
        "</button>"
      );
    }
    return (
      '<div class="rt-strip dock-br" id="rt-strip">' +
      '<div class="rt-bar" id="rt-bar">' + slots.join("") + "</div>" +
      "</div>"
    );
  };

  UI.refreshRt = function (model) {
    if (!model) return;
    if (model.unit) {
      const hud = document.getElementById("adv-hud");
      if (hud) {
        const wraps = hud.querySelectorAll(".hud-vitals .bar-wrap, .adv-bars .bar-wrap");
        wraps.forEach(function (wrap) {
          const fill = wrap.querySelector(".bar-fill");
          const lab = wrap.querySelector(".bar-label span:last-child");
          if (!fill) return;
          if (wrap.classList.contains("bar-hp")) {
            fill.style.width = (model.unit.maxHp ? 100 * model.unit.hp / model.unit.maxHp : 0).toFixed(2) + "%";
            if (lab) lab.textContent = UI.fmt(model.unit.hp, 0) + " / " + UI.fmt(model.unit.maxHp, 0);
          } else if (wrap.classList.contains("bar-mp")) {
            fill.style.width = (model.unit.maxMp ? 100 * model.unit.mp / model.unit.maxMp : 0).toFixed(2) + "%";
            if (lab) lab.textContent = UI.fmt(model.unit.mp, 0) + " / " + UI.fmt(model.unit.maxMp, 0);
          }
        });
      }
    }
    const tgt = document.getElementById("rt-target");
    if (tgt) {
      if (!model.target) {
        tgt.innerHTML = '<span class="rt-target-empty">ไม่มีเป้าหมาย</span>';
      } else {
        const t = model.target;
        const pct = t.maxHp ? Math.max(0, Math.min(100, (100 * t.hp) / t.maxHp)) : 0;
        tgt.innerHTML =
          '<b>' + UI.esc((t.emoji || "") + " " + t.name) + "</b>" +
          '<small>Lv.' + (t.level || 1) + " · " + UI.fmt(t.hp, 0) + "/" + UI.fmt(t.maxHp, 0) + "</small>" +
          '<div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>';
      }
    }
    const aspd = document.getElementById("rt-aspd");
    if (aspd) {
      const rate = model.finalAspd != null ? model.finalAspd : model.aspeed;
      const score = model.aspdScore != null ? model.aspdScore : null;
      aspd.textContent =
        "ASPD " +
        (model.intervalMs != null ? model.intervalMs : (model.aspd || "—")) +
        "ms" +
        (rate ? " · " + UI.fmt(rate, 2) + "/s" : "") +
        (score != null ? " (" + UI.fmt(score, 2) + ")" : "");
    }
    const bar = document.getElementById("rt-bar");
    if (bar && model.unit) {
      const skills = model.skills || [];
      bar.querySelectorAll(".rt-skill").forEach(function (btn, i) {
        const sid = skills[i];
        const cdEl = btn.querySelector(".rt-cd");
        if (!sid || !cdEl) return;
        const left = (model.unit.cds && model.unit.cds[sid]) || 0;
        const def = DATA.SKILLS[sid] || DATA.BOSS_SKILLS[sid];
        const ready = def ? COMBAT.skillReady(model.unit, sid, def) : false;
        btn.classList.toggle("disabled", !ready);
        if (left > 0) {
          cdEl.hidden = false;
          cdEl.textContent = left >= 1000 ? (left / 1000).toFixed(1) : "0." + Math.floor(left / 100);
        } else {
          cdEl.hidden = true;
        }
      });
    }
    const p2 = document.getElementById("rt-bar-p2");
    if (p2 && model.foeUnit) {
      const skills = model.foeSkills || [];
      p2.querySelectorAll(".rt-skill").forEach(function (btn, i) {
        const sid = skills[i];
        const cdEl = btn.querySelector(".rt-cd");
        if (!sid || !cdEl) return;
        const left = (model.foeUnit.cds && model.foeUnit.cds[sid]) || 0;
        if (left > 0) {
          cdEl.hidden = false;
          cdEl.textContent = left >= 1000 ? (left / 1000).toFixed(1) : "0." + Math.floor(left / 100);
        } else {
          cdEl.hidden = true;
        }
      });
    }
  };

  UI.bossSelect = function (save) {
    UI.setWalkMode(false);
    save = save || {};
    if (typeof PVE !== "undefined" && PVE.ensureProgress) PVE.ensureProgress(save);
    const cleared = save.clearedBosses || {};
    const cards = DATA.BOSSES.map(function (b) {
      const star = cleared[b.id] ? " ★" : "";
      return (
        '<article class="boss-card' +
        (cleared[b.id] ? " cleared" : "") +
        '" style="--hero:' +
        (b.color || "#c9a227") +
        '">' +
        '<div class="boss-card-emo">' +
        b.emoji +
        "</div>" +
        "<h3>" +
        UI.esc(b.name) +
        star +
        "</h3>" +
        "<small>Lv." +
        b.level +
        (b.place ? " · " + UI.esc(b.place) : "") +
        "</small>" +
        '<ul class="mini-stats">' +
        "<li>HP " +
        b.hp +
        "</li>" +
        "<li>ATK " +
        b.atk +
        " · DEF " +
        b.def +
        "</li>" +
        "</ul>" +
        '<button type="button" class="btn gold wide" onclick="App.pickBoss(\'' +
        b.id +
        "')\">สู้</button>" +
        "</article>"
      );
    }).join("");
    const backFn =
      typeof App !== "undefined" && App.goCity ? "App.goCity()" : "App.goHome()";
    UI.el().innerHTML =
      '<section class="panel boss-select-panel">' +
      "<h2>เลือกบอส</h2>" +
      '<p class="lead">เลือกบอสจากรายการ แล้วเข้าฉากเทิร์นเบส ATB — ไม่ต้องเดินชนบนแผนที่</p>' +
      (save.heroId ? UI.adventureHud(save, { zone: "boss-select" }) : "") +
      '<div class="boss-grid">' +
      cards +
      "</div>" +
      '<div class="btn-row">' +
      '<button type="button" class="btn ghost" onclick="' +
      backFn +
      '">กลับ</button>' +
      "</div></section>";
  };

  UI.worldMap = function (save) {
    save = save || {};
    PVE.ensureProgress(save);
    UI.setWalkMode(true);
    const zone = save.mapId || "city";
    const titles = { city: "เมืองพรอนเทรา", field: "ทุ่งพรอนเทรา", bosses: "ปราสาทโลหิต" };
    UI.el().innerHTML =
      '<section class="map-fs zone-' + zone + '">' +
      '<div id="world-map" class="world-map fs ' + zone + '"></div>' +
      UI.adventureHud(save, { zone: zone }) +
      UI.rtStrip(save) +
      '<div id="walk-pad" class="walk-pad">' +
      '<button type="button" class="pad-btn pad-n" data-dx="0" data-dy="-1" aria-label="ขึ้น">▲</button>' +
      '<button type="button" class="pad-btn pad-w" data-dx="-1" data-dy="0" aria-label="ซ้าย">◀</button>' +
      '<button type="button" class="pad-btn pad-e" data-dx="1" data-dy="0" aria-label="ขวา">▶</button>' +
      '<button type="button" class="pad-btn pad-s" data-dx="0" data-dy="1" aria-label="ลง">▼</button>' +
      '<button type="button" class="pad-btn pad-nw" data-dx="-1" data-dy="-1" aria-label="ทแยงบนซ้าย">◤</button>' +
      '<button type="button" class="pad-btn pad-ne" data-dx="1" data-dy="-1" aria-label="ทแยงบนขวา">◥</button>' +
      '<button type="button" class="pad-btn pad-sw" data-dx="-1" data-dy="1" aria-label="ทแยงล่างซ้าย">◣</button>' +
      '<button type="button" class="pad-btn pad-se" data-dx="1" data-dy="1" aria-label="ทแยงล่างขวา">◢</button>' +
      "</div>" +
      '<div class="hud-zone-lab">' + (titles[zone] || "") + "</div>" +
      '<div id="city-dock" class="city-dock">' +
      '<button type="button" class="ro-btn" onclick="App.goCitySkills()">SKILL <small>K</small></button>' +
      '<button type="button" class="ro-btn" onclick="App.goCityStatus()">STATUS <small>C</small></button>' +
      '<button type="button" class="ro-btn" onclick="App.goFarm()">FARM</button>' +
      '<button type="button" class="ro-btn" onclick="App.toggleSit()">SIT <small>N</small></button>' +
      '<button type="button" class="ro-btn" onclick="App.goInv()">INV <small>I</small></button>' +
      '<button type="button" class="ro-btn" onclick="App.goEquip()">สวมใส่ <small>E</small></button>' +
      '<button type="button" class="ro-btn" onclick="App.goShop()">ร้านอุปกรณ์ <small>R</small></button>' +
      '<button type="button" class="ro-btn" onclick="App.goRefine()">ตีบวก</button>' +
      '<button type="button" class="ro-btn" onclick="App.goPotionShop()">ร้านยา <small>R</small></button>' +
      '<button type="button" class="ro-btn" onclick="App.goSave()">SAVE</button>' +
      "</div>" +
      "</section>";
    if (typeof MAP !== "undefined") MAP.mount(document.getElementById("world-map"), save);
  };

  UI.arena = function (opts) {
    opts = opts || {};
    UI.setWalkMode(true);
    const left = opts.left;
    const right = opts.right;
    const local = !!opts.local;
    UI.el().innerHTML =
      '<section class="map-fs zone-arena">' +
      '<div id="world-map" class="world-map fs arena"></div>' +
      (opts.save ? UI.adventureHud(opts.save) : '<div class="adv-hud overlay" id="adv-hud"><div class="hud-top"><b>ลานประลอง</b></div></div>') +
      UI.rtStrip(opts.save || { heroId: left && left.heroId, skillRanks: left && left.skillRanks }) +
      (local ? '<div class="rt-strip p2 dock-br-2" id="rt-strip-p2"><div class="rt-bar" id="rt-bar-p2"></div></div>' : "") +
      '<div id="walk-pad" class="walk-pad">' +
      '<button type="button" class="pad-btn pad-n" data-dx="0" data-dy="-1">▲</button>' +
      '<button type="button" class="pad-btn pad-w" data-dx="-1" data-dy="0">◀</button>' +
      '<button type="button" class="pad-btn pad-e" data-dx="1" data-dy="0">▶</button>' +
      '<button type="button" class="pad-btn pad-s" data-dx="0" data-dy="1">▼</button>' +
      '<button type="button" class="pad-btn pad-nw" data-dx="-1" data-dy="-1">◤</button>' +
      '<button type="button" class="pad-btn pad-ne" data-dx="1" data-dy="-1">◥</button>' +
      '<button type="button" class="pad-btn pad-sw" data-dx="-1" data-dy="1">◣</button>' +
      '<button type="button" class="pad-btn pad-se" data-dx="1" data-dy="1">◢</button></div>' +
      '<button type="button" class="hud-ico ghost hud-forfeit" onclick="App.goHome()">ถอนตัว</button>' +
      "</section>";
    const host = document.getElementById("world-map");
    if (host) {
      const cols = 23;
      const rows = 23;
      const tiles = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const edge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
          tiles.push('<div class="map-tile ' + (edge ? "block" : "path") + '" data-mx="' + x + '" data-my="' + y + '"></div>');
        }
      }
      host.innerHTML =
        '<div class="map-grid theme-arena" style="--cols:' + cols + ';--rows:' + rows + ';--view:23">' + tiles.join("") + "</div>";
    }
    if (local) {
      const p2bar = document.getElementById("rt-bar-p2");
      if (p2bar && right && right.skills) {
        const keys = ["Q", "U", "E", "R", "T", "Y"];
        p2bar.innerHTML = right.skills.slice(0, 6).map(function (sid, i) {
          const def = DATA.SKILLS[sid];
          const icon = def && ((typeof FX !== "undefined" && FX.skillIcon(sid, def)) || def.icon);
          return (
            '<button type="button" class="rt-skill" data-slot="' + i + '" onclick="App.useSkillP2(\'' + sid + "')\">" +
            (icon ? '<img src="' + icon + '" alt="">' : "") +
            '<em class="rt-key">' + keys[i] + "</em>" +
            '<i class="rt-cd" hidden></i></button>'
          );
        }).join("");
      }
    }
  };

  UI.potionShop = function (save, opts) {
    opts = opts || {};
    PVE.ensureProgress(save);
    const rows = DATA.POTION_ORDER.map(function (id) {
      const it = DATA.POTIONS[id];
      const n = PVE.potionCount(save, id);
      const can = save.zeno >= it.price;
      const remain = PVE.potionBuffRemainMs(save, id);
      const remainTxt = remain > 0 ? " · เหลือ " + PVE.fmtRemain(remain) : "";
      return (
        '<div class="item-row"><div><b>' + it.emoji + " " + it.name +
        "</b><div class=\"item-bon\">" + it.desc + " · " + DATA.itemWeight(it) + "g · มี " + n +
        " ขวด" + remainTxt +
        '</div></div><div class="item-buy">' +
        '<button type="button" class="btn small ' + (can ? "gold" : "disabled") + '" ' +
        (can ? 'onclick="App.buyPotion(\'' + id + "')\"" : "disabled") +
        ">ซื้อ " + it.price + " · " + DATA.itemWeight(it) + "g</button>" + (n > 0 ? UI.qtyStrip("qty-" + id, n) + UI.sellBtn(id, "App.qtyOf('qty-" + id + "'," + n + ")") : "") + "</div></div>"
      );
    }).join("");
    const nav = opts.overlay
      ? '<button type="button" class="btn ghost wide" onclick="App.closeCityWin()">ปิด</button>'
      : '<button type="button" class="btn gold wide" onclick="App.goWorld()">กลับเมือง</button>';
    const inner =
      (opts.overlay ? "" : " <h2>ร้านยา พรอนเทรา</h2>") +
      '<div class="zeno-chip">เงินคงเหลือ <b>' + save.zeno + "</b> Zeno</div>" +
      '<p class="hint">ยาซ้อนจำนวนได้ · ใช้จากกระเป๋าบน HUD · Auto Farm จะดื่มยาแดง/ส้มเมื่อ HP ต่ำกว่า 40%</p>' +
      '<div class="item-list">' + rows + "</div>" +
      nav;
    if (opts.overlay) return inner;
    UI.setWalkMode(false);
    UI.el().innerHTML = '<section class="panel shop-panel ro-win">' + inner + "</section>";
  };

  UI.kafra = function (save) {
    UI.setWalkMode(false);
    PVE.ensureProgress(save);
    const d = PVE.derived(save);
    UI.el().innerHTML =
      '<section class="panel">' +
      "<h2>คาฟร้า · พรอนเทรา</h2>" +
      '<p class="lead">บริการรักษาและดูคลังอุปกรณ์ที่ยังไม่สวม</p>' +
      '<div class="zeno-chip">' + save.zeno + " Zeno · HP " + UI.fmt(save.hp, 0) + "/" + UI.fmt(d.maxHp, 0) +
      " · MP " + UI.fmt(save.mp, 0) + "/" + UI.fmt(d.maxMp, 0) + "</div>" +
      '<div class="btn-col">' +
      '<button type="button" class="btn gold" onclick="App.kafraHeal()">รักษาเต็ม (' + DATA.KAFRA_HEAL_COST + " Zeno)</button>" +
      '<button type="button" class="btn" onclick="App.goEquip()">เปิดคลัง / สวมใส่</button>' +
      '<button type="button" class="btn" onclick="App.goRefine()">ตีบวกอุปกรณ์</button>' +
      '<button type="button" class="btn ghost" onclick="App.goWorld()">กลับเมือง</button>' +
      "</div></section>";
  };

  UI.qtyStrip = function (id, max) {
    max = Math.max(1, Math.floor(Number(max) || 1));
    var ten = Math.min(10, max);
    return (
      '<span class="qty-strip" onclick="event.stopPropagation()">' +
      '<button type="button" class="btn tiny" onclick="event.stopPropagation();var i=document.getElementById(\'' + id + '\');if(i)i.value=1;">1</button>' +
      '<button type="button" class="btn tiny" onclick="event.stopPropagation();var i=document.getElementById(\'' + id + '\');if(i)i.value=' + ten + ';">10</button>' +
      '<button type="button" class="btn tiny" onclick="event.stopPropagation();var i=document.getElementById(\'' + id + '\');if(i)i.value=' + max + ';">ทั้งหมด</button>' +
      '<input type="number" id="' + id + '" min="1" max="' + max + '" value="1" style="width:2.4rem;font-size:0.75rem" onclick="event.stopPropagation()">' +
      "</span>"
    );
  };

  UI.sellBtn = function (id, qtyExpr, label) {
    return '<button type="button" class="btn tiny sell" onclick="event.stopPropagation();App.sellItem(\'' +
      id + "', " + qtyExpr + ')">' + (label || "ขาย") + "</button>";
  };

  UI.dropBtn = function (id, qtyExpr) {
    return '<button type="button" class="btn tiny drop" onclick="event.stopPropagation();App.dropItem(\'' +
      id + "'," + qtyExpr + ')">โยนทิ้ง</button>';
  };

  UI.stackActions = function (id, max, opts) {
    opts = opts || {};
    var city = opts.city !== false;
    var gear = !!opts.gear;
    var qid = opts.qtyId || ("qty-" + id);
    var html = '<div class="inv-actions" onclick="event.stopPropagation()" style="display:flex;flex-wrap:wrap;gap:0.1rem;justify-content:center">';
    if (!gear && max > 0) html += UI.qtyStrip(qid, max);
    if (city && max > 0) html += UI.sellBtn(id, gear ? "1" : "App.qtyOf('" + qid + "'," + max + ")");
    if (max > 0) html += UI.dropBtn(id, gear ? "1" : "App.qtyOf('" + qid + "'," + max + ")");
    html += "</div>";
    return html;
  };


  UI._invTab = UI._invTab || "use";

  UI.slotTypeLabel = function (item) {
    if (!item) return "";
    var slots = DATA.SLOTS || [];
    var i;
    for (i = 0; i < slots.length; i++) {
      if (slots[i].type === item.type) return slots[i].name;
    }
    return item.type || "";
  };

  UI.farmWin = function (save) {
    PVE.ensureProgress(save);
    var cfg = PVE.ensureAutoFarmCfg(save);
    var farmOn = !!save.autoFarm;
    var mobLabel = "ทุกตัว";
    if (cfg.mobNone) mobLabel = "0 ชนิด";
    else if (cfg.mobIds && cfg.mobIds.length) mobLabel = cfg.mobIds.length + " ชนิด";
    var learned = PVE.learnedSkillIds(save).filter(function (id) {
      var d = DATA.SKILLS[id];
      return d && d.type !== "passive";
    });
    var pal = learned.map(function (id) {
      var def = DATA.SKILLS[id] || {};
      var icon = def.icon || "";
      var picked = typeof App !== "undefined" && App._farmPickedSkill === id;
      return (
        '<button type="button" class="farm-pal-skill' + (picked ? " picked" : "") +
        '" draggable="true" data-skill="' + UI.esc(id) +
        '" onclick="App._farmPickSkill(this.dataset.skill)">' +
        (icon ? '<img src="' + UI.esc(icon) + '" alt="">' : "") +
        "<span>" + UI.esc(def.name || id) + "</span></button>"
      );
    }).join("");
    var slots = "";
    var i;
    for (i = 0; i < 4; i++) {
      var sid = cfg.skills[i];
      var def = sid ? DATA.SKILLS[sid] : null;
      var inner;
      if (def) {
        inner =
          (def.icon ? '<img src="' + UI.esc(def.icon) + '" alt="">' : "") +
          '<button type="button" class="farm-slot-x" data-clear-skill="' + i +
          '" onclick="event.stopPropagation();App.setFarmSkill(' + i + ',null)" title="ลบ">×</button>';
      } else {
        inner = "<em>[ ]</em>";
      }
      slots +=
        '<div class="farm-skill-slot farm-slot' + (sid ? "" : " empty") +
        '" data-slot="' + i + '" data-filled="' + (sid ? "1" : "0") +
        '" data-skill="' + UI.esc(sid || "") +
        '" title="' + UI.esc(def ? def.name : "ว่าง") + '">' +
        inner +
        "</div>";
    }
    var potRows = "";
    for (i = 0; i < 3; i++) {
      var pot = cfg.pots[i] || { id: null, when: "hp", pct: 40 };
      var opts = '<option value="">ว่าง</option>' + DATA.POTION_ORDER.map(function (id) {
        var it = DATA.POTIONS[id];
        var n = PVE.potionCount(save, id);
        var sel = pot.id === id ? " selected" : "";
        var dis = n < 1 && pot.id !== id ? " disabled" : "";
        return '<option value="' + UI.esc(id) + '"' + sel + dis + ">" +
          UI.esc((it.emoji || "") + " " + it.name) + " ×" + n + "</option>";
      }).join("");
      potRows +=
        '<div class="farm-pot-row" data-farm-pot="' + i + '">' +
        '<span class="farm-pot-lab">ช่อง ' + (i + 1) + "</span>" +
        '<select class="ro-input farm-pot-id">' + opts + "</select>" +
        '<label><input type="radio" name="farm-when-' + i + '" value="hp"' +
        (pot.when !== "mp" ? " checked" : "") + "> HP</label>" +
        '<label><input type="radio" name="farm-when-' + i + '" value="mp"' +
        (pot.when === "mp" ? " checked" : "") + "> MP</label>" +
        '<label>ใช้เมื่อต่ำกว่า <input type="number" class="ro-input farm-pot-pct" min="1" max="99" value="' +
        pot.pct + '"> %</label>' +
        "</div>";
    }
    return (
      '<div class="farm-win-body">' +
      '<div class="farm-on-row">' +
      '<label><input type="checkbox"' + (farmOn ? " checked" : "") +
      ' onchange="App.setAutoFarm(this.checked)"> <b>เปิด Auto Farm</b></label>' +
      '<span class="farm-on-flag">' + (farmOn ? "ON" : "OFF") + "</span>" +
      "</div>" +
      '<div class="farm-mob-row">' +
      "<span>มอนที่จะตี: <b>" + UI.esc(mobLabel) + "</b></span>" +
      '<button type="button" class="ro-btn" onclick="App.goFarmMobs()">เลือกมอน</button>' +
      "</div>" +
      " <h3>นั่งพัก</h3>" +
      '<div class="farm-sit-row">' +
      '<label><input type="checkbox"' + (cfg.sitHpOn ? " checked" : "") +
      ' onchange="App.setFarmSit({sitHpOn:this.checked})"> HP</label>' +
      '<label>นั่งเมื่อ HP ต่ำกว่า <input type="number" min="1" max="99" value="' +
      cfg.sitHp +
      '" class="ro-input farm-num" onchange="App.setFarmSit({sitHp:this.value})"> %</label>' +
      "</div>" +
      '<div class="farm-sit-row">' +
      '<label><input type="checkbox"' + (cfg.sitMpOn ? " checked" : "") +
      ' onchange="App.setFarmSit({sitMpOn:this.checked})"> MP</label>' +
      '<label>นั่งเมื่อ MP ต่ำกว่า <input type="number" min="1" max="99" value="' +
      cfg.sitMp +
      '" class="ro-input farm-num" onchange="App.setFarmSit({sitMp:this.value})"> %</label>' +
      "</div>" +
      " <h3>สกิลฟาร์ม (ลากได้ 4 ช่อง)</h3>" +
      '<div class="farm-skill-pal">' + pal + "</div>" +
      '<div class="farm-skill-row">' + slots + "</div>" +
      " <h3>ยาออโต้</h3>" +
      '<div class="farm-pots">' + potRows + "</div>" +
      "</div>"
    );
  };

  UI.farmMobsWin = function (save) {
    PVE.ensureProgress(save);
    var cfg = PVE.ensureAutoFarmCfg(save);
    var bosses = !!(save && save.mapId === "bosses");
    var subtitle = bosses ? "ปราสาทโลหิต" : "ทุ่งพรอนเทรา";
    var catalog = PVE.farmMobCatalog(save);
    var selected = {};
    var allOn = !cfg.mobNone && (!cfg.mobIds || !cfg.mobIds.length);
    if (!allOn && !cfg.mobNone && cfg.mobIds) {
      cfg.mobIds.forEach(function (id) { selected[id] = true; });
    }
    var tools =
      '<div class="farm-mob-tools">' +
      '<button type="button" class="ro-btn" onclick="App.setFarmMobsAll()">เลือกทั้งหมด</button>' +
      '<button type="button" class="ro-btn" onclick="App.setFarmMobsNone()">ล้างทั้งหมด</button>' +
      "</div>";
    var hint = bosses ? "" : '<p class="hint">มอนในทุ่งพรอนเทรา</p>';
    var cards = "";
    if (!catalog.length) {
      cards = '<p class="hint">ยังไม่มีมอนในแผนที่นี้</p>';
    } else {
      cards = '<div class="farm-mob-grid">' + catalog.map(function (def) {
        var id = def && def.id ? String(def.id) : "";
        var on = allOn || !!(id && selected[id]);
        var src = def.portrait || def.sprite || "";
        var art = src
          ? '<img src="' + UI.esc(src) + '" alt="">'
          : '<span class="farm-mob-emoji">' + UI.esc(def.emoji || "") + "</span>";
        var lv = def.level != null ? "<small>Lv." + UI.esc(def.level) + "</small>" : "";
        return (
          '<button type="button" class="ro-slot farm-mob-card' + (on ? " on" : "") +
          '" data-id="' + UI.esc(id) +
          '" onclick="App.toggleFarmMob(this.dataset.id)">' +
          '<span class="farm-mob-check" aria-hidden="true"></span>' +
          art +
          "<b>" + UI.esc(def.name || id) + "</b>" +
          lv +
          "</button>"
        );
      }).join("") + "</div>";
    }
    return (
      '<div class="farm-mobs-body">' +
      '<p class="lead">' + UI.esc(subtitle) + "</p>" +
      hint +
      tools +
      cards +
      "</div>"
    );
  };

  UI.bindFarmDrag = function (root) {
    if (!root) return;
    var pals = root.querySelectorAll(".farm-pal-skill");
    var slots = root.querySelectorAll(".farm-skill-slot");
    pals.forEach(function (el) {
      el.addEventListener("dragstart", function (ev) {
        var id = el.getAttribute("data-skill") || "";
        if (ev.dataTransfer) {
          ev.dataTransfer.setData("text/plain", id);
          ev.dataTransfer.effectAllowed = "copy";
        }
        if (typeof App !== "undefined") {
          App._farmDragSkill = id;
          App._farmDragFromSlot = null;
          App._droppedFarm = false;
        }
      });
    });
    slots.forEach(function (slot) {
      slot.addEventListener("dragover", function (ev) {
        ev.preventDefault();
        slot.classList.add("drag-over");
      });
      slot.addEventListener("dragleave", function () {
        slot.classList.remove("drag-over");
      });
      slot.addEventListener("drop", function (ev) {
        ev.preventDefault();
        slot.classList.remove("drag-over");
        var id = (ev.dataTransfer && ev.dataTransfer.getData("text/plain")) ||
          (typeof App !== "undefined" && App._farmDragSkill) || "";
        var idx = Number(slot.getAttribute("data-slot"));
        if (typeof App !== "undefined") {
          App._droppedFarm = true;
          App.setFarmSkill(idx, id || null);
        }
      });
      slot.addEventListener("click", function (ev) {
        if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-clear-skill") != null) {
          return;
        }
        if (typeof App !== "undefined" && App._farmPickedSkill) {
          App.setFarmSkill(Number(slot.getAttribute("data-slot")), App._farmPickedSkill);
          App._farmPickedSkill = null;
        }
      });
      if (slot.getAttribute("data-filled") === "1") {
        slot.setAttribute("draggable", "true");
        slot.addEventListener("dragstart", function (ev) {
          var id = slot.getAttribute("data-skill") || "";
          if (ev.dataTransfer) ev.dataTransfer.setData("text/plain", id);
          if (typeof App !== "undefined") {
            App._farmDragSkill = id;
            App._farmDragFromSlot = Number(slot.getAttribute("data-slot"));
            App._droppedFarm = false;
          }
        });
        slot.addEventListener("dragend", function () {
          if (typeof App === "undefined") return;
          if (!App._droppedFarm && App._farmDragFromSlot != null) {
            App.setFarmSkill(App._farmDragFromSlot, null);
          }
          App._farmDragFromSlot = null;
          App._farmDragSkill = null;
          App._droppedFarm = false;
        });
      }
    });
    root.querySelectorAll("[data-farm-pot]").forEach(function (row) {
      var idx = Number(row.getAttribute("data-farm-pot"));
      function apply() {
        var idEl = row.querySelector(".farm-pot-id");
        var pctEl = row.querySelector(".farm-pot-pct");
        var whenEl = row.querySelector("input[type=radio]:checked");
        if (typeof App !== "undefined") {
          App.setFarmPot(idx, {
            id: idEl && idEl.value ? idEl.value : null,
            when: whenEl ? whenEl.value : "hp",
            pct: pctEl ? pctEl.value : 40,
          });
        }
      }
      row.querySelectorAll("select, input").forEach(function (inp) {
        inp.addEventListener("change", apply);
      });
    });
  };

  UI.invWin = function (save) {
    PVE.ensureProgress(save);
    var tab = UI._invTab || "use";
    var inCity = !(PVE.inProntera) || PVE.inProntera(save);
    var ws = PVE.weightState(save);
    var wr = ws.ratio != null ? ws.ratio : (ws.max ? ws.cur / ws.max : 0);
    var wcls = wr >= 1 ? " full" : wr >= 0.9 ? " over" : wr >= 0.7 ? " heavy" : "";
    var wline = '<div class="hud-weight' + wcls + '">น้ำหนัก <b>' + Math.floor(ws.cur) + "</b> / " + ws.max + " g</div>";
    var tabs =
      '<div class="inv-tabs">' +
      '<button type="button" class="ro-btn' + (tab === "use" ? " on" : "") +
      '" data-tab="use" onclick="App.setInvTab(this.dataset.tab)">ใช้ / ยา</button>' +
      '<button type="button" class="ro-btn' + (tab === "equip" ? " on" : "") +
      '" data-tab="equip" onclick="App.setInvTab(this.dataset.tab)">สวมใส่</button>' +
      '<button type="button" class="ro-btn' + (tab === "mat" ? " on" : "") +
      '" data-tab="mat" onclick="App.setInvTab(this.dataset.tab)">วัสดุ</button>' +
      "</div>";
    var grid = "";
    if (tab === "use") {
      grid = DATA.POTION_ORDER.map(function (id) {
        var it = DATA.POTIONS[id];
        var n = PVE.potionCount(save, id);
        var remain = PVE.potionBuffRemainMs(save, id);
        var remainTxt = remain > 0 ? '<small class="inv-remain">เหลือ ' + PVE.fmtRemain(remain) + "</small>" : "";
        return (
          '<div class="inv-cell">' +
          '<button type="button" class="ro-slot inv-slot' + (n ? "" : " empty") +
          '" data-id="' + UI.esc(id) + '" ' +
          (n ? 'onclick="App.usePotion(this.dataset.id)"' : "disabled") +
          ">" +
          '<span class="inv-emoji">' + (it.emoji || "") + "</span>" +
          "<b>" + UI.esc(it.name) + "</b>" +
          "<small>×" + n + " · " + DATA.itemWeight(id) + "g</small>" +
          remainTxt +
          (n ? "<em>ใช้</em>" : "") +
          "</button>" +
          (n ? UI.stackActions(id, n, { city: inCity, qtyId: "qty-" + id }) : "") +
          "</div>"
        );
      }).join("");
      if (save.ammo && save.ammo.id && PVE.isBowHero && PVE.isBowHero(save.heroId)) {
        var aid = save.ammo.id;
        var ait = DATA.ITEMS && DATA.ITEMS[aid];
        var an = PVE.stackCount ? PVE.stackCount(save, aid) : ((save.ammo && save.ammo.count) || 0);
        if (ait) {
          grid +=
            '<div class="inv-cell">' +
            '<div class="ro-slot inv-slot' + (an ? "" : " empty") + '">' +
            "<b>" + UI.esc(ait.name) + "</b>" +
            "<small>×" + an + " · " + DATA.itemWeight(aid) + "g</small></div>" +
            (an ? UI.stackActions(aid, an, { city: inCity, qtyId: "qty-" + aid }) : "") +
            "</div>";
        }
      }
    } else if (tab === "equip") {
      var ownedIds = Object.keys(DATA.ITEMS).filter(function (id) { return save.owned && save.owned[id]; });
      if (!ownedIds.length) {
        grid = '<p class="hint">ยังไม่มีอุปกรณ์</p>';
      } else {
        grid = ownedIds.map(function (id) {
          var it = DATA.ITEMS[id];
          var worn = (DATA.SLOTS || []).some(function (sl) { return save.equip && save.equip[sl.id] === id; });
          var slotName = UI.slotTypeLabel(it);
          return (
            '<div class="inv-cell">' +
            '<button type="button" class="ro-slot inv-slot' + (worn ? " equipped" : "") +
            '" data-id="' + UI.esc(it.id) +
            '" onclick="App.toggleInvItem(this.dataset.id)">' +
            "<b>" + UI.esc(it.name) + "</b>" +
            "<small>" + UI.esc(slotName) + " · " + DATA.itemWeight(it) + "g</small>" +
            (worn ? '<em class="inv-badge on">ใส่อยู่</em>' : "") +
            "</button>" +
            UI.stackActions(id, 1, { city: inCity, gear: true }) +
            "</div>"
          );
        }).join("");
      }
    } else {
      save.materials = save.materials || {};
      var matIds = Object.keys(DATA.MATERIALS || {});
      Object.keys(save.materials).forEach(function (id) {
        if (matIds.indexOf(id) < 0) matIds.push(id);
      });
      var any = matIds.some(function (id) { return (save.materials[id] || 0) > 0; });
      if (!any) {
        grid = '<p class="hint">ยังไม่มีวัสดุ</p>';
      } else {
        grid = matIds.map(function (id) {
          var def = (DATA.MATERIALS && DATA.MATERIALS[id]) || { name: id, emoji: "◇" };
          var n = save.materials[id] || 0;
          return (
            '<div class="inv-cell">' +
            '<div class="ro-slot inv-slot' + (n ? "" : " empty") + '">' +
            '<span class="inv-emoji">' + (def.emoji || "") + "</span>" +
            "<b>" + UI.esc(def.name) + "</b>" +
            "<small>×" + n + " · " + DATA.itemWeight(id) + "g</small></div>" +
            (n ? UI.stackActions(id, n, { city: inCity, qtyId: "qty-mat-" + id }) : "") +
            "</div>"
          );
        }).join("");
      }
    }
    return wline + tabs + '<div class="inv-grid">' + grid + "</div>";
  };

  UI.openCityWin = function (kind, save) {
    const titles = {
      equip: "สวมใส่อุปกรณ์",
      shop: "ร้านค้าอุปกรณ์",
      refine: "ตีบวก",
      potions: "ร้านยา",
      skills: "SKILL",
      status: "STATUS",
      save: "SAVE",
      farm: "AUTO FARM",
      inv: "INVENTORY / กระเป๋า",
      "farm-mobs": "เลือกมอนเตอร์",
    };
    if (!titles[kind]) return;
    UI._cityWinKind = kind;
    let overlay = document.getElementById("city-win-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "city-win-overlay";
      document.body.appendChild(overlay);
    }
    let inner = "";
    if (kind === "equip") inner = UI.equip(save, { overlay: true });
    else if (kind === "shop") inner = UI.shop(save, { overlay: true });
    else if (kind === "refine") inner = UI.refine(save, { overlay: true });
    else if (kind === "potions") inner = UI.potionShop(save, { overlay: true });
    else if (kind === "skills") {
      const App = (typeof window !== "undefined" && window.App) || (typeof globalThis !== "undefined" && globalThis.App);
      inner = UI.skills(App.skillSess, save.heroId, { overlay: true });
    } else if (kind === "status") {
      const App = (typeof window !== "undefined" && window.App) || (typeof globalThis !== "undefined" && globalThis.App);
      inner = UI.alloc(App.allocSess, save.heroId, {
        overlay: true,
        level: save.level,
        equip: save.equip,
        refine: save.refine,
        blurb: "แจกแต้มสถานะ — ไม่บังคับแจกครบ",
      });
    } else if (kind === "save") {
      inner = UI.saveForm(save);
    } else if (kind === "farm") {
      inner = UI.farmWin(save);
    } else if (kind === "inv") {
      inner = UI.invWin(save);
    } else if (kind === "farm-mobs") {
      inner = UI.farmMobsWin(save);
    }
    overlay.innerHTML =
      '<div class="ro-win city-win city-win-' + kind + '">' +
      '<div class="ro-title"><span>' +
      titles[kind] +
      '</span><button type="button" class="ro-x" onclick="App.closeCityWin()" aria-label="ปิด">×</button></div>' +
      '<div class="ro-body">' +
      inner +
      "</div></div>";
    overlay.className = "show";
    overlay.onclick = function (ev) {
      if (ev.target === overlay) App.closeCityWin();
    };
    UI.bindCityWinDrag(overlay.querySelector(".city-win"), kind);
    if (kind === "farm") UI.bindFarmDrag(overlay.querySelector(".city-win-farm") || overlay);
  };

  UI._cityWinPos = UI._cityWinPos || {};

  UI.bindCityWinDrag = function (win, kind) {
    if (!win) return;
    const bar = win.querySelector(".ro-title");
    if (!bar) return;
    const saved = UI._cityWinPos[kind];
    if (saved) {
      win.style.position = "absolute";
      win.style.left = saved.left;
      win.style.top = saved.top;
      win.style.margin = "0";
    }
    bar.addEventListener("mousedown", function (ev) {
      if (ev.button !== 0) return;
      if (ev.target.closest && ev.target.closest(".ro-x")) return;
      ev.preventDefault();
      ev.stopPropagation();
      const rect = win.getBoundingClientRect();
      const host = win.offsetParent || document.getElementById("city-win-overlay") || document.body;
      const hostRect = host.getBoundingClientRect();
      win.style.position = "absolute";
      win.style.left = (rect.left - hostRect.left) + "px";
      win.style.top = (rect.top - hostRect.top) + "px";
      win.style.margin = "0";
      const ox = ev.clientX - rect.left;
      const oy = ev.clientY - rect.top;
      function move(e) {
        let x = e.clientX - hostRect.left - ox;
        let y = e.clientY - hostRect.top - oy;
        const maxX = Math.max(0, hostRect.width - 96);
        const maxY = Math.max(0, hostRect.height - 36);
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x > maxX) x = maxX;
        if (y > maxY) y = maxY;
        win.style.left = x + "px";
        win.style.top = y + "px";
      }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        UI._cityWinPos[kind || UI._cityWinKind] = { left: win.style.left, top: win.style.top };
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  };

  UI.closeCityWin = function () {
    const overlay = document.getElementById("city-win-overlay");
    if (overlay) overlay.className = "";
    UI._cityWinKind = null;
  };

  UI.openBag = function (save) {
    UI.openCityWin("inv", save);
  };

  UI.closeBag = function () {
    const overlay = document.getElementById("bag-overlay");
    if (overlay) overlay.className = "";
  };

  UI.defeat = function (killer, opts) {
    UI.setWalkMode(false);
    opts = opts || {};
    let back = "";
    if (opts.retryBoss) {
      back += '<button type="button" class="btn gold" onclick="App.goBossSelect()">เลือกบอสอีกครั้ง</button>';
    }
    if (opts.city) {
      back += '<button type="button" class="btn' + (opts.retryBoss ? "" : " gold") + '" onclick="App.afterDefeatCity()">กลับเมือง</button>';
    } else if (!opts.retryBoss) {
      back += '<button type="button" class="btn gold" onclick="App.goHome()">' +
        (typeof App !== "undefined" && App.save ? "กลับเมือง" : "เริ่มใหม่") +
        "</button>";
    }
    UI.el().innerHTML =
      '<section class="panel result lose">' +
      " <h2>พ่ายแพ้...</h2>" +
      '<p class="lead">HP ฮีโร่เหลือ 0' +
      (killer ? " — ถูก " + UI.esc(killer) + " โค่น" : "") +
      (opts.city ? " · คง EXP ที่ได้แล้ว · ฟื้นที่เมือง 50% HP" : "") +
      "</p>" +
      back +
      "</section>";
  };

  UI.pvpResult = function (winnerName, stateCode) {
    const extra = stateCode
      ? "<h3>โค้ดสถานะสุดท้าย (ส่งให้อีกฝ่ายดูผล)</h3>" +
        '<textarea id="state-out" readonly rows="4">' +
        UI.esc(stateCode) +
        "</textarea>" +
        '<button type="button" class="btn gold" onclick="App.copyStateOut()">คัดลอกโค้ด</button>'
      : "";
    UI.el().innerHTML =
      '<section class="panel result win">' +
      "<h2>จบการดวล</h2>" +
      '<p class="lead">ผู้ชนะ: ' +
      UI.esc(winnerName) +
      "</p>" +
      extra +
      '<button type="button" class="btn gold" onclick="App.goHome()">กลับหน้าแรก</button>' +
      "</section>";
  };

  UI.inviteShow = function (code) {
    UI.setWalkMode(false);
    UI.el().innerHTML =
      '<section class="panel">' +
      "<h2>โค้ดคำเชิญ</h2>" +
      '<p class="lead">คัดลอกส่งให้เพื่อน แล้วรอรับโค้ดสถานะกลับมาเพื่อเล่นตาของตน</p>' +
      '<textarea id="invite-out" readonly rows="5">' +
      UI.esc(code) +
      "</textarea>" +
      '<div class="btn-row">' +
      '<button type="button" class="btn gold" onclick="App.copyInvite()">คัดลอกโค้ดคำเชิญ</button>' +
      "</div>" +
      "<h3>วางโค้ดสถานะจากเพื่อน แล้วกดโหลดโค้ด</h3>" +
      '<textarea id="state-in" rows="4" placeholder="วางโค้ดสถานะที่นี่"></textarea>' +
      '<button type="button" class="btn gold" onclick="App.loadStateCode()">โหลดโค้ด</button>' +
      '<button type="button" class="btn ghost" onclick="App.goHome()">กลับหน้าแรก</button>' +
      "</section>";
  };

  UI.joinScreen = function () {
    UI.setWalkMode(false);
    UI.el().innerHTML =
      '<section class="panel">' +
      "<h2>เข้าร่วมด้วยโค้ด</h2>" +
      '<p class="lead">วางโค้ดคำเชิญที่ได้รับจากเพื่อน</p>' +
      '<textarea id="invite-in" rows="5" placeholder="วางโค้ดคำเชิญที่นี่"></textarea>' +
      '<button type="button" class="btn gold" onclick="App.acceptInvite()">ใช้โค้ดคำเชิญ</button>' +
      '<button type="button" class="btn ghost" onclick="App.goPvpMenu()">กลับ</button>' +
      "</section>";
  };

  UI.toast = function (msg, ms) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = "show";
    clearTimeout(UI._toast);
    UI._toast = setTimeout(function () {
      t.className = "";
    }, ms || 1800);
  };


  UI.roomNeedServer = function () {
    UI.el().innerHTML =
      '<section class="panel">' +
      "<h2>โหมดห้อง (ออนไลน์ในเครื่อง / LAN)</h2>" +
      '<p class="lead">หน้านี้ถูกเปิดแบบไฟล์ (file://) จึงคุยกับเซิร์ฟเวอร์ไม่ได้</p>' +
      "<ol class=\"howto\">" +
      "<li>เปิดเทอร์มินัลในโฟลเดอร์เกม</li>" +
      "<li>รัน <code>python3 server.py</code></li>" +
      "<li>เปิดเบราว์เซอร์ที่ <b>http://localhost:8765/</b></li>" +
      "<li>ถ้าเล่นสองเครื่องบนไวไฟเดียวกัน ให้เปิด URL ที่เซิร์ฟเวอร์พิมพ์ว่า LAN</li>" +
      "</ol>" +
      '<button type="button" class="btn ghost" onclick="App.goPvpMenu()">กลับ</button>' +
      "</section>";
  };

  UI.roomJoinScreen = function () {
    UI.el().innerHTML =
      '<section class="panel">' +
      "<h2>เข้าห้อง</h2>" +
      '<p class="lead">ใส่รหัสห้อง 4–6 ตัวอักษรที่เพื่อนสร้างไว้</p>' +
      '<label class="field-lab">ชื่อของคุณ</label>' +
      '<input id="room-name" class="room-input" maxlength="24" placeholder="ผู้เข้าร่วม" />' +
      '<label class="field-lab">รหัสห้อง</label>' +
      '<input id="room-code" class="room-input room-code-in" maxlength="6" placeholder="7K2M" />' +
      '<div class="btn-row">' +
      '<button type="button" class="btn gold" onclick="App.pvpRoomJoin()">เข้าห้อง</button>' +
      '<button type="button" class="btn ghost" onclick="App.goPvpMenu()">กลับ</button>' +
      "</div></section>";
    const el = document.getElementById("room-code");
    if (el) el.focus();
  };

  UI.roomGone = function (msg) {
    UI.el().innerHTML =
      '<section class="panel result lose">' +
      "<h2>เพื่อนออกจากห้อง</h2>" +
      '<p class="lead">' +
      UI.esc(msg || "เพื่อนออกจากห้อง") +
      "</p>" +
      '<button type="button" class="btn gold" onclick="App.goHome()">กลับหน้าแรก</button>' +
      "</section>";
  };

  UI.roomLobby = function (snap) {
    snap = snap || {};
    const info = snap.info || (typeof ROOM !== "undefined" && ROOM.info) || {};
    const seat = snap.seat || (typeof ROOM !== "undefined" && ROOM.seat);
    const host = snap.host || {};
    const guest = snap.guest;
    const me = seat === "guest" ? guest : host;
    const code = snap.code || "";
    function slot(who, label) {
      if (!who) {
        return '<div class="room-seat empty"><h3>' + label + "</h3><p>รอคู่ต่อสู้เข้าห้อง...</p></div>";
      }
      const hid = who.heroId;
      const hero = hid && DATA.HEROES[hid];
      const port = hid ? "assets/chars/" + hid + ".png" : "";
      return (
        '<div class="room-seat' + (who.ready ? " ready" : "") + '"><h3>' +
        label + (who.ready ? " · พร้อม" : "") + "</h3>" +
        (port ? '<img class="room-hero-art" src="' + port + '" alt="">' : "") +
        "<p><b>" + UI.esc(who.name || "—") + "</b></p>" +
        "<p>" + (hero ? hero.emoji + " " + hero.name : "ยังไม่เลือกฮีโร่") + "</p>" +
        '<p class="hint">' + (who.hasAlloc ? "แจกแต้มแล้ว" : "ยังไม่แจกแต้ม") + "</p></div>"
      );
    }
    const canReady = me && me.heroId && me.hasAlloc;
    UI.el().innerHTML =
      '<section class="panel room-lobby">' +
      "<h2>ห้อง PvP</h2>" +
      '<div class="room-code-box">' +
      '<div class="room-code-big" id="room-code-big">' + UI.esc(code) + "</div>" +
      '<button type="button" class="btn gold" onclick="App.copyRoomCode()">คัดลอก</button>' +
      "</div>" +
      (info.lan
        ? '<p class="hint">เล่นสองเครื่อง: ให้เพื่อนเปิด <b>' + UI.esc(info.lan) + "</b> แล้วกดเข้าห้อง ใส่รหัสนี้</p>"
        : "") +
      '<div class="room-seats">' + slot(host, "เจ้าของห้อง") + slot(guest, "ผู้เข้าร่วม") + "</div>" +
      '<label class="field-lab">ชื่อของคุณ</label>' +
      '<input id="room-name" class="room-input" maxlength="24" value="' + UI.esc((me && me.name) || "") + '" />' +
      '<button type="button" class="btn small" onclick="App.roomSetName()">บันทึกชื่อ</button>' +
      '<div class="btn-col" style="margin-top:1rem">' +
      '<button type="button" class="btn gold" onclick="App.roomChooseHero()">เลือกฮีโร่ / แจกแต้ม ' + DATA.STAT_POINTS_TOTAL + '</button>' +
      '<button type="button" class="btn gold"' +
      (canReady ? ' onclick="App.roomReady()"' : " disabled") +
      ">" + (me && me.ready ? "ยกเลิกพร้อม" : "พร้อม") + "</button>" +
      '<p class="hint">' +
      (guest ? "เมื่อทั้งสองฝ่ายกดพร้อม จะดวลเรียลไทม์กับบิลด์ของอีกฝ่าย (อีกฝ่ายออโต้)" : "รอเพื่อนเข้าห้อง") +
      "</p>" +
      '<button type="button" class="btn ghost" onclick="App.goHome()">ออกจากห้อง</button>' +
      "</div></section>";
  };

  root.UI = UI;
})(typeof globalThis !== "undefined" ? globalThis : window);
