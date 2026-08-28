/**
 * Multi-map walker: Prontera 80×80 walled city, 100×100 starter field, 100×100 7-boss world.
 * Camera is locked 45×33 landscape (VIEW_W/VIEW_H), fills the screen exactly.
 * MAP.VIEW=23 is arena-only leftover; walk camera always uses VIEW_W/VIEW_H.
 * Field/boss combat is real-time on the map (WORLD).
 */
(function (root) {
  const DATA = root.DATA;
  const MAP = {};

  MAP.VIEW_W = 45;
  MAP.VIEW_H = 33;
  MAP.VIEW = 23;
  MAP.WORLD = 100;
  MAP.PATH_NODE_CAP = 2400;
  MAP.PAD_STEP_MS = 140;
  MAP.COLS = 45;
  MAP.ROWS = 33;
  MAP.CITY = 80;
  MAP.sitting = false;

  function hashXY(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function flowerAt(x, y) {
    return hashXY(x, y) % 13 === 0;
  }
  function trailAt(x, y) {
    return hashXY(x + 17, y + 31) % 7 === 0;
  }
  function tileArt(src, cls) {
    return '<img class="map-tile-art' + (cls ? " " + cls : "") + '" src="' + src + '" alt="">';
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function parseGrid(layout, blockedExtra) {
    blockedExtra = blockedExtra || "";
    const rows = layout.length;
    const cols = (layout[0] || "").length;
    const walkable = [];
    const cells = {};
    for (let y = 0; y < rows; y++) {
      walkable[y] = [];
      const row = layout[y] || "";
      for (let x = 0; x < cols; x++) {
        const ch = row.charAt(x) || "#";
        const blocked = ch === "#" || blockedExtra.indexOf(ch) >= 0;
        walkable[y][x] = !blocked;
        if (ch !== "#" && ch !== ".") cells[x + "," + y] = ch;
      }
    }
    return { cols: cols, rows: rows, walkable: walkable, cells: cells };
  }

  function makeBlank(n) {
    const walkable = [];
    const cells = {};
    const decor = [];
    for (let y = 0; y < n; y++) {
      walkable[y] = [];
      for (let x = 0; x < n; x++) {
        const border = x === 0 || y === 0 || x === n - 1 || y === n - 1;
        walkable[y][x] = !border;
      }
    }
    return { cols: n, rows: n, walkable: walkable, cells: cells, decor: decor };
  }

  function clearDisk(g, cx, cy, r) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (y <= 0 || x <= 0 || y >= g.rows - 1 || x >= g.cols - 1) continue;
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) g.walkable[y][x] = true;
      }
    }
  }

  function carveLine(g, x0, y0, x1, y1) {
    let x = x0;
    let y = y0;
    const steps = Math.abs(x1 - x0) + Math.abs(y1 - y0) + 4;
    for (let i = 0; i < steps; i++) {
      if (x > 0 && y > 0 && x < g.cols - 1 && y < g.rows - 1) {
        g.walkable[y][x] = true;
        if (x + 1 < g.cols - 1) g.walkable[y][x + 1] = true;
        if (y + 1 < g.rows - 1) g.walkable[y + 1][x] = true;
      }
      if (x === x1 && y === y1) break;
      if (x !== x1) x += x < x1 ? 1 : -1;
      else y += y < y1 ? 1 : -1;
    }
  }

  function generateField(n, seed) {
    const rng = mulberry32(seed);
    const g = makeBlank(n);
    g.trails = {};
    g.plain = {};
    const spawn = { x: 5, y: n - 6 };
    const gate = { x: 2, y: n - 4 };
    const pockets = {
      near: { x: 18, y: 82, rx: 9, ry: 7, open: 0.88, name: "ทุ่งใกล้" },
      mid: { x: 32, y: 70, rx: 8, ry: 7, open: 0.62, name: "ป่ากลาง" },
      far: { x: 38, y: 58, rx: 7, ry: 6, open: 0.5, name: "ปากป่า" },
      deep: { x: 52, y: 48, rx: 10, ry: 9, open: 0.42, name: "ป่าลึก" },
    };
    g.pockets = pockets;

    function manh(ax, ay, bx, by) {
      return Math.abs(ax - bx) + Math.abs(ay - by);
    }
    function isPlainTile(x, y) {
      // first camera + pad so forest is off-screen / distant treeline
      if (x <= 50 && y >= 70) return true;
      return manh(x, y, spawn.x, spawn.y) < 32;
    }
    function markTrail(x, y) {
      if (x <= 0 || y <= 0 || x >= n - 1 || y >= n - 1) return;
      g.walkable[y][x] = true;
      g.trails[x + "," + y] = true;
    }
    function ribbonH(x0, x1, y, bulge) {
      const xa = Math.min(x0, x1);
      const xb = Math.max(x0, x1);
      const sign = hashXY(x0 + 3, y + 7) & 1 ? 1 : -1;
      const span = xb - xa || 1;
      for (let x = xa; x <= xb; x++) {
        const t = (x - xa) / span;
        const yOff = Math.round(Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI) * bulge * sign);
        const yy = Math.max(1, Math.min(n - 3, y + yOff));
        markTrail(x, yy);
        markTrail(x, yy + 1);
      }
    }
    function ribbonV(y0, y1, x, bulge) {
      const ya = Math.min(y0, y1);
      const yb = Math.max(y0, y1);
      const sign = hashXY(x + 11, y0 + 5) & 1 ? 1 : -1;
      const span = yb - ya || 1;
      for (let y = ya; y <= yb; y++) {
        const t = (y - ya) / span;
        const xOff = Math.round(Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI) * bulge * sign);
        const xx = Math.max(1, Math.min(n - 3, x + xOff));
        markTrail(xx, y);
        markTrail(xx + 1, y);
      }
    }
    function ribbonTo(x0, y0, x1, y1, bulge) {
      bulge = bulge == null ? 2 : bulge;
      const hv = hashXY(x0 * 3 + x1, y0 * 5 + y1) & 1;
      if (hv) {
        ribbonH(x0, x1, y0, bulge);
        ribbonV(y0, y1, x1, bulge);
      } else {
        ribbonV(y0, y1, x0, bulge);
        ribbonH(x0, x1, y1, bulge);
      }
    }
    function clearPocket(cx, cy, rx, ry, open) {
      const pad = 2;
      for (let y = cy - ry - pad; y <= cy + ry + pad; y++) {
        for (let x = cx - rx - pad; x <= cx + rx + pad; x++) {
          if (y <= 0 || x <= 0 || y >= n - 1 || x >= n - 1) continue;
          const nx = (x - cx) / rx;
          const ny = (y - cy) / ry;
          const rr = nx * nx + ny * ny;
          if (rr > 1) {
            if (rr < 1.22 && hashXY(x + 19, y + 23) % 7 === 0) g.walkable[y][x] = true;
            continue;
          }
          if (rr <= open * open) g.walkable[y][x] = true;
          else if (hashXY(x, y) % 5 > 1) g.walkable[y][x] = true;
        }
      }
    }
    function floodKeep() {
      const seen = {};
      const q = [{ x: spawn.x, y: spawn.y }];
      seen[spawn.x + "," + spawn.y] = true;
      while (q.length) {
        const c = q.pop();
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let i = 0; i < dirs.length; i++) {
          const nx = c.x + dirs[i][0];
          const ny = c.y + dirs[i][1];
          if (ny <= 0 || nx <= 0 || ny >= n - 1 || nx >= n - 1) continue;
          const k = nx + "," + ny;
          if (seen[k] || !g.walkable[ny][nx]) continue;
          seen[k] = true;
          q.push({ x: nx, y: ny });
        }
      }
      for (let y = 1; y < n - 1; y++) {
        for (let x = 1; x < n - 1; x++) {
          if (g.walkable[y][x] && !seen[x + "," + y]) {
            g.walkable[y][x] = false;
            delete g.trails[x + "," + y];
            g.decor.push({ x: x, y: y, kind: "tree" });
          }
        }
      }
    }

    for (let y = 1; y < n - 1; y++) {
      for (let x = 1; x < n - 1; x++) {
        g.walkable[y][x] = false;
        const h = hashXY(x + 41, y + 17) % 100;
        g.decor.push({ x: x, y: y, kind: h < 8 ? "fern" : h < 13 ? "rock" : "tree" });
      }
    }

    clearPocket(spawn.x, spawn.y, 7, 6, 1);
    clearPocket(gate.x, gate.y, 6, 5, 1);
    clearPocket(pockets.mid.x, pockets.mid.y, pockets.mid.rx, pockets.mid.ry, pockets.mid.open);
    clearPocket(pockets.far.x, pockets.far.y, pockets.far.rx, pockets.far.ry, pockets.far.open);
    clearPocket(pockets.deep.x, pockets.deep.y, pockets.deep.rx, pockets.deep.ry, pockets.deep.open);

    for (let y = gate.y - 1; y <= gate.y + 1; y++) {
      for (let x = gate.x - 1; x <= gate.x + 1; x++) {
        if (y <= 0 || x <= 0 || y >= n - 1 || x >= n - 1) continue;
        g.walkable[y][x] = true;
        g.cells[x + "," + y] = "X";
      }
    }

    // 2-tile spine. Perpendiculars start 1 tile off the joint so sine bulge
    // cannot plus-smear the 2-wide corridor.
    ribbonH(gate.x, spawn.x, spawn.y, 0.5);
    ribbonV(gate.y, spawn.y, gate.x, 0.4);
    ribbonV(spawn.y, 91, spawn.x, 0.6);
    ribbonH(spawn.x, 32, 90, 1.2);
    ribbonV(89, 82, 18, 1.2);
    const firstRibbon = {};
    Object.keys(g.trails).forEach(function (k) {
      firstRibbon[k] = true;
    });
    ribbonV(89, 58, 32, 1.25);
    ribbonH(33, 52, 58, 1.2);
    ribbonV(57, 48, 52, 1.2);
    ribbonH(32, 25, 72, 1);

    const xCells = [];
    Object.keys(g.cells).forEach(function (k) {
      if (g.cells[k] !== "X") return;
      const p = k.split(",");
      xCells.push({ x: Number(p[0]), y: Number(p[1]) });
    });
    const firstRibbonList = Object.keys(firstRibbon).map(function (k) {
      const p = k.split(",");
      return { x: Number(p[0]), y: Number(p[1]) };
    });
    function chebNearList(x, y, list, rad) {
      for (let i = 0; i < list.length; i++) {
        if (Math.max(Math.abs(list[i].x - x), Math.abs(list[i].y - y)) <= rad) return true;
      }
      return false;
    }

    // Flat hunting plain: first camera + pad, plus a small manh disk at spawn.
    for (let y = 1; y < n - 1; y++) {
      for (let x = 1; x < n - 1; x++) {
        if (!isPlainTile(x, y)) continue;
        g.plain[x + "," + y] = true;
        g.walkable[y][x] = true;
      }
    }

    const candidates = [];
    for (let y = 1; y < n - 1; y++) {
      for (let x = 1; x < n - 1; x++) {
        const d = manh(x, y, spawn.x, spawn.y);
        if (d < 12) continue;
        if (!isPlainTile(x, y)) continue;
        if (x <= 44 && y >= 78) continue;
        if (x <= 14 && y >= 88) continue;
        if (g.trails[x + "," + y]) continue;
        if (manh(x, y, gate.x, gate.y) < 10) continue;
        if (chebNearList(x, y, xCells, 4)) continue;
        if (chebNearList(x, y, firstRibbonList, 3)) continue;
        candidates.push({ x: x, y: y });
      }
    }
    candidates.sort(function (a, b) {
      return hashXY(a.x + 91, a.y + 53) - hashXY(b.x + 91, b.y + 53);
    });
    const landmarks = [];
    function takeLandmarks(sep, want) {
      for (let i = 0; i < candidates.length && landmarks.length < want; i++) {
        const c = candidates[i];
        let ok = true;
        for (let j = 0; j < landmarks.length; j++) {
          if (manh(c.x, c.y, landmarks[j].x, landmarks[j].y) < sep) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        landmarks.push(c);
      }
    }
    takeLandmarks(8, 6);
    if (landmarks.length < 4) takeLandmarks(5, 6);
    if (landmarks.length < 4) takeLandmarks(3, 6);

    const landmarkAt = {};
    landmarks.forEach(function (s) {
      landmarkAt[s.x + "," + s.y] = true;
      g.walkable[s.y][s.x] = false;
    });

    g.decor = g.decor.filter(function (d) {
      if (isPlainTile(d.x, d.y)) return false;
      return !g.walkable[d.y][d.x];
    });
    landmarks.forEach(function (s) {
      const kind = hashXY(s.x + 11, s.y + 7) % 3 === 0 ? "rock" : "tree";
      g.decor.push({ x: s.x, y: s.y, kind: kind });
    });

    floodKeep();

    // Never let floodKeep re-forest the plain. Landmarks stay; everything else stays open.
    for (let y = 1; y < n - 1; y++) {
      for (let x = 1; x < n - 1; x++) {
        if (!isPlainTile(x, y)) continue;
        g.plain[x + "," + y] = true;
        g.walkable[y][x] = !landmarkAt[x + "," + y];
      }
    }
    g.decor = g.decor.filter(function (d) {
      if (isPlainTile(d.x, d.y)) return !!landmarkAt[d.x + "," + d.y];
      return !g.walkable[d.y][d.x];
    });
    landmarks.forEach(function (s) {
      const has = g.decor.some(function (d) {
        return d.x === s.x && d.y === s.y;
      });
      if (!has) {
        const kind = hashXY(s.x + 11, s.y + 7) % 3 === 0 ? "rock" : "tree";
        g.decor.push({ x: s.x, y: s.y, kind: kind });
      }
    });

    const decorAt = {};
    g.decor.forEach(function (d) { decorAt[d.x + "," + d.y] = d; });
    g.decorAt = decorAt;

    const nearTypes = ["poring", "fabre", "lunatic", "willow", "condor"];
    const midTypes = ["wolf", "poporing", "chonchon", "roda_frog"];
    const farTypes = ["spore", "rocker", "steel_chonchon"];
    const deepTypes = ["savage_babe", "elder_willow", "skeleton"];
    function pickBand(dist, slot) {
      if (dist < 30) return nearTypes[slot % nearTypes.length];
      if (dist < 52) return midTypes[slot % midTypes.length];
      if (dist < 74) return farTypes[slot % farTypes.length];
      return deepTypes[slot % deepTypes.length];
    }
    function isTrail(x, y) {
      return !!(g.trails && g.trails[x + "," + y]);
    }

    const nearOpenTiles = [];
    const pocketTiles = [];
    const walkTiles = [];
    for (let y = 2; y < n - 2; y++) {
      for (let x = 2; x < n - 2; x++) {
        if (!g.walkable[y][x]) continue;
        const t = { x: x, y: y };
        walkTiles.push(t);
        if (!isTrail(x, y)) pocketTiles.push(t);
        const d = manh(x, y, spawn.x, spawn.y);
        if (d >= 8 && d < 30) nearOpenTiles.push(t);
      }
    }
    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    }
    shuffle(nearOpenTiles);
    shuffle(pocketTiles);
    shuffle(walkTiles);
    nearOpenTiles.sort(function (a, b) {
      const at = isTrail(a.x, a.y) ? 1 : 0;
      const bt = isTrail(b.x, b.y) ? 1 : 0;
      return at - bt;
    });

    const mobs = [];
    function occupied(x, y, sep) {
      if (manh(x, y, spawn.x, spawn.y) < 8) return true;
      if (manh(x, y, gate.x, gate.y) < 6) return true;
      for (let i = 0; i < mobs.length; i++) {
        if (manh(mobs[i].x, mobs[i].y, x, y) < sep) return true;
      }
      return false;
    }
    function tryPlaceFrom(list, sep, limit) {
      for (let i = 0; i < list.length && mobs.length < limit; i++) {
        const t = list[i];
        if (occupied(t.x, t.y, sep)) continue;
        const dist = manh(t.x, t.y, spawn.x, spawn.y);
        if (dist < 8) continue;
        const mid = pickBand(dist, mobs.length);
        mobs.push({ uid: "m" + t.x + "," + t.y, monsterId: mid, x: t.x, y: t.y });
      }
    }
    tryPlaceFrom(nearOpenTiles, 5, 48);
    tryPlaceFrom(pocketTiles, 6, 48);
    if (mobs.length < 48) tryPlaceFrom(nearOpenTiles, 4, 48);
    if (mobs.length < 48) tryPlaceFrom(pocketTiles, 4, 48);
    if (mobs.length < 48) tryPlaceFrom(pocketTiles, 3, 48);
    if (mobs.length < 48) tryPlaceFrom(walkTiles, 4, 48);
    if (mobs.length < 48) tryPlaceFrom(walkTiles, 2, 48);

    function findBandTile(lo, hi) {
      const pools = lo < 30 ? [nearOpenTiles, pocketTiles, walkTiles] : [pocketTiles, walkTiles];
      for (let p = 0; p < pools.length; p++) {
        for (let sep = 6; sep >= 2; sep--) {
          for (let i = 0; i < pools[p].length; i++) {
            const t = pools[p][i];
            const dist = manh(t.x, t.y, spawn.x, spawn.y);
            if (dist < lo || dist > hi) continue;
            if (occupied(t.x, t.y, sep)) continue;
            return t;
          }
        }
      }
      return null;
    }
    [
      { ids: nearTypes, lo: 8, hi: 29 },
      { ids: midTypes, lo: 30, hi: 51 },
      { ids: farTypes, lo: 52, hi: 73 },
      { ids: deepTypes, lo: 74, hi: 400 },
    ].forEach(function (band) {
      band.ids.forEach(function (id) {
        const have = mobs.some(function (m) {
          return m.monsterId === id;
        });
        if (have) return;
        const tile = findBandTile(band.lo, band.hi);
        if (!tile) return;
        mobs.push({ uid: "m" + tile.x + "," + tile.y, monsterId: id, x: tile.x, y: tile.y });
      });
    });
    while (mobs.length > 48) {
      const counts = {};
      mobs.forEach(function (m) {
        counts[m.monsterId] = (counts[m.monsterId] || 0) + 1;
      });
      let drop = -1;
      let dropN = 1;
      for (let i = 0; i < mobs.length; i++) {
        if (counts[mobs[i].monsterId] > dropN) {
          dropN = counts[mobs[i].monsterId];
          drop = i;
        }
      }
      if (drop < 0) break;
      mobs.splice(drop, 1);
    }
    g.spawn = spawn;
    g.gate = gate;
    g.mobs = mobs;
    return g;
  }

  function generateBosses(n, seed) {
    const rng = mulberry32(seed);
    const g = makeBlank(n);
    for (let y = 1; y < n - 1; y++) {
      for (let x = 1; x < n - 1; x++) {
        if (rng() < 0.08) {
          g.walkable[y][x] = false;
          g.decor.push({ x: x, y: y, kind: rng() < 0.5 ? "tree" : "ruin" });
        }
      }
    }
    const spawn = { x: 8, y: n - 8 };
    clearDisk(g, spawn.x, spawn.y, 6);
    if (g.walkable[3] && g.walkable[3][2] != null) g.walkable[3][2] = false;
    const spots = [
      { id: "monster", x: 14, y: 14 },
      { id: "golem", x: 50, y: 10 },
      { id: "wolf", x: 88, y: 16 },
      { id: "knight", x: 50, y: 50 },
      { id: "demon", x: 16, y: 68 },
      { id: "angel", x: 86, y: 74 },
      { id: "dragon", x: 90, y: 48 },
    ];
    const list = [];
    const cells = {};
    spots.forEach(function (s) {
      clearDisk(g, s.x, s.y, 3);
      g.walkable[s.y][s.x] = true;
      carveLine(g, spawn.x, spawn.y, s.x, s.y);
      list.push({ id: s.id, x: s.x, y: s.y });
      cells[s.x + "," + s.y] = s.id;
    });
    g.spawn = spawn;
    g.bossList = list;
    g.bossCells = cells;
    return g;
  }

  function generateCity(n) {
    n = n || 80;
    if (n < 64) n = 64;
    const kind = [];
    const walks = [];
    for (let y = 0; y < n; y++) {
      kind[y] = [];
      walks[y] = [];
      for (let x = 0; x < n; x++) {
        kind[y][x] = "?";
        walks[y][x] = false;
      }
    }

    const LOCK_BLOCK = "#DCHNRTrhF";
    const LOCK_NPC = "WPSKG";

    function put(x, y, ch, walk) {
      if (y < 0 || x < 0 || y >= n || x >= n) return;
      kind[y][x] = ch;
      walks[y][x] = !!walk;
    }

    function fill(x0, y0, x1, y1, ch, walk) {
      const xa = Math.min(x0, x1);
      const xb = Math.max(x0, x1);
      const ya = Math.min(y0, y1);
      const yb = Math.max(y0, y1);
      for (let y = ya; y <= yb; y++) {
        for (let x = xa; x <= xb; x++) put(x, y, ch, walk);
      }
    }

    function hStreet(x0, x1, y, w) {
      w = w || 1;
      for (let i = 0; i < w; i++) fill(x0, y + i, x1, y + i, ".", true);
    }

    function vStreet(x, y0, y1, w) {
      w = w || 1;
      for (let i = 0; i < w; i++) fill(x + i, y0, x + i, y1, ".", true);
    }

    function lockedTile(ch) {
      return !ch || LOCK_BLOCK.indexOf(ch) >= 0 || LOCK_NPC.indexOf(ch) >= 0;
    }

    const avenue = [];
    for (let y = 0; y < n; y++) avenue[y] = [];

    function paintCobble(x, y, mark) {
      if (y < wallT || x < wallT || y > n - 1 - wallT || x > n - 1 - wallT) return;
      const ch = kind[y][x];
      if (ch === "#") return;
      if (lockedTile(ch) && ch !== ".") return;
      if (ch === "~" || ch === "f" || ch === "L" || ch === "B" || ch === "A") {
        walks[y][x] = true;
        if (mark) avenue[y][x] = true;
        return;
      }
      put(x, y, ".", true);
      if (mark) avenue[y][x] = true;
    }

    function ribbonH(x0, x1, y, bulge) {
      const xa = Math.min(x0, x1);
      const xb = Math.max(x0, x1);
      const sign = hashXY(x0 + 3, y + 7) & 1 ? 1 : -1;
      const span = xb - xa || 1;
      for (let x = xa; x <= xb; x++) {
        const t = (x - xa) / span;
        const yOff = Math.round(Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI) * bulge * sign);
        paintCobble(x, y + yOff, true);
        paintCobble(x, y + yOff + 1, true);
      }
    }
    function ribbonV(y0, y1, x, bulge) {
      const ya = Math.min(y0, y1);
      const yb = Math.max(y0, y1);
      const sign = hashXY(x + 11, y0 + 5) & 1 ? 1 : -1;
      const span = yb - ya || 1;
      for (let y = ya; y <= yb; y++) {
        const t = (y - ya) / span;
        const xOff = Math.round(Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI) * bulge * sign);
        paintCobble(x + xOff, y, true);
        paintCobble(x + xOff + 1, y, true);
      }
    }

    function wobbleRing() {
      function edge(horizontal, a0, a1, fixed, inward, width) {
        const dir = a1 >= a0 ? 1 : -1;
        let i = 0;
        let off = 0;
        let next = 5 + (hashXY(a0 + 2, fixed + 9) % 4);
        for (let a = a0; a !== a1 + dir; a += dir) {
          if (i && i === next) {
            off = hashXY(a, fixed + i * 3) % 3 === 0 ? 1 : 0;
            next = i + 5 + (hashXY(a * 5, fixed + 19) % 4);
          }
          const f = fixed + inward * off;
          for (let w = 0; w < width; w++) {
            const t = f + inward * w;
            if (t < wallT || t > n - 1 - wallT) continue;
            if (horizontal) paintCobble(a, t);
            else paintCobble(t, a);
          }
          i += 1;
        }
      }
      const inner0 = wallT;
      const inner1 = n - 1 - wallT;
      const east = n - wallT - ringT;
      const south = n - wallT - ringT;
      edge(true, inner0, inner1, inner0, 1, ringT);
      edge(true, inner0, inner1, south, -1, ringT);
      edge(false, inner0, inner1, inner0, 1, ringT);
      edge(false, inner0, inner1, east, -1, ringT);
    }

    const cx = Math.floor(n / 2);
    const cy = Math.floor(n / 2);
    const wallT = 2;
    const ringT = 2;

    // 1. Fill blocked, 2-tile walls on all four edges.
    fill(0, 0, n - 1, n - 1, "?", false);
    fill(0, 0, n - 1, wallT - 1, "#", false);
    fill(0, n - wallT, n - 1, n - 1, "#", false);
    fill(0, 0, wallT - 1, n - 1, "#", false);
    fill(n - wallT, 0, n - 1, n - 1, "#", false);

    // 2. Ring road 2 tiles just inside the walls, wobble ±1 inward.
    wobbleRing();

    // 3. No extra plaza slab — the 5×5 fountain rim is the cobble pad.
    // 4. 2-wide S-ribbons attach at the rim, never through the fountain.
    ribbonH(cx + 3, n - 5, cy, 2);
    ribbonH(cx - 3, 24, cy, 2);
    ribbonV(cy - 3, 17, cx, 2);
    ribbonV(cy + 3, 56, cx, 2);

    // 5. Fountain: 3x3 blocked core, walkable 5x5 rim (do not block the rim).
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) put(cx + dx, cy + dy, "F", false);
        else put(cx + dx, cy + dy, "f", true);
      }
    }

    // 7. Castle NORTH (separate from church). Keep D, 3x3 K door, north avenue open.
    fill(34, 4, 46, 16, "D", false);
    fill(34, 4, 35, 5, "D", false);
    fill(45, 4, 46, 5, "D", false);
    fill(34, 15, 35, 16, "D", false);
    fill(45, 15, 46, 16, "D", false);
    fill(39, 14, 41, 16, "K", true);
    // Short straight K-door apron so the warp pad stays obviously connected.
    vStreet(39, 17, 19, 3);

    // 8. Church NE, own landmark. Body C, terracotta roof N, south courtyard.
    fill(52, 8, 62, 20, "C", false);
    for (let y = 8; y <= 12; y++) {
      const inset = 12 - y;
      fill(52 + inset, y, 62 - inset, y, "N", false);
    }
    fill(53, 21, 61, 24, "~", true);

    // 9. West market: W on the street, 2 shop buildings (not a packed quarter).
    const wShop = { x: 24, y: 40 };
    put(wShop.x, wShop.y, "W", true);
    fill(23, 37, 25, 38, "H", false);
    fill(23, 36, 25, 36, "R", false);
    fill(17, 37, 19, 38, "H", false);
    fill(17, 36, 19, 36, "R", false);

    // 10. East market: P on the street, 2 shop buildings + 1 visual inn house.
    const pShop = { x: 56, y: 40 };
    put(pShop.x, pShop.y, "P", true);
    fill(55, 37, 57, 38, "H", false);
    fill(55, 36, 57, 36, "R", false);
    fill(61, 37, 63, 38, "H", false);
    fill(61, 36, 63, 36, "R", false);
    fill(55, 46, 57, 46, "H", false);
    fill(55, 45, 57, 45, "R", false);

    // 11. Kafra sits on the south ribbon (keep walk on the road, no extra stub).
    const kafra = { x: 40, y: 49 };
    let kBest = 99;
    for (let x = 34; x <= 46; x++) {
      if (!walks[49] || !walks[49][x]) continue;
      const ch = kind[49][x];
      if (ch !== "." && ch !== "~" && ch !== "A" && ch !== "?") continue;
      const d = Math.abs(x - 40);
      if (d < kBest) {
        kBest = d;
        kafra.x = x;
      }
    }
    put(kafra.x, kafra.y, "S", true);

    // 12. East field gatehouse — only functional exit. 3x3 G walk pad.
    fill(n - 3, cy - 1, n - 1, cy + 1, "G", true);
    fill(n - 4, cy - 4, n - 1, cy - 3, "#", false);
    fill(n - 4, cy + 3, n - 1, cy + 4, "#", false);
    // Short straight G-pad apron (warp).
    hStreet(72, 75, cy - 1, 3);

    // 13. Parks: grass A + a few trees T. Irregular edges, not hard 8×8 boxes.
    function stampPark(x0, y0, x1, y1) {
      for (let y = y0 - 1; y <= y1 + 1; y++) {
        for (let x = x0 - 1; x <= x1 + 1; x++) {
          if (y < wallT || x < wallT || y > n - 1 - wallT || x > n - 1 - wallT) continue;
          const ch = kind[y][x];
          if (ch === "#" || (lockedTile(ch) && ch !== "." && ch !== "?" && ch !== "A")) continue;
          if (ch === "f" || ch === "L" || ch === "B") continue;
          const h = hashXY(x + 29, y + 41);
          const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1;
          const corner =
            (x <= x0 + 1 && y <= y0 + 1) ||
            (x >= x1 - 1 && y <= y0 + 1) ||
            (x <= x0 + 1 && y >= y1 - 1) ||
            (x >= x1 - 1 && y >= y1 - 1);
          if (inside) {
            if (corner && h % 3 === 0) continue;
            if ((x === x0 || x === x1 || y === y0 || y === y1) && h % 5 === 0) continue;
            if (ch === "~") continue;
            put(x, y, "A", true);
          } else if ((ch === "." || ch === "?") && h % 4 === 0) {
            put(x, y, "A", true);
          }
        }
      }
      const spots = [
        [x0 + 1 + (hashXY(x0, y0) % 3), y0 + 2 + (hashXY(x0 + 2, y0) % 2)],
        [x1 - 2 - (hashXY(x1, y0) % 2), y0 + 1 + (hashXY(x1, y0 + 3) % 3)],
        [x0 + 2 + (hashXY(x0, y1) % 2), y1 - 2 - (hashXY(x0 + 4, y1) % 2)],
        [x1 - 1 - (hashXY(x1, y1) % 3), y1 - 1 - (hashXY(x1 + 5, y1 + 1) % 2)],
        [Math.floor((x0 + x1) / 2) + ((hashXY(x0 + x1, y0) % 3) - 1), Math.floor((y0 + y1) / 2) + ((hashXY(y0 + y1, x1) % 3) - 1)],
      ];
      spots.forEach(function (s) {
        if (s[0] > x0 && s[0] < x1 && s[1] > y0 && s[1] < y1 && kind[s[1]] && kind[s[1]][s[0]] === "A") {
          put(s[0], s[1], "T", false);
        }
      });
    }
    stampPark(6, 6, 13, 13);
    stampPark(66, 8, 73, 15);
    stampPark(8, 64, 15, 71);
    stampPark(64, 64, 71, 71);

    // 14. Airy house lots in SW / SE only. Each lot = 3-wide roof + 3-wide wall + yard.
    function stampLot(x0, y0) {
      let roofN = 0;
      for (let dx = 0; dx < 3; dx++) {
        const x = x0 + dx;
        if (kind[y0] && kind[y0][x] === "?") {
          put(x, y0, (x + y0) % 2 ? "R" : "r", false);
          roofN += 1;
        }
        if (kind[y0 + 1] && kind[y0 + 1][x] === "?") put(x, y0 + 1, (x + y0) % 2 ? "H" : "h", false);
        if (kind[y0 + 2] && kind[y0 + 2][x] === "?") put(x, y0 + 2, "A", true);
      }
      return roofN >= 3;
    }
    const swLotPts = [
      [6, 44], [16, 44], [26, 44],
      [8, 54], [20, 54],
      [18, 66], [28, 66],
    ];
    const seLotPts = [
      [52, 44], [66, 44],
      [52, 54], [64, 54],
      [44, 56], [54, 64],
      [46, 73],
    ];
    let swLotN = 0;
    let seLotN = 0;
    swLotPts.forEach(function (pt) { if (stampLot(pt[0], pt[1])) swLotN += 1; });
    seLotPts.forEach(function (pt) { if (stampLot(pt[0], pt[1])) seLotN += 1; });

    // 15. Leftover vacant tiles become walkable grass courtyards, not roofs.
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (kind[y][x] === "?") put(x, y, "A", true);
      }
    }

    // After leftover A refill, bite cobble into park corners so they are not 8×8 boxes.
    [
      [6, 6, 13, 13],
      [66, 8, 73, 15],
      [8, 64, 15, 71],
      [64, 64, 71, 71],
    ].forEach(function (b) {
      const x0 = b[0], y0 = b[1], x1 = b[2], y1 = b[3];
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const ch = kind[y][x];
          if (ch !== "A") continue;
          const h = hashXY(x + 51, y + 23);
          const corner =
            (x <= x0 + 1 && y <= y0 + 1) ||
            (x >= x1 - 1 && y <= y0 + 1) ||
            (x <= x0 + 1 && y >= y1 - 1) ||
            (x >= x1 - 1 && y >= y1 - 1);
          const edge = x === x0 || x === x1 || y === y0 || y === y1;
          if ((corner && h % 2 === 0) || (edge && h % 3 === 0)) put(x, y, ".", true);
        }
      }
      for (let y = y0 - 1; y <= y1 + 1; y++) {
        for (let x = x0 - 1; x <= x1 + 1; x++) {
          if (y < wallT || x < wallT || y > n - 1 - wallT || x > n - 1 - wallT) continue;
          if (x >= x0 && x <= x1 && y >= y0 && y <= y1) continue;
          const ch = kind[y][x];
          if (ch !== ".") continue;
          if (hashXY(x + 7, y + 11) % 3 === 0) put(x, y, "A", true);
        }
      }
    });

    // Grass / cobble interlock: extra lawn on some street corners, nibble path edges.
    for (let y = wallT; y <= n - 1 - wallT; y++) {
      for (let x = wallT; x <= n - 1 - wallT; x++) {
        const ch = kind[y][x];
        if (ch !== "." && ch !== "~") continue;
        let grassN = 0;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let d = 0; d < 4; d++) {
          const nx = x + dirs[d][0];
          const ny = y + dirs[d][1];
          if (ny < 0 || nx < 0 || ny >= n || nx >= n) continue;
          if (kind[ny][nx] === "A" || kind[ny][nx] === "T") grassN += 1;
        }
        if (avenue[y] && avenue[y][x]) continue;
        const h = hashXY(x + 73, y + 91);
        if (grassN >= 2 && h % 5 === 0) put(x, y, "A", true);
        else if (grassN === 1 && h % 11 === 0) put(x, y, "A", true);
      }
    }

    // 6. Lamps + flowers only on remaining plaza cobble (after organic plaza / nibble).
    [
      [Math.round(cx - 7), Math.round(cy - 6)],
      [cx, Math.round(cy - 8)],
      [Math.round(cx + 7), Math.round(cy - 6)],
      [Math.round(cx - 8), cy],
      [Math.round(cx + 8), cy],
      [Math.round(cx - 7), Math.round(cy + 6)],
      [cx, Math.round(cy + 8)],
      [Math.round(cx + 7), Math.round(cy + 6)],
    ].forEach(function (s) {
      if (kind[s[1]] && kind[s[1]][s[0]] === "~") put(s[0], s[1], "L", true);
    });
    let plazaB = 0;
    function canPlantB(x, y) {
      if (!kind[y] || !walks[y][x]) return false;
      const ch = kind[y][x];
      if ("WPSKGFFfTH#RrhCDN".indexOf(ch) >= 0) return false;
      return ch === "." || ch === "~" || ch === "A";
    }
    [
      [36, 40],
      [44, 40],
      [40, 37],
      [40, 43],
      [34, 39],
      [45, 41],
      [33, 39],
      [43, 41],
    ].forEach(function (s) {
      if (plazaB >= 8) return;
      if (!canPlantB(s[0], s[1])) return;
      put(s[0], s[1], "B", true);
      plazaB += 1;
    });

    // Spawn / warp aprons stay walkable.
    const spawn = { x: cx, y: 51 };
    if (!walks[spawn.y] || !walks[spawn.y][spawn.x]) {
      const ch = kind[spawn.y][spawn.x];
      if (ch && "FTH#RrhCDN".indexOf(ch) >= 0) put(spawn.x, spawn.y, ".", true);
      else put(spawn.x, spawn.y, ch && ch !== "?" ? ch : ".", true);
    }
    const gateSpawn = { x: 74, y: cy };
    if (!walks[gateSpawn.y] || !walks[gateSpawn.y][gateSpawn.x]) {
      gateSpawn.x = 75;
      if (!walks[gateSpawn.y][gateSpawn.x]) put(gateSpawn.x, gateSpawn.y, ".", true);
    }
    const castleSpawn = { x: cx, y: 18 };
    if (!walks[castleSpawn.y] || !walks[castleSpawn.y][castleSpawn.x]) {
      const ch = kind[castleSpawn.y][castleSpawn.x];
      if (!ch || "FTH#RrhCDN".indexOf(ch) < 0) put(castleSpawn.x, castleSpawn.y, ch && ch !== "?" ? ch : ".", true);
    }

    function cityKey(x, y) {
      return x + "," + y;
    }
    function bfsWalk(sx, sy) {
      const seen = {};
      if (!walks[sy] || !walks[sy][sx]) return seen;
      const q = [[sx, sy]];
      seen[cityKey(sx, sy)] = true;
      let qi = 0;
      while (qi < q.length) {
        const c = q[qi++];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let d = 0; d < 4; d++) {
          const nx = c[0] + dirs[d][0];
          const ny = c[1] + dirs[d][1];
          if (ny < 0 || nx < 0 || ny >= n || nx >= n) continue;
          const k = cityKey(nx, ny);
          if (seen[k] || !walks[ny][nx]) continue;
          seen[k] = true;
          q.push([nx, ny]);
        }
      }
      return seen;
    }
    function carveRibbon(x0, y0, x1, y1) {
      let x = x0;
      let y = y0;
      const horiz = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
      for (let step = 0; step < n * 4; step++) {
        if (x !== x1) x += x < x1 ? 1 : -1;
        else if (y !== y1) y += y < y1 ? 1 : -1;
        const stamps = horiz ? [[0, 0], [0, 1]] : [[0, 0], [1, 0]];
        for (let s = 0; s < stamps.length; s++) {
          const tx = x + stamps[s][0];
          const ty = y + stamps[s][1];
          if (ty <= 0 || tx <= 0 || ty >= n - 1 || tx >= n - 1) continue;
          const ch = kind[ty][tx];
          if (ch === "#" || ch === "F" || ch === "D" || ch === "C" || ch === "N") continue;
          if (ch === "H" || ch === "h" || ch === "R" || ch === "r" || ch === "T") continue;
          if (!walks[ty][tx]) {
            if (!ch || ch === "?" || ch === "." || ch === "A" || ch === "~" || ch === "f") {
              if (ch === "?" || !ch) put(tx, ty, ".", true);
              else walks[ty][tx] = true;
            }
          }
        }
        if (x === x1 && y === y1) break;
      }
    }
    const reachGoals = [
      { name: "W", x: 24, y: 40 },
      { name: "P", x: 56, y: 40 },
      { name: "S", x: 38, y: 49 },
      { name: "G", x: 78, y: 40 },
      { name: "K", x: 40, y: 16 },
      { name: "fountain-rim", x: 40, y: 38 },
    ];
    const reach = { from: { x: 40, y: 51 }, goals: {}, repaired: [] };
    let seen = bfsWalk(40, 51);
    reachGoals.forEach(function (g) {
      const k = cityKey(g.x, g.y);
      if (seen[k]) {
        reach.goals[g.name] = { x: g.x, y: g.y, ok: true, repaired: false };
        return;
      }
      let best = [40, 51];
      let bestD = 1e9;
      Object.keys(seen).forEach(function (sk) {
        const p = sk.split(",");
        const d = Math.abs(Number(p[0]) - g.x) + Math.abs(Number(p[1]) - g.y);
        if (d < bestD) {
          bestD = d;
          best = [Number(p[0]), Number(p[1])];
        }
      });
      carveRibbon(best[0], best[1], g.x, g.y);
      reach.repaired.push(g.name);
      seen = bfsWalk(40, 51);
      reach.goals[g.name] = { x: g.x, y: g.y, ok: !!seen[cityKey(g.x, g.y)], repaired: true };
    });

    const walkable = [];
    const cells = {};
    const decor = [];
    for (let y = 0; y < n; y++) {
      walkable[y] = [];
      for (let x = 0; x < n; x++) {
        const ch = kind[y][x];
        walkable[y][x] = !!walks[y][x];
        if (ch && ch !== ".") cells[x + "," + y] = ch;
        if (ch === "T") decor.push({ x: x, y: y, kind: "tree" });
      }
    }

    return {
      cols: n,
      rows: n,
      walkable: walkable,
      cells: cells,
      decor: decor,
      spawn: spawn,
      gateSpawn: gateSpawn,
      castleSpawn: castleSpawn,
      fountain: { x: cx, y: cy },
      houseLots: { sw: swLotN, se: seLotN },
      lotPts: { sw: swLotPts, se: seLotPts },
      npcs: { W: wShop, P: pShop, S: kafra, K: { x: cx, y: 16 }, G: { x: n - wallT, y: cy } },
      reach: reach,
    };
  }


  function cityLandmarks() {
    if (MAP._cityMarks) return MAP._cityMarks;
    const marks = [];
    function add(kind, src, x, y, w, h, zoff) {
      marks.push({ kind: kind, src: src, x: x, y: y, w: w, h: h, zoff: zoff || 0 });
    }
    const sw = (cityGrid.lotPts && cityGrid.lotPts.sw) || [];
    const se = (cityGrid.lotPts && cityGrid.lotPts.se) || [];
    const houseW = 10.0;
    const houseH = 14.0;
    sw.forEach(function (pt) {
      add("house", "assets/city/house.png", pt[0] + 1.6, pt[1] + 7, houseW, houseH, 0);
      add("tree", "assets/city/tree_sm.png", pt[0] + 2.7, pt[1] + 3.4, 2.4, 3.4, 1);
    });
    se.forEach(function (pt) {
      const yOff = pt[1] <= 46 ? 13 : 7;
      add("house", "assets/city/house.png", pt[0] + 1.6, pt[1] + yOff, houseW, houseH, 0);
      add("tree", "assets/city/tree_sm.png", pt[0] + 2.7, pt[1] + 3.4, 2.4, 3.4, 1);
    });
    add("house", "assets/city/house.png", 56, 57, houseW, houseH, 0);
    add("castle", "assets/city/castle.png", 40, 16, 20, 21, 0);
    add("church", "assets/city/church.png", 57, 21, 18, 19, 0);
    add("shop", "assets/city/shop_west.png", 18, 38, 9.0, 12.0, 0);
    add("shop", "assets/city/shop_west.png", 24, 38, 9.0, 12.0, 0);
    add("shop", "assets/city/shop_east.png", 56, 38, 9.0, 12.0, 0);
    add("shop", "assets/city/shop_east.png", 62, 38, 9.0, 12.0, 0);
    add("fountain", "assets/city/fountain.png", 40, 40, 3.6, 3.8, 2);
    add("gate", "assets/city/gatehouse.png", 79.6, 36.8, 6.2, 7.0, -6);
    add("tower", "assets/city/tower.png", 1, 1, 2.6, 4.4, 4);
    add("tower", "assets/city/tower.png", 78, 1, 2.6, 4.4, 4);
    add("tower", "assets/city/tower.png", 1, 78, 2.6, 4.4, 4);
    add("tower", "assets/city/tower.png", 78, 78, 2.6, 4.4, 4);
    function wallLine(x0, y0, x1, y1, step) {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.max(Math.abs(dx), Math.abs(dy));
      const n = Math.max(1, Math.round(len / step));
      for (let i = 0; i <= n; i++) {
        const t = n === 0 ? 0 : i / n;
        const x = x0 + dx * t;
        const y = y0 + dy * t;
        if (x > 74 && y > 35 && y < 45) continue;
        if ((x < 4 && y < 4) || (x > 75 && y < 4) || (x < 4 && y > 75) || (x > 75 && y > 75)) continue;
        add("wall", "assets/city/wall.png", x, y, 2.3, 2.1, -2);
      }
    }
    wallLine(5, 1, 74, 1, 2.2);
    wallLine(5, 78.6, 74, 78.6, 2.2);
    wallLine(1, 5, 1, 74, 2.2);
    wallLine(78.6, 5, 78.6, 74, 2.2);
    (cityGrid.decor || []).forEach(function (d) {
      if (d.kind === "tree") add("tree", "assets/city/tree.png", d.x, d.y, 3.0, 4.0, 1);
    });
    marks.sort(function (a, b) {
      return a.y - b.y || (a.zoff || 0) - (b.zoff || 0);
    });
    MAP._cityMarks = marks;
    return marks;
  }

  MAP.cityLandmarks = cityLandmarks;
  MAP.flowerAt = flowerAt;
  MAP._cityMarks = null;

  const CITY_OVER_LABS = [
    { x: 40, y: 16, text: "ปราสาทโลหิต" },
    { x: 78, y: 38, text: "ป่าสงบ" },
  ];

  function warpPropHtml(cx, cy, cam, vw, vh, zoff) {
    const x = cx - 1;
    const y = cy - 1;
    const sx = x - cam.x;
    const sy = y - cam.y;
    if (sx < -4 || sy < -4 || sx > vw + 3 || sy > vh + 3) return "";
    const z = 20 + ((cy * 2) | 0) + (zoff || 10);
    return (
      '<div class="city-prop kind-warp" style="left:' +
      ((sx * 100) / vw).toFixed(3) +
      "%;top:" +
      ((sy * 100) / vh).toFixed(3) +
      '%;--prop-w:3;--prop-h:3;z-index:' +
      z +
      '"><div class="warp-ripple" aria-hidden="true"><i></i><i></i><i></i></div></div>'
    );
  }

  function paintCityOverlay() {
    if (!hostEl) return;
    const grid = hostEl.querySelector(".map-grid");
    if (!grid) return;
    let layer = grid.querySelector(".city-layer:not(.field-layer)");
    if (zoneId !== "city") {
      if (layer) layer.parentNode.removeChild(layer);
      return;
    }
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "city-layer";
      grid.appendChild(layer);
    }
    const cam = MAP.camera();
    const vw = MAP.VIEW_W;
    const vh = MAP.VIEW_H;
    const html = [];
    cityLandmarks().forEach(function (m) {
      const sx = m.x - cam.x;
      const sy = m.y - cam.y;
      if (sx < -m.w - 1 || sy < -m.h - 1 || sx > vw + 2 || sy > vh + 2) return;
      const z = 20 + ((m.y * 2) | 0) + (m.zoff || 0);
      html.push(
        '<div class="city-prop kind-' +
          m.kind +
          '" style="left:' +
          ((sx * 100) / vw).toFixed(3) +
          "%;top:" +
          ((sy * 100) / vh).toFixed(3) +
          "%;--prop-w:" +
          m.w +
          ";--prop-h:" +
          m.h +
          ";z-index:" +
          z +
          '"><img src="' +
          m.src +
          '" alt=""></div>'
      );
    });
    const npcDefs = [
      { ch: "W", src: "assets/chars/warrior_s.png", name: "อาวุธ" },
      { ch: "P", src: "assets/chars/hunter_s.png", name: "ยา" },
      { ch: "S", src: "assets/chars/angel.png", name: "คาฟร้า" },
    ];
    npcDefs.forEach(function (n) {
      const pos = (cityGrid.npcs && cityGrid.npcs[n.ch]) || null;
      if (!pos) return;
      const sx = pos.x - cam.x;
      const sy = pos.y - cam.y;
      if (sx < -3 || sy < -6 || sx > vw + 2 || sy > vh + 2) return;
      const z = 20 + ((pos.y * 2) | 0) + 8;
      html.push(
        '<div class="city-prop kind-npc" data-mx="' +
          pos.x +
          '" data-my="' +
          pos.y +
          '" style="left:' +
          ((sx * 100) / vw).toFixed(3) +
          "%;top:" +
          ((sy * 100) / vh).toFixed(3) +
          "%;--prop-w:1.8;--prop-h:5.2;z-index:" +
          z +
          '"><img class="map-sprite npc" src="' +
          n.src +
          '" alt=""><span class="npc-chip">' +
          n.name +
          "</span></div>"
      );
    });
    html.push(warpPropHtml(78, 40, cam, vw, vh, 40));
    html.push(warpPropHtml(40, 15, cam, vw, vh, 40));
    CITY_OVER_LABS.forEach(function (lab) {
      const sx = lab.x - cam.x;
      const sy = lab.y - cam.y;
      if (sx < -1 || sy < -1 || sx > vw || sy > vh) return;
      html.push(
        '<div class="city-lab" style="left:' +
          ((sx * 100) / vw).toFixed(3) +
          "%;top:" +
          ((sy * 100) / vh).toFixed(3) +
          "%;z-index:" +
          (90 + ((lab.y * 2) | 0)) +
          '">' +
          lab.text +
          "</div>"
      );
    });
    layer.innerHTML = html.join("");
  }

  const FIELD_OVER_MARKS = [
    { kind: "gate", src: "assets/city/gatehouse.png", x: 2.2, y: 99.0, w: 5.4, h: 6.2, zoff: -6 },
  ];
  MAP.FIELD_OVER_MARKS = FIELD_OVER_MARKS;
  const FIELD_OVER_LABS = [
    { x: 18, y: 82, text: "ทุ่งใกล้" },
    { x: 32, y: 70, text: "ป่ากลาง" },
    { x: 52, y: 48, text: "ป่าลึก" },
  ];

  function paintFieldOverlay() {
    if (!hostEl) return;
    const grid = hostEl.querySelector(".map-grid");
    if (!grid) return;
    let layer = grid.querySelector(".field-layer");
    if (zoneId !== "field") {
      if (layer) layer.parentNode.removeChild(layer);
      return;
    }
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "city-layer field-layer";
      grid.appendChild(layer);
    }
    const cam = MAP.camera();
    const vw = MAP.VIEW_W;
    const vh = MAP.VIEW_H;
    const html = [];
    FIELD_OVER_MARKS.forEach(function (m) {
      const sx = m.x - cam.x;
      const sy = m.y - cam.y;
      if (sx < -m.w - 1 || sy < -m.h - 1 || sx > vw + 2 || sy > vh + 2) return;
      const z = 20 + ((m.y * 2) | 0) + (m.zoff || 0);
      html.push(
        '<div class="city-prop kind-' +
          m.kind +
          '" style="left:' +
          ((sx * 100) / vw).toFixed(3) +
          "%;top:" +
          ((sy * 100) / vh).toFixed(3) +
          "%;--prop-w:" +
          m.w +
          ";--prop-h:" +
          m.h +
          ";z-index:" +
          z +
          '"><img src="' +
          m.src +
          '" alt=""></div>'
      );
    });
    FIELD_OVER_LABS.forEach(function (lab) {
      const sx = lab.x - cam.x;
      const sy = lab.y - cam.y;
      if (sx < -1 || sy < -1 || sx > vw || sy > vh) return;
      html.push(
        '<div class="city-lab" style="left:' +
          ((sx * 100) / vw).toFixed(3) +
          "%;top:" +
          ((sy * 100) / vh).toFixed(3) +
          "%;z-index:" +
          (90 + ((lab.y * 2) | 0)) +
          '">' +
          lab.text +
          "</div>"
      );
    });
    const gx = (fieldGrid.gate && fieldGrid.gate.x) || 2;
    const gy = (fieldGrid.gate && fieldGrid.gate.y) || 96;
    html.push(warpPropHtml(gx, gy, cam, vw, vh, 40));
    layer.innerHTML = html.join("");
  }


  const bossGrid = generateBosses(MAP.WORLD, 20260826);
  const cityGrid = generateCity(MAP.CITY);
  const fieldGrid = generateField(MAP.WORLD, 20260827);

  MAP.SPAWN = { x: bossGrid.spawn.x, y: bossGrid.spawn.y };
  MAP.walkable = bossGrid.walkable;
  MAP.bossCells = bossGrid.bossCells;
  MAP.bossList = bossGrid.bossList;

  const ZONES = {
    bosses: {
      id: "bosses",
      title: "ปราสาทโลหิต",
      theme: "theme-bosses",
      spawn: { x: bossGrid.spawn.x, y: bossGrid.spawn.y },
      grid: bossGrid,
    },
    city: {
      id: "city",
      title: "เมืองพรอนเทรา",
      theme: "theme-city",
      spawn: { x: cityGrid.spawn.x, y: cityGrid.spawn.y },
      gateSpawn: { x: cityGrid.gateSpawn.x, y: cityGrid.gateSpawn.y },
      castleSpawn: { x: cityGrid.castleSpawn.x, y: cityGrid.castleSpawn.y },
      grid: cityGrid,
    },
    field: {
      id: "field",
      title: "ป่าสงบ",
      theme: "theme-field",
      spawn: { x: fieldGrid.spawn.x, y: fieldGrid.spawn.y },
      grid: fieldGrid,
    },
  };

  MAP.ZONES = ZONES;

  let zoneId = "bosses";
  let saveRef = null;
  let hostEl = null;
  let keyHandler = null;
  let walkTimer = null;
  let walking = false;
  let autoTimer = null;
  let fieldMobs = null;
  let pauseUntil = 0;
  let lastCam = { x: -999, y: -999 };
  let padTimer = null;
  let padDir = null;
  let padBound = false;
  let yawDrag = null;
  let keysHeld = {};
  let keyUpHandler = null;

  MAP.yaw = 0;
  MAP.YAW_SENS = 0.32;
  MAP._groundCache = {};

  function zone() {
    return ZONES[zoneId] || ZONES.bosses;
  }

  function gridOf() {
    return zone().grid;
  }

  MAP.currentZone = function () {
    return zoneId;
  };

  MAP.setZone = function (id) {
    if (ZONES[id]) zoneId = id;
    MAP.resetYaw();
    return zoneId;
  };

  MAP.getPos = function () {
    if (!saveRef) {
      const z = zone();
      const s = z && z.spawn;
      return { x: (s && s.x) || 2, y: (s && s.y) || 7 };
    }
    return pos();
  };

  MAP.isWalking = function () {
    return walking;
  };

  MAP.stopWalking = function () {
    stopWalk();
  };

  var manualUntil = 0;
  MAP.markManual = function (ms) {
    manualUntil = Date.now() + (ms == null ? 1800 : ms);
    if (root.WORLD && WORLD.noteManual) WORLD.noteManual(ms);
  };
  MAP.isManual = function () {
    return Date.now() < manualUntil;
  };

  MAP.listFieldSpawns = function () {
    return ensureFieldMobs().map(function (m) {
      return { uid: m.uid, monsterId: m.monsterId, x: m.x, y: m.y, deadUntil: m.deadUntil };
    });
  };

  MAP.listBossSpawns = function () {
    return MAP.bossList.slice();
  };

  function cameraOrigin(px, py, cols, rows) {
    const vw = MAP.VIEW_W;
    const vh = MAP.VIEW_H;
    let cx;
    let cy;
    if (cols <= vw) cx = 0;
    else cx = Math.max(0, Math.min(cols - vw, px - Math.floor(vw / 2)));
    if (rows <= vh) cy = 0;
    else cy = Math.max(0, Math.min(rows - vh, py - Math.floor(vh / 2)));
    return { x: cx, y: cy };
  }

  MAP.camera = function () {
    const z = zone();
    const p = saveRef ? pos() : z.spawn;
    return cameraOrigin(p.x, p.y, z.grid.cols, z.grid.rows);
  };

  MAP.worldToScreen = function (wx, wy) {
    const cam = MAP.camera();
    return { x: wx - cam.x, y: wy - cam.y };
  };

  function bestAdjacentTrail(from, target) {
    if (!from || !target) return null;
    if (Math.max(Math.abs(from.x - target.x), Math.abs(from.y - target.y)) <= 1) {
      return { path: [], cost: 0 };
    }
    const dirs = MAP.DIRS8;
    let best = null;
    let bestLen = 1e9;
    for (let i = 0; i < dirs.length; i++) {
      const d = dirs[i];
      const x = target.x + d[0];
      const y = target.y + d[1];
      if (!MAP.isWalkable(x, y)) continue;
      if (from.x === x && from.y === y) return { path: [], cost: 0 };
      const trail = MAP.path(from, { x: x, y: y });
      if (!trail.length) continue;
      const last = trail[trail.length - 1];
      if (last.x !== x || last.y !== y) continue;
      if (trail.length < bestLen) {
        best = trail;
        bestLen = trail.length;
      }
    }
    if (!best) return null;
    return { path: best, cost: bestLen };
  }

  MAP.adjacentWalkCost = function (from, target) {
    const hit = bestAdjacentTrail(from, target);
    return hit ? hit.cost : -1;
  };

  MAP.walkToAdjacent = function (from, target) {
    const hit = bestAdjacentTrail(from, target);
    if (!hit) return false;
    if (hit.path.length) walkPath(hit.path);
    return true;
  };

  MAP.bossAt = function (x, y) {
    const id = MAP.bossCells[x + "," + y];
    if (!id) return null;
    return DATA.BOSSES.find(function (b) {
      return b.id === id;
    });
  };

  MAP.isWalkable = function (x, y, z) {
    const g = z && ZONES[z] ? ZONES[z].grid : gridOf();
    if (y < 0 || y >= g.rows || x < 0 || x >= g.cols) return false;
    return !!(g.walkable[y] && g.walkable[y][x]);
  };

  MAP.DIRS8 = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  function canStepDiag(x, y, dx, dy) {
    if (!dx || !dy) return true;
    return MAP.isWalkable(x + dx, y) && MAP.isWalkable(x, y + dy);
  }

  MAP.neighbors = function (x, y) {
    const out = [];
    MAP.DIRS8.forEach(function (d) {
      const nx = x + d[0];
      const ny = y + d[1];
      if (!MAP.isWalkable(nx, ny)) return;
      if (!canStepDiag(x, y, d[0], d[1])) return;
      if (root.WORLD && WORLD.blocksTile && WORLD.blocksTile(nx, ny)) return;
      out.push({ x: nx, y: ny });
    });
    return out;
  };

  function greedyToward(from, to) {
    const trail = [];
    let x = from.x;
    let y = from.y;
    for (let i = 0; i < 48; i++) {
      const dirs = MAP.DIRS8;
      let best = null;
      let bestD = Math.abs(x - to.x) + Math.abs(y - to.y);
      dirs.forEach(function (d) {
        const nx = x + d[0];
        const ny = y + d[1];
        if (!MAP.isWalkable(nx, ny)) return;
        if (!canStepDiag(x, y, d[0], d[1])) return;
        if (root.WORLD && WORLD.blocksTile && WORLD.blocksTile(nx, ny)) return;
        const dist = Math.abs(nx - to.x) + Math.abs(ny - to.y);
        if (dist < bestD) {
          bestD = dist;
          best = { x: nx, y: ny };
        }
      });
      if (!best) break;
      trail.push(best);
      x = best.x;
      y = best.y;
      if (x === to.x && y === to.y) break;
    }
    return trail;
  }

  MAP.path = function (from, to) {
    if (!from || !to) return [];
    if (from.x === to.x && from.y === to.y) return [];
    const key = function (p) {
      return p.x + "," + p.y;
    };
    const heur = function (p) {
      return Math.max(Math.abs(p.x - to.x), Math.abs(p.y - to.y));
    };
    const open = [{ x: from.x, y: from.y, g: 0, f: heur(from) }];
    const came = {};
    const gScore = {};
    gScore[key(from)] = 0;
    came[key(from)] = null;
    let expanded = 0;
    while (open.length && expanded < MAP.PATH_NODE_CAP) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bi].f) bi = i;
      }
      const cur = open.splice(bi, 1)[0];
      expanded += 1;
      if (cur.x === to.x && cur.y === to.y) {
        const trail = [];
        let n = cur;
        while (n && !(n.x === from.x && n.y === from.y)) {
          trail.push({ x: n.x, y: n.y });
          n = came[key(n)];
        }
        trail.reverse();
        return trail;
      }
      MAP.neighbors(cur.x, cur.y).forEach(function (nb) {
        const nk = key(nb);
        const ng = cur.g + 1;
        if (gScore[nk] == null || ng < gScore[nk]) {
          gScore[nk] = ng;
          came[nk] = { x: cur.x, y: cur.y };
          open.push({ x: nb.x, y: nb.y, g: ng, f: ng + heur(nb) });
        }
      });
    }
    return greedyToward(from, to);
  };

  function posKey() {
    if (zoneId === "city") return "cityPos";
    if (zoneId === "field") return "fieldPos";
    return "mapPos";
  }

  function pos() {
    const key = posKey();
    const z = zone();
    if (!saveRef[key]) saveRef[key] = { x: z.spawn.x, y: z.spawn.y };
    if (!MAP.isWalkable(saveRef[key].x, saveRef[key].y)) {
      saveRef[key] = { x: z.spawn.x, y: z.spawn.y };
    }
    return saveRef[key];
  }

  function storePos(x, y) {
    const key = posKey();
    saveRef[key] = { x: x, y: y };
    if (zoneId === "bosses") saveRef.mapPos = { x: x, y: y };
  }

  function stopWalk() {
    if (walkTimer) {
      clearTimeout(walkTimer);
      walkTimer = null;
    }
    walking = false;
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function stopPad() {
    padDir = null;
    if (padTimer) {
      clearInterval(padTimer);
      padTimer = null;
    }
  }

  MAP.resetField = function () {
    fieldMobs = null;
    pauseUntil = 0;
  };

  function ensureFieldMobs() {
    if (fieldMobs) return fieldMobs;
    fieldMobs = (fieldGrid.mobs || []).map(function (m) {
      return { uid: m.uid, monsterId: m.monsterId, x: m.x, y: m.y, deadUntil: 0 };
    });
    return fieldMobs;
  }

  function livingMobs() {
    const now = Date.now();
    return ensureFieldMobs().filter(function (m) {
      return !m.deadUntil || now >= m.deadUntil;
    });
  }

  MAP.monsterAt = function (x, y) {
    if (root.WORLD && WORLD.entityAt) {
      const e = WORLD.entityAt(x, y);
      if (e && e.kind === "mob") return { monsterId: e.monsterId, x: e.x, y: e.y, uid: e.id };
    }
    if (zoneId !== "field") return null;
    const now = Date.now();
    return (
      ensureFieldMobs().find(function (m) {
        return m.x === x && m.y === y && (!m.deadUntil || now >= m.deadUntil);
      }) || null
    );
  };

  MAP.markMobDead = function (x, y) {
    ensureFieldMobs().forEach(function (m) {
      if (m.x === x && m.y === y) m.deadUntil = Date.now() + DATA.fieldRespawnMs();
    });
  };

  MAP.npcAt = function (x, y) {
    if (zoneId !== "city") return null;
    const ch = cityGrid.cells[x + "," + y];
    if (ch === "W") return { id: "gear", name: "ร้านอาวุธ / อุปกรณ์" };
    if (ch === "P") return { id: "potion", name: "ร้านยา" };
    if (ch === "S") return { id: "kafra", name: "คาฟร้า" };
    if (ch === "K") return { id: "castle", name: "ปราสาทโลหิต" };
    if (ch === "G") return { id: "field", name: "ประตูทุ่ง" };
    return null;
  };

  MAP.gateAt = function (x, y) {
    const g = gridOf();
    const ch = g.cells[x + "," + y];
    if (zoneId === "field" && ch === "X") return "city";
    if (zoneId === "city") {
      if (ch === "G") return "field";
      if (ch === "K") return "bosses";
    }
    return null;
  };

  function targetAt(x, y) {
    if (root.WORLD && WORLD.entityAt) {
      const ent = WORLD.entityAt(x, y);
      if (ent) {
        WORLD.clickEntity(ent);
        return true;
      }
    }
    return false;
  }

  function openNpc(npc, stay) {
    if (!npc) return;
    stopWalk();
    if (stay) storePos(stay.x, stay.y);
    else {
      const p = pos();
      storePos(p.x, p.y);
    }
    if (npc.id === "field") {
      if (root.App && App.goField) App.goField();
      return;
    }
    if (npc.id === "castle") {
      if (root.App && App.goBossSelect) App.goBossSelect();
      else if (root.App && App.goBossMap) App.goBossMap();
      return;
    }
    if (root.App && App.openNpc) App.openNpc(npc.id);
  }

  function interactAt(nx, ny, stay) {
    if (zoneId === "bosses" || zoneId === "field") {
      if (targetAt(nx, ny)) return true;
    }
    if (zoneId === "field") {
      const gate = MAP.gateAt(nx, ny);
      if (gate === "city") {
        stopWalk();
        if (stay) storePos(stay.x, stay.y);
        if (root.App && App.goCity) App.goCity({ fromField: true });
        return true;
      }
    }
    if (zoneId === "city") {
      const npc = MAP.npcAt(nx, ny);
      if (npc) {
        openNpc(npc, stay);
        return true;
      }
    }
    return false;
  }

  function tryStep(dx, dy) {
    const p = pos();
    if (MAP.isSitting()) MAP.setSitting(false);
    if (saveRef && root.PVE && PVE.weightState && PVE.weightState(saveRef).full) {
      if (!MAP._weightToastAt || Date.now() - MAP._weightToastAt > 1500) {
        MAP._weightToastAt = Date.now();
        if (root.UI && UI.toast) UI.toast("น้ำหนักเต็ม เดินไม่ได้");
      }
      return false;
    }
    if (dx && dy && !canStepDiag(p.x, p.y, dx, dy)) {
      const openX = MAP.isWalkable(p.x + dx, p.y);
      const openY = MAP.isWalkable(p.x, p.y + dy);
      if (openX && !openY) dy = 0;
      else if (openY && !openX) dx = 0;
      else return false;
    }
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (root.WORLD && WORLD.entityAt) {
      const ent = WORLD.entityAt(nx, ny);
      if (ent && !ent.dead) {
        if (saveRef) saveRef.facing = (root.FX && FX.facingFromDelta) ? FX.facingFromDelta(dx, dy) : "s";
        MAP.facing = saveRef && saveRef.facing;
        WORLD.setTarget(ent.id);
        WORLD.adjacentAggro(p.x, p.y);
        MAP.renderVisible();
        return true;
      }
    }
    if (interactAt(nx, ny, { x: p.x, y: p.y })) return true;
    if (!MAP.isWalkable(nx, ny)) return false;
    p.x = nx;
    p.y = ny;
    if (saveRef) saveRef.facing = (root.FX && FX.facingFromDelta) ? FX.facingFromDelta(dx, dy) : "s";
    MAP.facing = saveRef && saveRef.facing;
    storePos(nx, ny);
    if (saveRef) {
      saveRef.walkFrame = saveRef.walkFrame === 1 ? 2 : 1;
    }
    MAP.renderVisible();
    const av = hostEl && hostEl.querySelector(".map-avatar");
    if (av && root.FX && FX.markWalk) FX.markWalk(av);
    if (root.WORLD && WORLD.adjacentAggro) WORLD.adjacentAggro(nx, ny);
    return true;
  }

  function walkPath(steps) {
    if (!steps || !steps.length) return;
    if (saveRef && root.PVE && PVE.weightState && PVE.weightState(saveRef).full) {
      if (!MAP._weightToastAt || Date.now() - MAP._weightToastAt > 1500) {
        MAP._weightToastAt = Date.now();
        if (root.UI && UI.toast) UI.toast("น้ำหนักเต็ม เดินไม่ได้");
      }
      return;
    }
    walking = true;
    function next() {
      if (!walking || !steps.length) {
        walking = false;
        return;
      }
      const step = steps.shift();
      const p = pos();
      if (root.WORLD && WORLD.entityAt) {
        const ent = WORLD.entityAt(step.x, step.y);
        if (ent && !ent.dead) {
          WORLD.clickEntity(ent);
          walking = false;
          return;
        }
      }
      if (interactAt(step.x, step.y, { x: p.x, y: p.y })) return;
      if (!MAP.isWalkable(step.x, step.y)) {
        walking = false;
        return;
      }
      if (saveRef) saveRef.facing = (root.FX && FX.facingFromDelta) ? FX.facingFromDelta(step.x - p.x, step.y - p.y) : "s";
      MAP.facing = saveRef && saveRef.facing;
      storePos(step.x, step.y);
      if (saveRef) saveRef.walkFrame = saveRef.walkFrame === 1 ? 2 : 1;
      MAP.renderVisible();
      const av = hostEl && hostEl.querySelector(".map-avatar");
      if (av && root.FX && FX.markWalk) FX.markWalk(av);
      if (root.WORLD && WORLD.adjacentAggro) WORLD.adjacentAggro(step.x, step.y);
      if (root.WORLD && WORLD.holdIfInRange && WORLD.holdIfInRange()) {
        walking = false;
        return;
      }
      if (steps.length) walkTimer = setTimeout(next, 90);
      else walking = false;
    }
    next();
  }

  function nearestLivingMob(from) {
    const mobs = livingMobs();
    let best = null;
    let bestCost = Infinity;
    let bestCheb = Infinity;
    let bestManh = Infinity;
    mobs.forEach(function (m) {
      if (typeof PVE !== "undefined" && PVE.farmAllowsMob && saveRef && !PVE.farmAllowsMob(saveRef, m.monsterId)) return;
      const cost = MAP.adjacentWalkCost(from, m);
      if (cost < 0 || !isFinite(cost)) return;
      const ch = Math.max(Math.abs(from.x - m.x), Math.abs(from.y - m.y));
      const mh = Math.abs(from.x - m.x) + Math.abs(from.y - m.y);
      if (
        cost < bestCost ||
        (cost === bestCost && ch < bestCheb) ||
        (cost === bestCost && ch === bestCheb && mh < bestManh)
      ) {
        best = m;
        bestCost = cost;
        bestCheb = ch;
        bestManh = mh;
      }
    });
    return best;
  }

  function tickAutoFarm() {
    if (root.WORLD && WORLD.live && WORLD.live()) return;
    if (MAP.isManual()) return;
    if (!saveRef || !saveRef.autoFarm || zoneId !== "field" || walking) return;
    if (Date.now() < pauseUntil) return;
    const p = pos();
    if (MAP.monsterAt(p.x, p.y)) return;
    const d = PVE && PVE.derived ? PVE.derived(saveRef) : null;
    const hp = saveRef.hp;
    const maxHp = d ? d.maxHp : 1;
    if (maxHp && hp / maxHp < (DATA.AUTO_FARM_STOP_HP || 0.15) && PVE && !PVE.hasHpPotion(saveRef)) {
      saveRef.autoFarm = false;
      if (root.UI && UI.toast) UI.toast("HP ต่ำและยาหมด — หยุด Auto Farm กลับเมืองได้");
      if (root.UI && UI.refreshHud) UI.refreshHud(saveRef);
      return;
    }
    const mob = nearestLivingMob(p);
    if (!mob) return;
    const dist = Math.abs(p.x - mob.x) + Math.abs(p.y - mob.y);
    const hid = saveRef.heroId;
    const hold = (hid === "hunter" && root.WORLD && WORLD.HUNTER_RANGE)
      ? WORLD.HUNTER_RANGE
      : 1;
    if (dist <= hold) return;
    MAP.walkToAdjacent(p, mob);
  }

  function startAutoLoop() {
    stopAuto();
    if (!saveRef || !saveRef.autoFarm || zoneId !== "field") return;
    autoTimer = setInterval(tickAutoFarm, 220);
    setTimeout(tickAutoFarm, 80);
  }

  MAP.pauseAuto = function (ms) {
    pauseUntil = Date.now() + (ms || 600);
  };

  function wrapYaw(deg) {
    deg = deg % 360;
    if (deg < 0) deg += 360;
    return deg;
  }

  function applyYawCss() {
    if (!hostEl) return;
    const grid = hostEl.querySelector(".map-grid");
    const p = saveRef ? pos() : { x: 0, y: 0 };
    const cam = MAP.camera();
    const vw = MAP.VIEW_W;
    const vh = MAP.VIEW_H;
    const ox = ((p.x - cam.x + 0.5) / vw) * 100;
    const oy = ((p.y - cam.y + 0.5) / vh) * 100;
    const yaw = MAP.yaw || 0;
    hostEl.style.setProperty("--map-yaw", yaw + "deg");
    if (grid) {
      grid.style.setProperty("--map-yaw", yaw + "deg");
      grid.style.setProperty("--yaw-ox", ox + "%");
      grid.style.setProperty("--yaw-oy", oy + "%");
      grid.style.transformOrigin = ox + "% " + oy + "%";
      grid.style.transform = "rotate(" + yaw + "deg)";
    }
    let compass = hostEl.querySelector(".map-compass");
    if (!compass) {
      compass = document.createElement("div");
      compass.className = "map-compass";
      compass.setAttribute("aria-hidden", "true");
      compass.innerHTML = '<span class="map-compass-n">N</span>';
      hostEl.appendChild(compass);
    }
    compass.style.transform = "rotate(" + -yaw + "deg)";
  }

  MAP.resetYaw = function () {
    MAP.yaw = 0;
    yawDrag = null;
    applyYawCss();
  };

  MAP.setYaw = function (deg) {
    MAP.yaw = wrapYaw(deg);
    applyYawCss();
    return MAP.yaw;
  };

  function screenDirToWorld(dx, dy) {
    const rad = -(MAP.yaw || 0) * Math.PI / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const wx = dx * c - dy * s;
    const wy = dx * s + dy * c;
    const ax = Math.abs(wx);
    const ay = Math.abs(wy);
    if (ax < 1e-6 && ay < 1e-6) return { x: 0, y: 0 };
    if (Math.abs(ax - ay) < 0.35) {
      return { x: wx > 0 ? 1 : -1, y: wy > 0 ? 1 : -1 };
    }
    if (ax > ay) return { x: wx > 0 ? 1 : -1, y: 0 };
    return { x: 0, y: wy > 0 ? 1 : -1 };
  }

  MAP.screenDirToWorld = screenDirToWorld;

  function screenToTile(clientX, clientY) {
    if (!hostEl) return null;
    const box = hostEl.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    const p = pos();
    const cam = MAP.camera();
    const vw = MAP.VIEW_W;
    const vh = MAP.VIEW_H;
    const ox = ((p.x - cam.x + 0.5) / vw) * box.width;
    const oy = ((p.y - cam.y + 0.5) / vh) * box.height;
    const lx = clientX - box.left;
    const ly = clientY - box.top;
    const rad = -(MAP.yaw || 0) * Math.PI / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const dx = lx - ox;
    const dy = ly - oy;
    const rx = dx * c - dy * s;
    const ry = dx * s + dy * c;
    const sx = Math.floor((ox + rx) / box.width * vw);
    const sy = Math.floor((oy + ry) / box.height * vh);
    return { x: cam.x + sx, y: cam.y + sy };
  }

  MAP.screenToTile = screenToTile;

  function onContextMenu(ev) {
    ev.preventDefault();
  }

  function onYawPointerDown(ev) {
    if (ev.button !== 2) return;
    ev.preventDefault();
    yawDrag = {
      x: ev.clientX,
      y: ev.clientY,
      startYaw: MAP.yaw || 0,
      moved: 0,
    };
    if (hostEl && hostEl.setPointerCapture) {
      try { hostEl.setPointerCapture(ev.pointerId); } catch (e) {}
    }
  }

  function onYawPointerMove(ev) {
    if (!yawDrag) return;
    const dx = ev.clientX - yawDrag.x;
    const dy = ev.clientY - yawDrag.y;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    if (dist > yawDrag.moved) yawDrag.moved = dist;
    if (yawDrag.moved >= 8) {
      MAP.yaw = wrapYaw(yawDrag.startYaw + dx * MAP.YAW_SENS);
      applyYawCss();
    }
  }

  function onYawPointerUp(ev) {
    if (!yawDrag) return;
    if (yawDrag.moved < 8) {
      MAP.yaw = wrapYaw(yawDrag.startYaw + 45);
      applyYawCss();
    }
    yawDrag = null;
  }

  function bindYaw() {
    if (!hostEl) return;
    hostEl.addEventListener("contextmenu", onContextMenu);
    hostEl.addEventListener("pointerdown", onYawPointerDown);
    window.addEventListener("pointermove", onYawPointerMove);
    window.addEventListener("pointerup", onYawPointerUp);
    window.addEventListener("pointercancel", onYawPointerUp);
  }

  function unbindYaw() {
    if (hostEl) {
      hostEl.removeEventListener("contextmenu", onContextMenu);
      hostEl.removeEventListener("pointerdown", onYawPointerDown);
    }
    window.removeEventListener("pointermove", onYawPointerMove);
    window.removeEventListener("pointerup", onYawPointerUp);
    window.removeEventListener("pointercancel", onYawPointerUp);
    yawDrag = null;
  }

  function keyAxis(k) {
    if (k === "ArrowLeft" || k === "a" || k === "A") return "left";
    if (k === "ArrowRight" || k === "d" || k === "D") return "right";
    if (k === "ArrowUp" || k === "w" || k === "W") return "up";
    if (k === "ArrowDown" || k === "s" || k === "S") return "down";
    return null;
  }

  function heldMove() {
    let dx = 0;
    let dy = 0;
    if (keysHeld.left) dx -= 1;
    if (keysHeld.right) dx += 1;
    if (keysHeld.up) dy -= 1;
    if (keysHeld.down) dy += 1;
    return { dx: dx, dy: dy };
  }

  function onKey(ev) {
    if (!hostEl || !saveRef) return;
    const tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (ev.key === "n" || ev.key === "N") {
      ev.preventDefault();
      if (root.App && App.toggleSit) App.toggleSit();
      return;
    }
    const axis = keyAxis(ev.key);
    if (!axis) return;
    ev.preventDefault();
    keysHeld[axis] = true;
    MAP.markManual(2000);
    const v = heldMove();
    if (!v.dx && !v.dy) return;
    stopWalk();
    const world = screenDirToWorld(v.dx, v.dy);
    tryStep(world.x, world.y);
  }

  function onKeyUp(ev) {
    const axis = keyAxis(ev.key);
    if (!axis) return;
    keysHeld[axis] = false;
  }

  function onClick(ev) {
    if (ev.button != null && ev.button !== 0) return;
    const tile = ev.target.closest && ev.target.closest("[data-mx]");
    let x;
    let y;
    if (tile) {
      x = Number(tile.getAttribute("data-mx"));
      y = Number(tile.getAttribute("data-my"));
    } else {
      const un = screenToTile(ev.clientX, ev.clientY);
      if (!un) return;
      x = un.x;
      y = un.y;
    }
    const p = pos();
    stopWalk();
    if (root.WORLD && WORLD.entityAt) {
      const ent = WORLD.entityAt(x, y);
      if (ent && !ent.dead) {
        WORLD.clickEntity(ent);
        return;
      }
    }
    if (interactAt(x, y, { x: p.x, y: p.y }) && Math.abs(p.x - x) + Math.abs(p.y - y) <= 1) {
      return;
    }
    if (!MAP.isWalkable(x, y) && !MAP.monsterAt(x, y) && !MAP.npcAt(x, y) && !MAP.bossAt(x, y)) return;
    if (p.x === x && p.y === y) return;
    MAP.markManual(2000);
    walkPath(MAP.path(p, { x: x, y: y }));
  }

  function startPad(dx, dy) {
    const world = screenDirToWorld(dx, dy);
    stopWalk();
    MAP.markManual(2000);
    padDir = { x: world.x, y: world.y };
    tryStep(world.x, world.y);
    if (padTimer) clearInterval(padTimer);
    padTimer = setInterval(function () {
      if (!padDir || !hostEl) return;
      tryStep(padDir.x, padDir.y);
    }, MAP.PAD_STEP_MS);
  }

  function onPadPointer(ev) {
    const btn = ev.target.closest && ev.target.closest("[data-dx]");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    startPad(Number(btn.getAttribute("data-dx")), Number(btn.getAttribute("data-dy")));
  }

  function onPadRelease(ev) {
    if (!padDir) return;
    ev.preventDefault();
    stopPad();
  }

  function bindPad() {
    const pad = document.getElementById("walk-pad");
    if (!pad || padBound) return;
    padBound = true;
    pad.addEventListener("pointerdown", onPadPointer);
    window.addEventListener("pointerup", onPadRelease);
    window.addEventListener("pointercancel", onPadRelease);
  }

  function unbindPad() {
    const pad = document.getElementById("walk-pad");
    if (pad) pad.removeEventListener("pointerdown", onPadPointer);
    window.removeEventListener("pointerup", onPadRelease);
    window.removeEventListener("pointercancel", onPadRelease);
    padBound = false;
    stopPad();
  }

  function spriteSrc(heroId) {
    const sitting = MAP.isSitting();
    const unit = { heroId: heroId, facing: (saveRef && saveRef.facing) || MAP.facing || "s", walkFrame: sitting ? 0 : (saveRef && saveRef.walkFrame), sitting: sitting };
    if (root.FX && FX.spriteSrc) return FX.spriteSrc(heroId, unit);
    return "assets/chars/" + (heroId || "warrior") + "_s.png";
  }


  function groundRole(zid, x, y) {
    if (zid === "city") {
      const ch = cityGrid.cells[x + "," + y] || "";
      if (ch === "~" || ch === "F" || ch === "f" || ch === "L" || ch === "B") return "plaza";
      const walk = !!(cityGrid.walkable[y] && cityGrid.walkable[y][x]);
      if (walk && (!ch || ch === "W" || ch === "P" || ch === "S" || ch === "K" || ch === "G")) return "path";
      return "lawn";
    }
    if (zid === "field") {
      if (fieldGrid.trails && fieldGrid.trails[x + "," + y]) return "path";
      if (fieldGrid.plain && fieldGrid.plain[x + "," + y]) return "meadow";
      return "lawn";
    }
    return "lawn";
  }

  function fillTextureWorld(ctx, img, w, h, fallback) {
    if (img && (img.naturalWidth || img.width)) {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      for (let py = 0; py < h; py += ih) {
        for (let px = 0; px < w; px += iw) {
          ctx.drawImage(img, px, py);
        }
      }
      return;
    }
    if (fallback) {
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function stampSoftRole(ctx, w, h, zid, role, img, fallback, tilePx) {
    const layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
    const lx = layer.getContext("2d");
    if (!lx) return;
    fillTextureWorld(lx, img, w, h, fallback);
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const mx = mask.getContext("2d");
    if (!mx) return;
    const g = ZONES[zid] && ZONES[zid].grid;
    if (!g) return;
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) {
        if (groundRole(zid, x, y) !== role) continue;
        const cx = (x + 0.5) * tilePx;
        const cy = (y + 0.5) * tilePx;
        const rad = (0.82 + (hashXY(x + 3, y + 11) % 14) / 100) * tilePx;
        const grad = mx.createRadialGradient(cx, cy, rad * 0.42, cx, cy, rad);
        grad.addColorStop(0, "rgba(0,0,0,1)");
        grad.addColorStop(0.62, "rgba(0,0,0,0.88)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        mx.fillStyle = grad;
        mx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }
    }
    lx.globalCompositeOperation = "destination-in";
    lx.drawImage(mask, 0, 0);
    ctx.drawImage(layer, 0, 0);
  }


  function stampMeadowBright(ctx, w, h, grassImg, tilePx) {
    const layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
    const lx = layer.getContext("2d");
    if (!lx) return;
    fillTextureWorld(lx, grassImg, w, h, "#3d7a38");
    lx.fillStyle = "rgba(186, 214, 96, 0.34)";
    lx.fillRect(0, 0, w, h);
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const mx = mask.getContext("2d");
    if (!mx) return;
    const grid = ZONES.field && ZONES.field.grid;
    if (!grid) return;
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        if (groundRole("field", x, y) !== "meadow") continue;
        const cx = (x + 0.5) * tilePx;
        const cy = (y + 0.5) * tilePx;
        const rad = (0.82 + (hashXY(x + 3, y + 11) % 14) / 100) * tilePx;
        const grad = mx.createRadialGradient(cx, cy, rad * 0.42, cx, cy, rad);
        grad.addColorStop(0, "rgba(0,0,0,1)");
        grad.addColorStop(0.62, "rgba(0,0,0,0.88)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        mx.fillStyle = grad;
        mx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }
    }
    lx.globalCompositeOperation = "destination-in";
    lx.drawImage(mask, 0, 0);
    ctx.drawImage(layer, 0, 0);
  }

  function paintGroundCanvas(zid, imgs) {
    const z = ZONES[zid];
    if (!z || typeof document === "undefined") return null;
    const tilePx = 16;
    const w = z.grid.cols * tilePx;
    const h = z.grid.rows * tilePx;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const lawnFallback = zid === "city" ? "#8fd15a" : "#245044";
    fillTextureWorld(ctx, imgs.lawn, w, h, lawnFallback);
    if (zid === "city") {
      stampSoftRole(ctx, w, h, zid, "path", imgs.path, "#c4b49a", tilePx);
      stampSoftRole(ctx, w, h, zid, "plaza", imgs.plaza, "#f6e6d0", tilePx);
    } else {
      if (zid === "field") stampMeadowBright(ctx, w, h, imgs.lawn, tilePx);
      stampSoftRole(ctx, w, h, zid, "path", imgs.path, "#5a4a32", tilePx);
    }
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  function applyGroundCss() {
    if (!hostEl) return;
    const grid = hostEl.querySelector(".map-grid");
    if (!grid) return;
    const z = zone();
    const cam = MAP.camera();
    grid.style.setProperty("--cam-x", String(cam.x));
    grid.style.setProperty("--cam-y", String(cam.y));
    grid.style.setProperty("--zone-w", String(z.grid.cols));
    grid.style.setProperty("--zone-h", String(z.grid.rows));
    const ground = grid.querySelector(".map-ground");
    if (!ground) return;
    const denX = z.grid.cols - MAP.VIEW_W;
    const denY = z.grid.rows - MAP.VIEW_H;
    if (denX > 0 && denY > 0) {
      ground.style.backgroundPosition =
        (cam.x * 100 / denX).toFixed(4) + "% " + (cam.y * 100 / denY).toFixed(4) + "%";
    } else {
      ground.style.backgroundPosition = "0% 0%";
    }
    const cached = MAP._groundCache[zoneId];
    if (cached && cached.url) {
      ground.style.backgroundImage = 'url("' + cached.url + '")';
      ground.style.backgroundColor = "transparent";
    } else if (zoneId === "city") {
      ground.style.backgroundColor = "#8fd15a";
      ground.style.backgroundImage = "none";
    } else if (zoneId === "field") {
      ground.style.backgroundColor = "#245044";
      ground.style.backgroundImage = "none";
    } else {
      ground.style.backgroundColor = "transparent";
      ground.style.backgroundImage = "none";
    }
  }

  function bakeGround(zid) {
    if (typeof document === "undefined" || typeof Image === "undefined") return;
    if (zid !== "city" && zid !== "field") return;
    if (MAP._groundCache[zid]) return MAP._groundCache[zid];
    MAP._groundBaking = MAP._groundBaking || {};
    if (MAP._groundBaking[zid]) return;
    MAP._groundBaking[zid] = true;
    const srcs =
      zid === "city"
        ? {
            lawn: "assets/tiles/city_lawn.png",
            path: "assets/tiles/city_ground.png",
            plaza: "assets/tiles/city_plaza.png",
          }
        : {
            lawn: "assets/tiles/grass.png",
            path: "assets/tiles/path.png",
          };
    const keys = Object.keys(srcs);
    const imgs = {};
    let pending = keys.length;
    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      let url = null;
      try {
        url = paintGroundCanvas(zid, imgs);
      } catch (err) {
        url = null;
      }
      if (url) {
        MAP._groundCache[zid] = { url: url, cols: ZONES[zid].grid.cols, rows: ZONES[zid].grid.rows };
        if (hostEl && zoneId === zid) applyGroundCss();
      }
      MAP._groundBaking[zid] = false;
    }
    function got(k, img) {
      if (Object.prototype.hasOwnProperty.call(imgs, k)) return;
      imgs[k] = img || null;
      pending -= 1;
      if (!pending) finish();
    }
    keys.forEach(function (k) {
      const img = new Image();
      img.onload = function () {
        got(k, img);
      };
      img.onerror = function () {
        got(k, null);
      };
      img.src = srcs[k];
      if (img.complete && img.naturalWidth) got(k, img);
    });
  }

  function paintPlayer() {
    if (!hostEl) return;
    const p = pos();
    const sp = MAP.worldToScreen(p.x, p.y);
    const vw = MAP.VIEW_W;
    const vh = MAP.VIEW_H;
    const avatar = hostEl.querySelector(".map-avatar");
    if (avatar) {
      avatar.style.left = (sp.x * 100) / vw + "%";
      avatar.style.top = (sp.y * 100) / vh + "%";
      avatar.style.zIndex = String(20 + ((p.y * 2) | 0) + 3);
      const hid = (saveRef && saveRef.heroId) || "warrior";
      const face = (saveRef && saveRef.facing) || MAP.facing || "s";
      const sitting = MAP.isSitting();
      avatar.classList.toggle("sitting", sitting);
      const img = avatar.querySelector("img.map-sprite");
      const src = spriteSrc(hid);
      if (img && img.getAttribute("src") !== src) img.src = src;
      if (root.FX && FX.applyFacing) FX.applyFacing(avatar, face);
    }
    hostEl.querySelectorAll(".map-tile").forEach(function (el) {
      const x = Number(el.getAttribute("data-mx"));
      const y = Number(el.getAttribute("data-my"));
      el.classList.toggle("here", x === p.x && y === p.y);
    });
    applyYawCss();
    applyGroundCss();
  }

  function tileClass(x, y, walk, inMap) {
    let cls = "map-tile" + (walk ? " path" : " block");
    if (!inMap) return cls + " void";
    if (zoneId === "city") {
      const ch = cityGrid.cells[x + "," + y] || "";
      if (ch === "~") cls += " plaza";
      else if (ch === "F") cls += " fountain";
      else if (ch === "f") cls += " fountain-rim";
      else if (ch === "T") cls += " tree park";
      else if (ch === "A") cls += " park";
      else if (ch === "H") cls += " house";
      else if (ch === "h") cls += " house house-alt";
      else if (ch === "R") cls += " roof";
      else if (ch === "r") cls += " roof roof-alt";
      else if (ch === "C") cls += " church";
      else if (ch === "N") cls += " church-roof";
      else if (ch === "D") cls += " keep";
      else if (ch === "#") cls += " battlement";
      else if (ch === "L") cls += " lamp plaza";
      else if (ch === "B") cls += " flower plaza";
      else if (ch === "W") cls += " npc street";
      else if (ch === "P") cls += " npc street";
      else if (ch === "S") cls += " npc street";
      else if (ch === "K") cls += " npc warp";
      else if (ch === "G") cls += " gate warp";
      else if (walk) cls += " street";
    }
    if (zoneId === "field") {
      if (fieldGrid.cells[x + "," + y] === "X") cls += " gate warp";
      if (walk && fieldGrid.trails && fieldGrid.trails[x + "," + y]) cls += " trail";
      if (fieldGrid.plain && fieldGrid.plain[x + "," + y]) cls += " plain";
      const fdist = fieldGrid.spawn ? Math.abs(x - fieldGrid.spawn.x) + Math.abs(y - fieldGrid.spawn.y) : 999;
      if (fdist >= 52) cls += " mist deep";
      if (walk && flowerAt(x, y)) cls += " flower";
    }
    if (zoneId === "bosses" && MAP.bossAt(x, y)) {
      const b = MAP.bossAt(x, y);
      cls += " boss" + (saveRef && saveRef.clearedBosses && saveRef.clearedBosses[b.id] ? " cleared" : "");
    }
    return cls;
  }
  MAP.tileClass = tileClass;

  function tileInner(x, y, walk) {
    if (zoneId === "bosses") {
      if (!walk) {
        const dec = (bossGrid.decor || []).find(function (d) {
          return d.x === x && d.y === y;
        });
        if (dec && dec.kind === "ruin") return '<span class="map-decor">🏛</span>';
        return '<span class="map-decor">🌲</span>';
      }
      return "";
    }
    if (zoneId === "city") {
      const ch = cityGrid.cells[x + "," + y] || "";
      if (ch === "B") return tileArt("assets/tiles/flowers.png", "flower");
      return "";
    }
    if (zoneId === "field") {
      const ch = fieldGrid.cells[x + "," + y] || "";
      if (ch === "X") {
        if (fieldGrid.gate && x === fieldGrid.gate.x && y === fieldGrid.gate.y) {
          return '<span class="map-boss-lab">กลับหมู่บ้าน</span>';
        }
        return "";
      }
      if (!walk) {
        const gt = fieldGrid.gate;
        if (ch === "X") return "";
        if (gt && x <= gt.x + 3 && y >= gt.y - 2 && (x <= gt.x + 1 || y >= gt.y)) return "";
        const dec = (fieldGrid.decorAt && fieldGrid.decorAt[x + "," + y]) || null;
        if (dec && dec.kind === "rock") return tileArt("assets/tiles/rock.png", "rock");
        if (dec && dec.kind === "fern") return tileArt("assets/tiles/flowers.png", "fern");
        if (dec && dec.kind === "tree") {
          return tileArt(hashXY(x, y) % 3 === 0 ? "assets/city/tree_sm.png" : "assets/city/tree.png", "tree");
        }
        return "";
      }
      if (flowerAt(x, y)) return tileArt("assets/tiles/flowers.png", "flower");
      return "";
    }
    return "";
  }

  function buildTilesHtml() {
    const z = zone();
    const cam = MAP.camera();
    const vw = MAP.VIEW_W;
    const vh = MAP.VIEW_H;
    const tiles = [];
    for (let sy = 0; sy < vh; sy++) {
      for (let sx = 0; sx < vw; sx++) {
        const x = cam.x + sx;
        const y = cam.y + sy;
        const inMap = x >= 0 && y >= 0 && x < z.grid.cols && y < z.grid.rows;
        const walk = inMap && MAP.isWalkable(x, y);
        tiles.push(
          '<div class="' +
            tileClass(x, y, walk, inMap) +
            '" data-mx="' +
            x +
            '" data-my="' +
            y +
            (inMap && walk && zoneId !== "city" && flowerAt(x, y) ? '" data-flower="1' : "") +
            '">' +
            (inMap ? tileInner(x, y, walk) : "") +
            "</div>"
        );
      }
    }
    lastCam = { x: cam.x, y: cam.y };
    return tiles.join("");
  }

  function updateTilesInPlace() {
    const z = zone();
    const cam = MAP.camera();
    const vw = MAP.VIEW_W;
    const vh = MAP.VIEW_H;
    const tiles = hostEl.querySelectorAll(".map-tile");
    if (tiles.length !== vw * vh) return false;
    if (cam.x === lastCam.x && cam.y === lastCam.y) {
      paintPlayer();
      return true;
    }
    lastCam = { x: cam.x, y: cam.y };
    applyGroundCss();
    paintCityOverlay();
    paintFieldOverlay();
    let i = 0;
    for (let sy = 0; sy < vh; sy++) {
      for (let sx = 0; sx < vw; sx++) {
        const x = cam.x + sx;
        const y = cam.y + sy;
        const el = tiles[i++];
        const inMap = x >= 0 && y >= 0 && x < z.grid.cols && y < z.grid.rows;
        const walk = inMap && MAP.isWalkable(x, y);
        el.className = tileClass(x, y, walk, inMap);
        el.setAttribute("data-mx", String(x));
        el.setAttribute("data-my", String(y));
        if (inMap && walk && zoneId !== "city" && flowerAt(x, y)) el.setAttribute("data-flower", "1");
        else el.removeAttribute("data-flower");
        el.innerHTML = inMap ? tileInner(x, y, walk) : "";
      }
    }
    paintPlayer();
    return true;
  }

  MAP.renderVisible = function () {
    if (!hostEl) return;
    const grid = hostEl.querySelector(".map-grid");
    if (grid && updateTilesInPlace()) return;
    MAP.render(hostEl, saveRef);
  };

  MAP.render = function (el, save) {
    saveRef = save;
    if (save && save.mapId && ZONES[save.mapId]) zoneId = save.mapId;
    const z = zone();
    const p = pos();
    const vw = MAP.VIEW_W;
    const vh = MAP.VIEW_H;
    const cam = MAP.camera();
    const sp = { x: p.x - cam.x, y: p.y - cam.y };
    lastCam = { x: -999, y: -999 };
    const hid = save.heroId || "warrior";
    el.innerHTML =
      '<div class="map-grid ' +
      z.theme +
      '" style="--cols:' +
      vw +
      ";--rows:" +
      vh +
      ";--view:" +
      vw +
      ";--map-yaw:" +
      (MAP.yaw || 0) +
      "deg;--yaw-ox:50%;--yaw-oy:50%;--cam-x:" +
      cam.x +
      ";--cam-y:" +
      cam.y +
      ";--zone-w:" +
      z.grid.cols +
      ";--zone-h:" +
      z.grid.rows +
      '">' +
      '<div class="map-ground"></div>' +
      buildTilesHtml() +
      '<div class="map-avatar" style="left:' +
      (sp.x * 100) / vw +
      "%;top:" +
      (sp.y * 100) / vh +
      '%">' +
      '<img class="map-sprite hero" src="' +
      spriteSrc(hid) +
      '" alt="">' +
      "</div></div>" +
      '<div class="map-compass" aria-hidden="true"><span class="map-compass-n">N</span></div>';
    applyGroundCss();
    bakeGround(zoneId);
    paintPlayer();
    paintCityOverlay();
    paintFieldOverlay();
    applyYawCss();
    const av = el.querySelector(".map-avatar");
    if (av && root.FX && FX.applyFacing) FX.applyFacing(av, (saveRef && saveRef.facing) || "s");
  };

  MAP.mount = function (el, save) {
    MAP.teardown();
    if (!el || !save) return;
    hostEl = el;
    saveRef = save;
    if (save.mapId && ZONES[save.mapId]) zoneId = save.mapId;
    else zoneId = "bosses";
    if (zoneId === "field") ensureFieldMobs();
    const key = posKey();
    const z = zone();
    if (zoneId === "field" && save.fieldPos && save.fieldPos.x === 2 && save.fieldPos.y === 7) {
      save.fieldPos = { x: z.spawn.x, y: z.spawn.y };
    }
    if (zoneId === "bosses" && save.mapPos && save.mapPos.x === 2 && save.mapPos.y === 3) {
      save.mapPos = { x: z.spawn.x, y: z.spawn.y };
    }
    if (zoneId === "city" && save.cityPos) {
      const ox = save.cityPos.x;
      const oy = save.cityPos.y;
      if (ox === 7 && oy === 8) save.cityPos = { x: z.spawn.x, y: z.spawn.y };
      else if (ox === 13 && oy === 8 && z.gateSpawn) save.cityPos = { x: z.gateSpawn.x, y: z.gateSpawn.y };
      else if (ox === 11 && oy === 6 && z.castleSpawn) save.cityPos = { x: z.castleSpawn.x, y: z.castleSpawn.y };
    }
    if (!save[key]) save[key] = { x: z.spawn.x, y: z.spawn.y };
    MAP.resetYaw();
    MAP.render(el, save);
    keysHeld = {};
    keyHandler = onKey;
    keyUpHandler = onKeyUp;
    document.addEventListener("keydown", keyHandler);
    document.addEventListener("keyup", keyUpHandler);
    el.addEventListener("click", onClick);
    bindYaw();
    bindPad();
    if ((zoneId === "field" || zoneId === "bosses") && root.WORLD && WORLD.mount) {
      WORLD.mount(el, save);
    } else if (save.autoFarm && zoneId === "field") {
      startAutoLoop();
    }
  };

  MAP.teardown = function () {
    if (root.WORLD && WORLD.teardown) WORLD.teardown();
    stopWalk();
    stopAuto();
    stopPad();
    unbindPad();
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler);
      keyHandler = null;
    }
    if (keyUpHandler) {
      document.removeEventListener("keyup", keyUpHandler);
      keyUpHandler = null;
    }
    keysHeld = {};
    if (hostEl) hostEl.removeEventListener("click", onClick);
    unbindYaw();
    MAP.yaw = 0;
    hostEl = null;
    saveRef = null;
    lastCam = { x: -999, y: -999 };
  };

  MAP.resumeAutoIfNeeded = function (save) {
    saveRef = save;
    if (root.WORLD && WORLD.live && WORLD.live()) {
      if (WORLD.syncLiveHero) WORLD.syncLiveHero(save);
      if (WORLD.kickAutoFarm) WORLD.kickAutoFarm();
      return;
    }
    if (save && save.autoFarm && zoneId === "field" && hostEl) startAutoLoop();
  };

  MAP.isSitting = function () {
    if (root.WORLD && WORLD.playerEntity) {
      var pe = WORLD.playerEntity();
      if (pe) return !!pe.sitting;
    }
    return !!MAP.sitting || !!(saveRef && saveRef.sitting);
  };
  MAP.setSitting = function (on) {
    on = !!on;
    MAP.sitting = on;
    if (saveRef) saveRef.sitting = on;
    if (root.WORLD && WORLD.setSitting && WORLD.playerEntity && WORLD.playerEntity()) WORLD.setSitting(on);
    paintPlayer();
    return on;
  };
  MAP.toggleSit = function () { return MAP.setSitting(!MAP.isSitting()); };

  MAP.tryStep = tryStep;

  root.MAP = MAP;
})(typeof globalThis !== "undefined" ? globalThis : window);
