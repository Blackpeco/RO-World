/**
 * Tiny Web Audio mixer — one context, BGM/SFX buses, clip pool.
 * Unlock on first pointerdown. Do not recode assets; play the shipped oggs.
 */
(function (root) {
  const MIX_KEY = "ro.atb.mix";
  const CROSSFADE_MS = 800;
  const DEFAULTS = {
    master: 0.80,
    bgm: 0.55,
    ambience: 0.35,
    combat: 0.90,
    world: 0.70,
    ui: 0.75,
  };
  const MELEE = { warrior: true, assassin: true };
  const MOB_IDS = {
    poring: 1, fabre: 1, lunatic: 1, willow: 1, condor: 1, wolf: 1,
    poporing: 1, chonchon: 1, roda_frog: 1, spore: 1, rocker: 1,
    steel_chonchon: 1, savage_babe: 1, elder_willow: 1, skeleton: 1,
  };

  const AUDIO = {
    ctx: null,
    unlocked: false,
    buses: {},
    clips: {},
    currentBgm: null,
    bgmSource: null,
    bgmGain: null,
    pendingBgm: null,
    ducked: false,
    mix: null,
  };

  function loadMix() {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(MIX_KEY);
        if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
      }
    } catch (e) {}
    return Object.assign({}, DEFAULTS);
  }

  AUDIO.mix = loadMix();

  AUDIO.isMeleeHero = function (id) {
    return !!MELEE[id];
  };

  AUDIO.sfxUrl = function (id) {
    if (!id) return "";
    if (id.indexOf("assets/") === 0) return id;
    return "assets/sfx/" + id + ".ogg";
  };

  AUDIO.bgmUrl = function (id) {
    if (!id) return "";
    if (id.indexOf("assets/") === 0) return id;
    return "assets/bgm/" + id + ".ogg";
  };

  AUDIO.mobAttackId = function (monsterId) {
    if (!monsterId || !MOB_IDS[monsterId]) return "";
    return "mob_" + monsterId + "_attack";
  };

  function ensureCtx() {
    if (AUDIO.ctx) return AUDIO.ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    AUDIO.ctx = new AC();
    const master = AUDIO.ctx.createGain();
    master.gain.value = AUDIO.mix.master;
    master.connect(AUDIO.ctx.destination);
    AUDIO.buses.master = master;
    ["bgm", "ambience", "combat", "world", "ui"].forEach(function (name) {
      const g = AUDIO.ctx.createGain();
      g.gain.value = AUDIO.mix[name];
      g.connect(master);
      AUDIO.buses[name] = g;
    });
    return AUDIO.ctx;
  }

  AUDIO.unlock = function () {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try { ctx.resume(); } catch (e) {}
    }
    AUDIO.unlocked = true;
    if (AUDIO.pendingBgm) {
      const id = AUDIO.pendingBgm;
      AUDIO.pendingBgm = null;
      AUDIO.bgm(id);
    }
  };

  function fetchDecode(url) {
    if (AUDIO.clips[url]) return AUDIO.clips[url];
    if (typeof fetch !== "function") {
      return Promise.resolve(null);
    }
    AUDIO.clips[url] = fetch(url).then(function (r) {
      if (!r.ok) throw new Error("audio " + url);
      return r.arrayBuffer();
    }).then(function (buf) {
      return AUDIO.ctx.decodeAudioData(buf);
    }).catch(function () {
      delete AUDIO.clips[url];
      return null;
    });
    return AUDIO.clips[url];
  }

  AUDIO.play = function (id, opts) {
    opts = opts || {};
    if (!id) return;
    const ctx = ensureCtx();
    if (!ctx || !AUDIO.unlocked) return;
    const url = AUDIO.sfxUrl(id);
    const busName = opts.bus || "combat";
    const bus = AUDIO.buses[busName] || AUDIO.buses.combat;
    fetchDecode(url).then(function (buffer) {
      if (!buffer || !AUDIO.ctx) return;
      const src = AUDIO.ctx.createBufferSource();
      src.buffer = buffer;
      const g = AUDIO.ctx.createGain();
      g.gain.value = opts.vol != null ? opts.vol : 1;
      if (opts.pan != null && AUDIO.ctx.createStereoPanner) {
        const p = AUDIO.ctx.createStereoPanner();
        p.pan.value = opts.pan;
        src.connect(g);
        g.connect(p);
        p.connect(bus);
      } else {
        src.connect(g);
        g.connect(bus);
      }
      src.start();
    });
  };

  function fadeOut(gain, ms, then) {
    const ctx = AUDIO.ctx;
    if (!gain || !ctx) {
      if (then) then();
      return;
    }
    const now = ctx.currentTime;
    const t = Math.max(0.05, ms / 1000);
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + t);
    } catch (e) {}
    setTimeout(then || function () {}, ms + 20);
  }

  function fadeIn(gain, target, ms) {
    const ctx = AUDIO.ctx;
    if (!gain || !ctx) return;
    const now = ctx.currentTime;
    const t = Math.max(0.05, ms / 1000);
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(target, now + t);
    } catch (e) {}
  }

  AUDIO.stopBgm = function () {
    AUDIO.pendingBgm = null;
    AUDIO.currentBgm = null;
    AUDIO.ducked = false;
    const src = AUDIO.bgmSource;
    const g = AUDIO.bgmGain;
    AUDIO.bgmSource = null;
    AUDIO.bgmGain = null;
    if (g) {
      fadeOut(g, CROSSFADE_MS, function () {
        try { if (src) src.stop(); } catch (e) {}
      });
    } else if (src) {
      try { src.stop(); } catch (e) {}
    }
  };

  AUDIO.bgm = function (id) {
    if (!id) {
      AUDIO.stopBgm();
      return;
    }
    if (!AUDIO.unlocked) {
      AUDIO.pendingBgm = id;
      return;
    }
    const ctx = ensureCtx();
    if (!ctx) return;
    if (AUDIO.currentBgm === id && AUDIO.bgmSource && !AUDIO.ducked) return;
    AUDIO.ducked = false;
    AUDIO.pendingBgm = null;
    const url = AUDIO.bgmUrl(id);
    const oldGain = AUDIO.bgmGain;
    const oldSrc = AUDIO.bgmSource;
    fetchDecode(url).then(function (buffer) {
      if (!buffer || !AUDIO.ctx) return;
      if (oldSrc) {
        fadeOut(oldGain, CROSSFADE_MS, function () {
          try { oldSrc.stop(); } catch (e) {}
        });
      }
      const src = AUDIO.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const g = AUDIO.ctx.createGain();
      src.connect(g);
      g.connect(AUDIO.buses.bgm);
      fadeIn(g, 1, CROSSFADE_MS);
      src.start();
      AUDIO.bgmSource = src;
      AUDIO.bgmGain = g;
      AUDIO.currentBgm = id;
    });
  };

  AUDIO.duckBgm = function () {
    AUDIO.pendingBgm = null;
    AUDIO.ducked = true;
    if (!AUDIO.bgmGain || !AUDIO.ctx) {
      AUDIO.stopBgm();
      return;
    }
    fadeOut(AUDIO.bgmGain, CROSSFADE_MS, function () {});
  };

  AUDIO.ambience = function () {};

  AUDIO.mute = function (bus, on) {
    if (!AUDIO.buses[bus]) return;
    AUDIO.buses[bus].gain.value = on ? 0 : (AUDIO.mix[bus] != null ? AUDIO.mix[bus] : 1);
  };

  AUDIO.setVol = function (bus, v) {
    AUDIO.mix[bus] = Math.max(0, Math.min(1, v));
    if (AUDIO.buses[bus]) AUDIO.buses[bus].gain.value = AUDIO.mix[bus];
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(MIX_KEY, JSON.stringify(AUDIO.mix));
      }
    } catch (e) {}
  };

  AUDIO.stopAll = function () {
    AUDIO.stopBgm();
  };

  AUDIO.onHitFx = function (e, info) {
    if (!e || e.kind !== "dmg") return false;
    if (!(e.amount > 0)) return false;
    if (e.poison || e.source === "poison") return false;
    info = info || {};
    if (info.attacker === "hero") {
      if (info.heroId === "hunter") {
        const id = e.crit ? "hit_arrow_crit" : "hit_arrow";
        AUDIO.play(id, { bus: "combat" });
        return id;
      }
      if (!AUDIO.isMeleeHero(info.heroId)) return false;
      AUDIO.play("hit_slash", { bus: "combat" });
      return "hit_slash";
    }
    if (info.attacker === "mob") {
      const id = AUDIO.mobAttackId(info.monsterId);
      if (!id) return false;
      AUDIO.play(id, { bus: "combat" });
      return id;
    }
    return false;
  };

  function bindUnlock() {
    function once() {
      AUDIO.unlock();
      document.removeEventListener("pointerdown", once, true);
      document.removeEventListener("keydown", once, true);
    }
    if (typeof document === "undefined") return;
    document.addEventListener("pointerdown", once, true);
    document.addEventListener("keydown", once, true);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindUnlock);
    } else {
      bindUnlock();
    }
  }

  root.AUDIO = AUDIO;
})(typeof globalThis !== "undefined" ? globalThis : window);
