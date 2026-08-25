/**
 * Live PvP room client — talks to server.py JSON API.
 */
(function (root) {
  const ROOM = {
    token: null,
    code: null,
    seat: null,
    lastV: 0,
    snapshot: null,
    info: null,
    abort: null,
    loopOn: false,
    onUpdate: null,
  };

  ROOM.available = function () {
    return typeof location !== "undefined" && location.protocol !== "file:";
  };

  ROOM.url = function (path) {
    return path;
  };

  ROOM.getJson = function (path) {
    return fetch(ROOM.url(path), { cache: "no-store" }).then(function (r) {
      return r.json();
    });
  };

  ROOM.postJson = function (path, body) {
    return fetch(ROOM.url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json();
    });
  };

  ROOM.loadInfo = function () {
    return ROOM.getJson("/api/info").then(function (info) {
      ROOM.info = info;
      return info;
    });
  };

  ROOM.create = function (name) {
    return ROOM.postJson("/api/room/create", { name: name || "" }).then(function (r) {
      if (!r.ok) throw new Error(r.error || "สร้างห้องไม่สำเร็จ");
      ROOM.token = r.token;
      ROOM.code = r.code;
      ROOM.seat = r.seat;
      ROOM.lastV = r.v || 0;
      ROOM.snapshot = r;
      try {
        sessionStorage.setItem("atb_room", JSON.stringify({ token: r.token, code: r.code, seat: r.seat }));
      } catch (e) {}
      return r;
    });
  };

  ROOM.join = function (code, name) {
    return ROOM.postJson("/api/room/join", { code: String(code || "").trim().toUpperCase(), name: name || "" }).then(
      function (r) {
        if (!r.ok) throw new Error(r.error || "เข้าห้องไม่สำเร็จ");
        ROOM.token = r.token;
        ROOM.code = r.code;
        ROOM.seat = r.seat;
        ROOM.lastV = r.v || 0;
        ROOM.snapshot = r;
        try {
          sessionStorage.setItem("atb_room", JSON.stringify({ token: r.token, code: r.code, seat: r.seat }));
        } catch (e) {}
        return r;
      }
    );
  };

  ROOM.action = function (payload) {
    payload = Object.assign({ code: ROOM.code, token: ROOM.token }, payload || {});
    return ROOM.postJson("/api/room/action", payload).then(function (r) {
      if (r && r.ok) {
        ROOM.lastV = r.v || ROOM.lastV;
        ROOM.snapshot = r;
      }
      return r;
    });
  };

  ROOM.pollOnce = function (wait) {
    if (!ROOM.code || !ROOM.token) return Promise.resolve(null);
    const q =
      "/api/room/state?code=" +
      encodeURIComponent(ROOM.code) +
      "&token=" +
      encodeURIComponent(ROOM.token) +
      "&v=" +
      encodeURIComponent(ROOM.lastV) +
      "&wait=" +
      (wait ? "1" : "0");
    if (ROOM.abort) {
      try {
        ROOM.abort.abort();
      } catch (e) {}
    }
    ROOM.abort = typeof AbortController !== "undefined" ? new AbortController() : null;
    return fetch(ROOM.url(q), {
      cache: "no-store",
      signal: ROOM.abort ? ROOM.abort.signal : undefined,
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (r) {
        if (r && r.ok) {
          ROOM.lastV = r.v || ROOM.lastV;
          ROOM.snapshot = r;
        }
        return r;
      });
  };

  ROOM.startLoop = function (onUpdate) {
    ROOM.onUpdate = onUpdate;
    ROOM.loopOn = true;
    function tick() {
      if (!ROOM.loopOn) return;
      ROOM.pollOnce(true)
        .then(function (r) {
          if (!ROOM.loopOn) return;
          if (r && ROOM.onUpdate) ROOM.onUpdate(r);
        })
        .catch(function () {})
        .then(function () {
          if (ROOM.loopOn) setTimeout(tick, 80);
        });
    }
    tick();
  };

  ROOM.stopLoop = function () {
    ROOM.loopOn = false;
    if (ROOM.abort) {
      try {
        ROOM.abort.abort();
      } catch (e) {}
      ROOM.abort = null;
    }
  };

  ROOM.leave = function () {
    const p = ROOM.code && ROOM.token ? ROOM.action({ type: "leave" }).catch(function () {}) : Promise.resolve();
    ROOM.stopLoop();
    ROOM.token = null;
    ROOM.code = null;
    ROOM.seat = null;
    ROOM.lastV = 0;
    ROOM.snapshot = null;
    try {
      sessionStorage.removeItem("atb_room");
    } catch (e) {}
    return p;
  };

  ROOM.pushSnapshot = function (state, important) {
    if (!state || ROOM.seat !== "host") return Promise.resolve(null);
    const combat = root.COMBAT.serializeState(state);
    combat.fx = (state.fxQueue || []).slice();
    if (important) state.fxQueue = [];
    return ROOM.action({
      type: "snapshot",
      combat: combat,
      phase: state.over ? "over" : "fight",
    });
  };

  ROOM.mySide = function () {
    return ROOM.seat === "guest" ? "right" : "left";
  };

  root.ROOM = ROOM;
})(typeof globalThis !== "undefined" ? globalThis : window);
