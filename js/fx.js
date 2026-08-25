/**
 * Combat FX — floating numbers + character sprite animations.
 * Kept separate so combat.js formulas stay untouched.
 */
(function (root) {
  const FX = {
    DURATION: 460,
  };

  FX.stage = function (side) {
    return document.querySelector('.char-stage[data-side="' + side + '"]');
  };

  FX.anim = function (side, cls) {
    const el = FX.stage(side);
    if (!el) return;
    const names = ["atk-l", "atk-r", "hit-l", "hit-r", "heal", "buff", "crit", "hit"];
    names.forEach(function (c) {
      el.classList.remove(c);
    });
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(el._fxT);
    el._fxT = setTimeout(function () {
      el.classList.remove(cls);
    }, FX.DURATION);
  };

  FX.floater = function (side, text, kind) {
    const stage = FX.stage(side);
    if (!stage) return;
    let layer = stage.querySelector(".fx-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "fx-layer";
      stage.appendChild(layer);
    }
    const n = document.createElement("div");
    n.className = "floater " + kind;
    n.textContent = text;
    const jitter = (Math.random() * 56 - 28).toFixed(1);
    n.style.left = "calc(50% + " + jitter + "px)";
    n.style.top = 28 + Math.random() * 18 + "%";
    if (kind === "crit") {
      const burst = document.createElement("span");
      burst.className = "crit-burst";
      n.appendChild(burst);
    }
    layer.appendChild(n);
    setTimeout(function () {
      if (n.parentNode) n.parentNode.removeChild(n);
    }, 2000);
  };

  FX.applyOne = function (e) {
    if (!e || !e.side) return;
    if (e.kind === "act") {
      if (e.anim === "heal") FX.anim(e.side, "heal");
      else if (e.anim === "buff") FX.anim(e.side, "buff");
      else FX.anim(e.side, e.side === "right" ? "atk-r" : "atk-l");
      return;
    }
    if (e.kind === "miss") {
      FX.floater(e.side, "หลบ", "miss");
      return;
    }
    if (e.kind === "heal") {
      const amt = Math.floor(e.amount || 0);
      if (amt > 0) {
        FX.floater(e.side, "+" + amt, "heal");
        FX.anim(e.side, "heal");
      }
      return;
    }
    if (e.kind === "poison" || (e.kind === "dmg" && e.poison) || (e.kind === "dmg" && e.source === "poison")) {
      const amt = Math.floor(e.amount || 0);
      if (amt <= 0) return;
      FX.floater(e.side, String(amt), "poison");
      FX.anim(e.side, e.side === "right" ? "hit-r" : "hit-l");
      return;
    }
    if (e.kind === "dmg") {
      const amt = Math.floor(e.amount || 0);
      if (amt <= 0) return;
      if (e.crit) {
        FX.floater(e.side, String(amt), "crit");
        const el = FX.stage(e.side);
        if (el) {
          ["atk-l", "atk-r", "hit-l", "hit-r", "heal", "buff", "crit", "hit"].forEach(function (c) {
            el.classList.remove(c);
          });
          void el.offsetWidth;
          el.classList.add(e.side === "right" ? "hit-r" : "hit-l");
          el.classList.add("crit");
          clearTimeout(el._fxT);
          el._fxT = setTimeout(function () {
            el.classList.remove("hit-r");
            el.classList.remove("hit-l");
            el.classList.remove("crit");
          }, FX.DURATION);
        }
      } else {
        FX.floater(e.side, String(amt), "dmg");
        FX.anim(e.side, e.side === "right" ? "hit-r" : "hit-l");
      }
      if (root.AUDIO && AUDIO.onHitFx) {
        const heroId = (root.App && App.save && App.save.heroId) ||
          (root.App && App.combat && App.combat.left && App.combat.left.heroId) || "";
        if (e.side === "right") {
          AUDIO.onHitFx(e, { attacker: "hero", heroId: heroId });
        }
      }
    }
  };

  FX.play = function (state) {
    if (!state || !state.fx || !state.fx.length) return;
    const evts = state.fx.splice(0, state.fx.length);
    evts.forEach(function (e, i) {
      setTimeout(function () {
        FX.applyOne(e);
      }, i * 50);
    });
  };

  FX.facingFromDelta = function (dx, dy) {
    dx = dx || 0;
    dy = dy || 0;
    if (!dx && !dy) return "s";
    if (dx > 0 && dy > 0) return "se";
    if (dx < 0 && dy > 0) return "sw";
    if (dx > 0 && dy < 0) return "ne";
    if (dx < 0 && dy < 0) return "nw";
    if (dx > 0) return "e";
    if (dx < 0) return "w";
    if (dy > 0) return "s";
    return "n";
  };

  FX.facingArt = function (facing) {
    const f = facing || "s";
    if (f === "w") return { base: "e", flip: true };
    if (f === "sw") return { base: "se", flip: true };
    if (f === "nw") return { base: "n", flip: true };
    if (f === "ne") return { base: "n", flip: false };
    return { base: f, flip: false };
  };

  FX.spriteSrc = function (id, unit) {
    if (unit && unit.isMonster) {
      if (unit.sprite) return unit.sprite;
      const mid = unit.heroId || unit.monsterId || id || "poring";
      return "assets/mobs/" + mid + ".png";
    }
    const hid = id || (unit && unit.heroId) || "warrior";
    const facing = (unit && (unit.facing || unit.dir)) || (typeof MAP !== "undefined" && MAP.facing) || "s";
    const art = FX.facingArt(facing);
    let dirPath = "assets/chars/" + hid + "_" + art.base + ".png";
    const wf = unit && (unit.walkFrame || unit.step);
    if (wf && (art.base === "s" || art.base === "se")) {
      dirPath = "assets/chars/" + hid + "_s_w" + wf + ".png";
    }
    return dirPath;
  };

  FX.markWalk = function (el) {
    if (!el) return;
    const next = el.getAttribute("data-step") === "a" ? "b" : "a";
    el.setAttribute("data-step", next);
    el.classList.remove("walking", "step-a", "step-b");
    void el.offsetWidth;
    el.classList.add("walking", "step-" + next);
    let dust = el.querySelector(".walk-dust");
    if (!dust) {
      dust = document.createElement("i");
      dust.className = "walk-dust";
      el.appendChild(dust);
    }
    dust.classList.remove("puff");
    void dust.offsetWidth;
    dust.classList.add("puff");
    clearTimeout(el._walkT);
    el._walkT = setTimeout(function () {
      el.classList.remove("walking");
      if (dust) dust.classList.remove("puff");
    }, 220);
  };

  FX.applyFacing = function (el, facing) {
    if (!el) return;
    const art = FX.facingArt(facing);
    const sx = art.flip ? "-1" : "1";
    el.style.setProperty("--face-sx", sx);
    el.classList.toggle("face-flip", !!art.flip);
    const img = el.querySelector && el.querySelector(".map-sprite, img");
    if (img) img.style.setProperty("--face-sx", sx);
  };

  FX.mapFloater = function (host, x, y, cols, rows, text, kind) {
    if (!host) return;
    const grid = host.querySelector(".map-grid") || host;
    const vw = (root.MAP && MAP.VIEW_W) || cols || 33;
    const vh = (root.MAP && MAP.VIEW_H) || rows || 23;
    let sx = x;
    let sy = y;
    if (root.MAP && MAP.worldToScreen) {
      const sp = MAP.worldToScreen(x, y);
      sx = sp.x;
      sy = sp.y;
    }
    if (sx < -1 || sy < -1 || sx > vw || sy > vh) return;
    const n = document.createElement("div");
    n.className = "floater map-floater " + (kind || "dmg");
    n.textContent = text;
    const jitter = (Math.random() * 10 - 5).toFixed(1);
    n.style.left = "calc(" + ((sx + 0.5) * 100 / vw).toFixed(2) + "% + " + jitter + "px)";
    n.style.top = ((sy + 0.25) * 100 / vh).toFixed(2) + "%";
    if (kind === "crit") {
      const burst = document.createElement("span");
      burst.className = "crit-burst";
      n.appendChild(burst);
    }
    grid.appendChild(n);
    setTimeout(function () {
      if (n.parentNode) n.parentNode.removeChild(n);
    }, 1400);
  };

  FX.SKILL_TINT = {
    heal: "#3dde6a",
    sanctuary: "#7dcea0",
    magifireblade: "#ff6a2a",
    guard: "#f0d36a",
    stab: "#c084fc",
    shadowkill: "#7b3fa0",
    veil: "#8e44ad",
    counter: "#e74c3c",
    arrowshot: "#8fd19e",
    powershot: "#3d8b4a",
    focus: "#f0d36a",
    soularrow: "#7ec8e3",
  };

  FX.mapActor = function (host, atk, defn, skillId, def) {
    if (!host || !atk) return;
    const grid = host.querySelector(".map-grid") || host;
    let el = null;
    if (atk.kind === "player" || atk.id === "p1" || atk.id === "player") {
      el = grid.querySelector(".map-avatar") || grid.querySelector(".map-avatar.p1");
    } else {
      el = grid.querySelector('[data-eid="' + atk.id + '"]');
    }
    const hid = atk.unit && atk.unit.heroId;
    if (defn && defn !== atk && !(def && def.type === "self")) {
      if (hid === "hunter" || skillId === "arrowshot" || skillId === "powershot" || skillId === "soularrow" || skillId === "rain") {
        FX.mapBolt(host, atk, defn, "arrow");
      } else if (hid === "warrior" || skillId === "attack" || skillId === "magifireblade" || skillId === "blade_storm") {
        FX.mapBolt(host, atk, defn, "slash");
      }
    }
    if (!el) return;
    let dx = 0;
    let dy = 0;
    if (defn && defn !== atk) {
      dx = defn.x - atk.x;
      dy = defn.y - atk.y;
    }
    const px = (dx === 0 && dy === 0) ? 0 : Math.round((dx / (Math.abs(dx) + Math.abs(dy) || 1)) * 18);
    const py = (dx === 0 && dy === 0) ? 0 : Math.round((dy / (Math.abs(dx) + Math.abs(dy) || 1)) * 18);
    el.style.setProperty("--lunge-x", px + "px");
    el.style.setProperty("--lunge-y", py + "px");
    el.classList.remove("map-atk", "map-cast", "map-hit");
    void el.offsetWidth;
    const self = def && def.type === "self";
    el.classList.add(self ? "map-cast" : "map-atk");
    const color = FX.SKILL_TINT[skillId] || (self ? "#f0d36a" : "#fff1a8");
    el.style.setProperty("--skill-color", color);
    let slash = el.querySelector(".ent-slash");
    if (!slash) {
      slash = document.createElement("div");
      slash.className = "ent-slash";
      el.appendChild(slash);
    }
    slash.classList.remove("flash");
    void slash.offsetWidth;
    slash.classList.add("flash");
    clearTimeout(el._mapFx);
    el._mapFx = setTimeout(function () {
      el.classList.remove("map-atk");
      el.classList.remove("map-cast");
      if (slash) slash.classList.remove("flash");
    }, 160);
    if (defn && defn !== atk) {
      let vic = null;
      if (defn.kind === "player" || defn.id === "p1" || defn.id === "player") {
        vic = grid.querySelector(".map-avatar") || grid.querySelector(".map-avatar.p1");
      } else {
        vic = grid.querySelector('[data-eid="' + defn.id + '"]');
      }
      if (vic) {
        vic.classList.remove("map-hit");
        void vic.offsetWidth;
        vic.classList.add("map-hit");
        clearTimeout(vic._mapHit);
        vic._mapHit = setTimeout(function () {
          vic.classList.remove("map-hit");
        }, 160);
      }
    }
  };

  function tileCenter(grid, x, y) {
    const tile = grid.querySelector('[data-mx="' + x + '"][data-my="' + y + '"]');
    if (tile) {
      const gr = grid.getBoundingClientRect();
      const r = tile.getBoundingClientRect();
      return { x: r.left - gr.left + r.width / 2, y: r.top - gr.top + r.height * 0.38 };
    }
    const cam = (root.MAP && MAP.camera) ? MAP.camera() : { x: 0, y: 0 };
    const vw = (root.MAP && MAP.VIEW_W) || 33;
    const cs = (typeof getComputedStyle === "function") ? getComputedStyle(grid) : null;
    const cssTile = cs && parseFloat(cs.getPropertyValue("--tile"));
    const size = (cssTile && cssTile > 1) ? cssTile : (grid.clientWidth || 1) / vw;
    return { x: (x - cam.x + 0.5) * size, y: (y - cam.y + 0.38) * size };
  }

  FX.mapBolt = function (host, atk, defn, kind) {
    if (!host || !atk || !defn) return;
    const grid = host.querySelector(".map-grid") || host;
    const a = tileCenter(grid, atk.x, atk.y);
    const b = tileCenter(grid, defn.x, defn.y);
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const tileGuess = (grid.clientWidth || 1) / ((root.MAP && MAP.VIEW_W) || 33);
    if (kind === "slash") {
      const len = Math.hypot(dx, dy) || 1;
      const cap = tileGuess * 0.92;
      if (len > cap) {
        dx = (dx / len) * cap;
        dy = (dy / len) * cap;
      }
    }
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const steps = Math.max(1, Math.abs(defn.x - atk.x) + Math.abs(defn.y - atk.y));
    const dur = kind === "slash" ? 110 : Math.min(520, 140 + steps * 80);
    const el = document.createElement("div");
    el.className = "map-bolt map-bolt-" + (kind || "arrow");
    el.style.left = a.x + "px";
    el.style.top = a.y + "px";
    el.style.setProperty("--bolt-x", dx + "px");
    el.style.setProperty("--bolt-y", dy + "px");
    el.style.setProperty("--bolt-rot", ang + "deg");
    el.style.setProperty("--bolt-ms", dur + "ms");
    grid.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, dur + 40);
  };

  FX.portraitSrc = function (heroId) {
    return "assets/chars/" + heroId + ".png";
  };

  FX.skillIcon = function (skillId, def) {
    if (def && def.icon) return def.icon;
    const heroSkills = {
      attack: 1,
      magifireblade: 1,
      guard: 1,
      heal: 1,
      stab: 1,
      shadowkill: 1,
      veil: 1,
      counter: 1,
      arrowshot: 1,
      powershot: 1,
      focus: 1,
      soularrow: 1,
      blade_storm: 1,
      sanctuary: 1,
      nightfall: 1,
      phantom: 1,
      rain: 1,
      mark: 1,
    };
    if (heroSkills[skillId]) return "assets/skills/" + skillId + ".png";
    if (def && def.kind === "ultimate") return "assets/skills/boss_ult.png";
    if (def && def.kind === "basic") return "assets/skills/boss_basic.png";
    if (def && def.type === "self") return "assets/skills/boss_buff.png";
    return "assets/skills/boss_special.png";
  };

  root.FX = FX;
})(typeof globalThis !== "undefined" ? globalThis : window);
