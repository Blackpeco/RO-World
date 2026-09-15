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

  FX.mobFacingArt = function (facing) {
    const f = facing || "s";
    if (f === "w") return { base: "e", flip: true };
    if (f === "sw") return { base: "se", flip: true };
    if (f === "nw") return { base: "ne", flip: true };
    if (f === "n" || f === "ne" || f === "e" || f === "se" || f === "s") {
      return { base: f, flip: false };
    }
    return { base: "s", flip: false };
  };

  FX.mob404s = [];
  FX.SPRITE_VER = "ui3-swordsman-1";
  FX.POSE_MS = { hit: 360, skill: 420, atk: 280 };
  FX.COMBAT_STANCE_MS = 2800;
  FX.WALK_FRAME_MS = 240;
  FX.HAIR_TINT = {
    black: { r: 28, g: 24, b: 22 },
    brown: { r: 92, g: 52, b: 22 },
    red: { r: 176, g: 42, b: 28 },
    blue: { r: 48, g: 96, b: 186 },
    silver: { r: 210, g: 214, b: 222 },
  };
  FX._hairCache = {};
  FX._hairPending = {};

  FX.hairColorOf = function (unit) {
    const raw =
      (unit && unit.hairColor) ||
      (unit && unit.save && unit.save.hairColor) ||
      (root.App && App.save && App.save.hairColor) ||
      "blonde";
    if (root.DATA && DATA.HAIR_COLORS && DATA.HAIR_COLORS[raw]) return raw;
    if (FX.HAIR_TINT[raw] || raw === "blonde") return raw;
    return "blonde";
  };

  FX.spriteUrl = function (path) {
    if (!path || path.indexOf("data:") === 0 || path.indexOf("?") >= 0) return path;
    return path + "?v=" + FX.SPRITE_VER;
  };

  FX.effectivePose = function (unit) {
    if (!unit || unit.sitting) return null;
    const hid = unit.heroId || "";
    if (hid && hid !== "warrior") return null;
    const now = Date.now();
    const pose = unit.pose;
    const until = unit.poseUntil || 0;
    if (pose && pose !== "ready" && now < until) return pose;
    if ((unit.combatUntil && now < unit.combatUntil) || pose === "ready") return "ready";
    return null;
  };

  FX.mobStillSrc = function (id, unit) {
    if (unit && unit.sprite) return unit.sprite;
    return "assets/mobs/" + id + ".png";
  };

  FX.mobDirSrc = function (id, base) {
    return "assets/mobs/" + id + "_" + base + ".png";
  };

  FX.noteMob404 = function (path) {
    if (!path) return;
    if (FX.mob404s.indexOf(path) === -1) FX.mob404s.push(path);
  };

  FX.spriteSrc = function (id, unit) {
    if (unit && unit.isMonster) {
      const mid = unit.monsterId || unit.heroId || id || "poring";
      const facing = unit.facing || unit.dir || "s";
      const art = FX.mobFacingArt(facing);
      const dirPath = FX.mobDirSrc(mid, art.base);
      if (FX.mob404s.indexOf(dirPath) !== -1) {
        return FX.mobStillSrc(mid, unit);
      }
      return dirPath;
    }
    const hid = id || (unit && unit.heroId) || "warrior";
    const facing = (unit && (unit.facing || unit.dir)) || (typeof MAP !== "undefined" && MAP.facing) || "s";
    const art = FX.facingArt(facing);
    if (unit && unit.sitting) {
      return "assets/chars/" + hid + "_sit_" + art.base + ".png";
    }
    const now = Date.now();
    const wf = unit && (unit.walkFrame || unit.step);
    const stepping =
      !!(unit && unit.walking) ||
      !!(wf && !(unit && unit.lastStepAt)) ||
      !!(unit && unit.lastStepAt && now - unit.lastStepAt < FX.WALK_FRAME_MS);
    if (wf && stepping) {
      if (hid === "warrior") {
        return "assets/chars/" + hid + "_" + art.base + "_w" + wf + ".png";
      }
      if (art.base === "s" || art.base === "se") {
        return "assets/chars/" + hid + "_s_w" + wf + ".png";
      }
    }
    const pose = FX.effectivePose(unit);
    if (pose === "hit" || pose === "skill") {
      return "assets/chars/" + hid + "_" + pose + "_s.png";
    }
    if (pose === "atk") {
      return "assets/chars/" + hid + "_atk_s.png";
    }
    if (pose === "ready") {
      return "assets/chars/" + hid + "_ready_" + art.base + ".png";
    }
    return "assets/chars/" + hid + "_" + art.base + ".png";
  };

  function rgbHue(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d < 1e-6) return 0;
    let h = 0;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return h;
  }

  function isBlondeHair(r, g, b, a) {
    if (a < 180) return false;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 150) return false;
    const sat = (max - min) / (max || 1);
    if (sat < 0.18) return false;
    if (b > r * 0.72) return false;
    const h = rgbHue(r, g, b);
    return h >= 28 && h <= 65 && r >= 150 && g >= 110;
  }

  FX.recolorHair = function (img, color) {
    if (!color || color === "blonde" || !FX.HAIR_TINT[color]) return null;
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    if (!c.width || !c.height) return null;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const pix = ctx.getImageData(0, 0, c.width, c.height);
    const d = pix.data;
    const t = FX.HAIR_TINT[color];
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      if (!isBlondeHair(r, g, b, a)) continue;
      const lum = (0.35 * r + 0.5 * g + 0.15 * b) / 255;
      const k = 0.38 + lum * 0.85;
      d[i] = Math.max(0, Math.min(255, t.r * k + (lum - 0.5) * 36));
      d[i + 1] = Math.max(0, Math.min(255, t.g * k + (lum - 0.5) * 36));
      d[i + 2] = Math.max(0, Math.min(255, t.b * k + (lum - 0.5) * 36));
    }
    ctx.putImageData(pix, 0, 0);
    return c.toDataURL("image/png");
  };

  FX.applyHeroImg = function (img, path, unit) {
    if (!img || !path) return;
    const color = FX.hairColorOf(unit);
    const hid = (unit && unit.heroId) || "";
    const url = FX.spriteUrl(path);
    if (hid !== "warrior" || color === "blonde" || typeof Image === "undefined") {
      if (img.getAttribute("src") !== url) img.src = url;
      return;
    }
    const cacheKey = path + "|" + color;
    if (FX._hairCache[cacheKey]) {
      if (img.getAttribute("src") !== FX._hairCache[cacheKey]) img.src = FX._hairCache[cacheKey];
      return;
    }
    if (img.getAttribute("src") !== url) img.src = url;
    if (FX._hairPending[cacheKey]) {
      FX._hairPending[cacheKey].push(img);
      return;
    }
    FX._hairPending[cacheKey] = [img];
    const loader = new Image();
    loader.onload = function () {
      let data = null;
      try {
        data = FX.recolorHair(loader, color);
      } catch (err) {
        data = null;
      }
      FX._hairCache[cacheKey] = data || url;
      (FX._hairPending[cacheKey] || []).forEach(function (el) {
        if (el && FX._hairCache[cacheKey]) el.src = FX._hairCache[cacheKey];
      });
      delete FX._hairPending[cacheKey];
    };
    loader.onerror = function () {
      delete FX._hairPending[cacheKey];
    };
    loader.src = url;
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

  FX.applyFacing = function (el, facing, opts) {
    if (!el) return;
    const isMob = !!(opts && opts.isMonster) ||
      !!(el.classList && el.classList.contains("mob")) ||
      !!(el.getAttribute && el.getAttribute("data-mob"));
    const art = isMob ? FX.mobFacingArt(facing) : FX.facingArt(facing);
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
    bash: "#d4a017",
    magnum_break: "#ff6a2a",
    provoke: "#f0d36a",
    endure: "#f0d36a",
    steal: "#e74c3c",
    envenom: "#c084fc",
    hiding: "#8e44ad",
    detoxify: "#3dde6a",
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
      } else if (hid === "warrior" || skillId === "attack" || skillId === "bash" || skillId === "magnum_break" || skillId === "magifireblade" || skillId === "blade_storm") {
        FX.mapBolt(host, atk, defn, "slash");
      } else if (hid === "assassin" || skillId === "envenom" || skillId === "steal" || skillId === "stab") {
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
    return FX.spriteUrl("assets/chars/" + heroId + ".png");
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
