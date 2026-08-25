/**
 * Multi-map walker: Prontera 80×80 walled city, 100×100 starter field, 100×100 7-boss world.
 * Camera is a 33×23 landscape window, player-centered, full screen.
 * Field/boss combat is real-time on the map (WORLD).
 */
(function (root) {
  const DATA = root.DATA;
  const MAP = {};

  MAP.VIEW_W = 33;
  MAP.VIEW_H = 23;
  MAP.VIEW = 23;
  MAP.WORLD = 100;
  MAP.PATH_NODE_CAP = 2400;
  MAP.PAD_STEP_MS = 140;
  MAP.COLS = 33;
  MAP.ROWS = 23;
  MAP.CITY = 80;

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
    const spawn = { x: 5, y: n - 6 };
    const gate = { x: 2, y: n - 4 };

    function inDisk(x, y, cx, cy, r) {
      return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
    }
    function reserved(x, y) {
      return inDisk(x, y, spawn.x, spawn.y, 5) || inDisk(x, y, gate.x, gate.y, 5);
    }

    const groveWant = 14 + Math.floor(rng() * 9);
    const groves = [];
    let groveTries = 0;
    while (groves.length < groveWant && groveTries < 800) {
      groveTries += 1;
      const r = 3 + Math.floor(rng() * 4);
      const x = 4 + Math.floor(rng() * (n - 8));
      const y = 4 + Math.floor(rng() * (n - 8));
      if (reserved(x, y)) continue;
      let ok = true;
      for (let i = 0; i < groves.length; i++) {
        const o = groves[i];
        const gap = r + o.r + 2;
        if (Math.abs(o.x - x) + Math.abs(o.y - y) < gap) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      groves.push({ x: x, y: y, r: r });
    }
    groves.forEach(function (gv) {
      for (let y = gv.y - gv.r; y <= gv.y + gv.r; y++) {
        for (let x = gv.x - gv.r; x <= gv.x + gv.r; x++) {
          if (y <= 0 || x <= 0 || y >= n - 1 || x >= n - 1) continue;
          if (reserved(x, y)) continue;
          const dx = x - gv.x;
          const dy = y - gv.y;
          if (dx * dx + dy * dy > gv.r * gv.r) continue;
          if (rng() < 0.16) continue;
          g.walkable[y][x] = false;
          const roll = rng();
          g.decor.push({ x: x, y: y, kind: roll < 0.72 ? "tree" : roll < 0.9 ? "fern" : "rock" });
        }
      }
    });
    g.groveCount = groves.length;

    function markTrail(x, y) {
      if (x <= 0 || y <= 0 || x >= n - 1 || y >= n - 1) return;
      g.walkable[y][x] = true;
      g.trails[x + "," + y] = true;
    }
    function carveTrail(x0, y0, x1, y1) {
      let x = x0;
      let y = y0;
      const steps = Math.abs(x1 - x0) + Math.abs(y1 - y0) + 4;
      for (let i = 0; i < steps; i++) {
        markTrail(x, y);
        if (x + 1 < n - 1) markTrail(x + 1, y);
        if (y + 1 < n - 1) markTrail(x, y + 1);
        if (x === x1 && y === y1) break;
        if (x !== x1) x += x < x1 ? 1 : -1;
        else y += y < y1 ? 1 : -1;
      }
    }
    function clampPt(x, y) {
      return {
        x: Math.max(2, Math.min(n - 3, x | 0)),
        y: Math.max(2, Math.min(n - 3, y | 0)),
      };
    }
    function winding(x0, y0, x1, y1, bends) {
      const pts = [{ x: x0, y: y0 }];
      for (let i = 1; i <= bends; i++) {
        const t = i / (bends + 1);
        const jx = Math.floor((rng() - 0.5) * 24);
        const jy = Math.floor((rng() - 0.5) * 24);
        pts.push(clampPt(x0 + (x1 - x0) * t + jx, y0 + (y1 - y0) * t + jy));
      }
      pts.push({ x: x1, y: y1 });
      for (let i = 0; i < pts.length - 1; i++) {
        carveTrail(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      }
    }

    clearDisk(g, spawn.x, spawn.y, 5);
    clearDisk(g, gate.x, gate.y, 5);
    // 5-wide x 4-deep X pad around origin (2, n-4); every X tile warps to city.
    for (let y = gate.y - 2; y <= gate.y + 2; y++) {
      for (let x = gate.x - 1; x <= gate.x + 2; x++) {
        if (y <= 0 || x <= 0 || y >= n - 1 || x >= n - 1) continue;
        g.walkable[y][x] = true;
        g.cells[x + "," + y] = "X";
      }
    }
    winding(spawn.x, spawn.y, n - 12, 14, 3);
    winding(gate.x, gate.y, 78, 72, 2);
    g.decor = g.decor.filter(function (d) {
      return !g.walkable[d.y][d.x];
    });

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
          g.decor.push({ x: x, y: y, kind: "tree" });
        }
      }
    }
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
    const mobs = [];
    let tries = 0;
    while (mobs.length < 48 && tries < 8000) {
      tries += 1;
      const x = 2 + Math.floor(rng() * (n - 4));
      const y = 2 + Math.floor(rng() * (n - 4));
      if (!g.walkable[y][x]) continue;
      const dist = Math.abs(x - spawn.x) + Math.abs(y - spawn.y);
      if (dist < 8) continue;
      if (Math.abs(x - gate.x) + Math.abs(y - gate.y) < 6) continue;
      let far = true;
      for (let i = 0; i < mobs.length; i++) {
        if (Math.abs(mobs[i].x - x) + Math.abs(mobs[i].y - y) < 6) {
          far = false;
          break;
        }
      }
      if (!far) continue;
      const mid = pickBand(dist, mobs.length);
      mobs.push({ uid: "m" + x + "," + y, monsterId: mid, x: x, y: y });
    }
    function manh(ax, ay, bx, by) {
      return Math.abs(ax - bx) + Math.abs(ay - by);
    }
    function occupied(x, y, sep) {
      if (manh(x, y, spawn.x, spawn.y) < 8) return true;
      if (manh(x, y, gate.x, gate.y) < 6) return true;
      for (let i = 0; i < mobs.length; i++) {
        if (manh(mobs[i].x, mobs[i].y, x, y) < sep) return true;
      }
      return false;
    }
    function findBandTile(lo, hi) {
      for (let t = 0; t < 4000; t++) {
        const x = 2 + Math.floor(rng() * (n - 4));
        const y = 2 + Math.floor(rng() * (n - 4));
        const dist = manh(x, y, spawn.x, spawn.y);
        if (dist < lo || dist > hi) continue;
        if (!g.walkable[y] || !g.walkable[y][x]) continue;
        if (occupied(x, y, 6)) continue;
        return { x: x, y: y };
      }
      for (let sep = 5; sep >= 2; sep--) {
        for (let y = 2; y < n - 2; y++) {
          for (let x = 2; x < n - 2; x++) {
            const dist = manh(x, y, spawn.x, spawn.y);
            if (dist < lo || dist > hi) continue;
            if (!g.walkable[y] || !g.walkable[y][x]) continue;
            if (occupied(x, y, sep)) continue;
            return { x: x, y: y };
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

    // 2. Ring road 2 tiles just inside the walls.
    vStreet(wallT, wallT, n - 1 - wallT, ringT);
    vStreet(n - wallT - ringT, wallT, n - 1 - wallT, ringT);
    hStreet(wallT, n - 1 - wallT, wallT, ringT);
    hStreet(wallT, n - 1 - wallT, n - wallT - ringT, ringT);

    // 3. Main 3-wide cross, full span inside the walls.
    vStreet(cx - 1, wallT, n - 1 - wallT, 3);
    hStreet(wallT, n - 1 - wallT, cy - 1, 3);

    // 4. Central plaza cobble.
    fill(30, 30, 50, 50, "~", true);

    // 5. Fountain: 3x3 blocked core, walkable 5x5 rim (do not block the rim).
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) put(cx + dx, cy + dy, "F", false);
        else put(cx + dx, cy + dy, "f", true);
      }
    }

    // 6. Lamps + flowers only on remaining plaza cobble.
    [
      [30, 30],
      [cx, 30],
      [50, 30],
      [30, cy],
      [50, cy],
      [30, 50],
      [cx, 50],
      [50, 50],
    ].forEach(function (s) {
      if (kind[s[1]] && kind[s[1]][s[0]] === "~") put(s[0], s[1], "L", true);
    });
    [
      [32, 31],
      [48, 31],
      [32, 49],
      [48, 49],
      [31, 36],
      [49, 36],
      [31, 44],
      [49, 44],
    ].forEach(function (s) {
      if (kind[s[1]] && kind[s[1]][s[0]] === "~") put(s[0], s[1], "B", true);
    });

    // 7. Castle NORTH (separate from church). Keep D, 3x3 K door, north avenue open.
    fill(34, 4, 46, 16, "D", false);
    fill(34, 4, 35, 5, "D", false);
    fill(45, 4, 46, 5, "D", false);
    fill(34, 15, 35, 16, "D", false);
    fill(45, 15, 46, 16, "D", false);
    fill(39, 14, 41, 16, "K", true);
    vStreet(39, 17, 29, 3);

    // 8. Church NE, own landmark. Body C, terracotta roof N, south courtyard.
    fill(52, 8, 62, 20, "C", false);
    for (let y = 8; y <= 12; y++) {
      const inset = 12 - y;
      fill(52 + inset, y, 62 - inset, y, "N", false);
    }
    fill(53, 21, 61, 24, "~", true);

    // 9. West market: W on the 3-wide street, 2 shop buildings (not a packed quarter).
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

    // 11. Kafra on the south plaza edge.
    const kafra = { x: 38, y: 49 };
    put(kafra.x, kafra.y, "S", true);

    // 12. East field gatehouse — only functional exit. 5 wide x 4 deep, every tile G.
    fill(n - 4, cy - 2, n - 1, cy + 2, "G", true);
    fill(n - 4, cy - 4, n - 1, cy - 3, "#", false);
    fill(n - 4, cy + 3, n - 1, cy + 4, "#", false);

    // 13. Four 8x8 parks: grass A + a few trees T.
    function stampPark(x0, y0, x1, y1) {
      fill(x0, y0, x1, y1, "A", true);
      const spots = [
        [x0 + 1, y0 + 1],
        [x1 - 1, y0 + 1],
        [x0 + 1, y1 - 1],
        [x1 - 1, y1 - 1],
        [Math.floor((x0 + x1) / 2), Math.floor((y0 + y1) / 2)],
      ];
      spots.forEach(function (s) {
        if (s[0] > x0 && s[0] < x1 && s[1] > y0 && s[1] < y1) put(s[0], s[1], "T", false);
      });
    }
    stampPark(6, 6, 13, 13);
    stampPark(66, 8, 73, 15);
    stampPark(8, 64, 15, 71);
    stampPark(64, 64, 71, 71);

    // 14. Airy house lots in SW / SE only. Each lot = 3-wide roof + 3-wide wall + yard.
    //     Spaced with grass courtyards. Do not carpet vacant tiles with roofs.
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
    swLotPts.forEach(function (p) { if (stampLot(p[0], p[1])) swLotN += 1; });
    seLotPts.forEach(function (p) { if (stampLot(p[0], p[1])) seLotN += 1; });

    // 15. Leftover vacant tiles become walkable grass courtyards, not roofs.
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (kind[y][x] === "?") put(x, y, "A", true);
      }
    }

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

    // 16. Spawn at (40,51) not (40,54): 23x23 camera is player-centered
    //     (origin px-11), so y=51 is the southernmost point where the
    //     fountain at y=40 stays on-screen (cam.y=40). Carve if blocked.
    const spawn = { x: cx, y: 51 };
    if (!walkable[spawn.y] || !walkable[spawn.y][spawn.x]) {
      walkable[spawn.y][spawn.x] = true;
      if (cells[spawn.x + "," + spawn.y] && "FTH#RrhCDN".indexOf(cells[spawn.x + "," + spawn.y]) >= 0) {
        delete cells[spawn.x + "," + spawn.y];
      }
    }
    const gateSpawn = { x: 74, y: cy };
    if (!walkable[gateSpawn.y] || !walkable[gateSpawn.y][gateSpawn.x]) {
      gateSpawn.x = 75;
      walkable[gateSpawn.y][gateSpawn.x] = true;
    }
    const castleSpawn = { x: cx, y: 18 };
    if (!walkable[castleSpawn.y] || !walkable[castleSpawn.y][castleSpawn.x]) {
      walkable[castleSpawn.y][castleSpawn.x] = true;
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
      npcs: { W: wShop, P: pShop, S: kafra, K: { x: cx, y: 16 }, G: { x: n - wallT, y: cy } },
    };
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
    return zoneId;
  };

  MAP.getPos = function () {
    return pos();
  };

  MAP.isWalking = function () {
    return walking;
  };

  MAP.stopWalking = function () {
    stopWalk();
  };

  MAP.listFieldSpawns = function () {
    return ensureFieldMobs().map(function (m) {
      return { uid: m.uid, monsterId: m.monsterId, x: m.x, y: m.y };
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

  MAP.walkToAdjacent = function (from, target) {
    if (!from || !target) return;
    if (Math.abs(from.x - target.x) + Math.abs(from.y - target.y) <= 1) return;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let best = null;
    let bestLen = 1e9;
    dirs.forEach(function (d) {
      const x = target.x + d[0];
      const y = target.y + d[1];
      if (!MAP.isWalkable(x, y)) return;
      if (from.x === x && from.y === y) {
        best = [];
        bestLen = 0;
        return;
      }
      const trail = MAP.path(from, { x: x, y: y });
      if (trail.length && trail.length < bestLen) {
        best = trail;
        bestLen = trail.length;
      }
    });
    if (best && best.length) walkPath(best);
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

  MAP.neighbors = function (x, y) {
    const out = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    dirs.forEach(function (d) {
      const nx = x + d[0];
      const ny = y + d[1];
      if (!MAP.isWalkable(nx, ny)) return;
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
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let best = null;
      let bestD = Math.abs(x - to.x) + Math.abs(y - to.y);
      dirs.forEach(function (d) {
        const nx = x + d[0];
        const ny = y + d[1];
        if (!MAP.isWalkable(nx, ny)) return;
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
      return Math.abs(p.x - to.x) + Math.abs(p.y - to.y);
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
      if (m.x === x && m.y === y) m.deadUntil = Date.now() + (DATA.FIELD_RESPAWN_MS || 4000);
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
    let bestD = 1e9;
    mobs.forEach(function (m) {
      const d = Math.abs(from.x - m.x) + Math.abs(from.y - m.y);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    });
    return best;
  }

  function tickAutoFarm() {
    if (root.WORLD && WORLD.live && WORLD.live()) return;
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
    const steps = MAP.path(p, { x: mob.x, y: mob.y });
    if (steps.length) walkPath(steps);
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

  function onKey(ev) {
    if (!hostEl || !saveRef) return;
    const tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const k = ev.key;
    let dx = 0;
    let dy = 0;
    if (k === "ArrowLeft" || k === "a" || k === "A") dx = -1;
    else if (k === "ArrowRight" || k === "d" || k === "D") dx = 1;
    else if (k === "ArrowUp" || k === "w" || k === "W") dy = -1;
    else if (k === "ArrowDown" || k === "s" || k === "S") dy = 1;
    else return;
    ev.preventDefault();
    if (saveRef.autoFarm && zoneId === "field") return;
    stopWalk();
    tryStep(dx, dy);
  }

  function onClick(ev) {
    const tile = ev.target.closest && ev.target.closest("[data-mx]");
    if (!tile) return;
    const x = Number(tile.getAttribute("data-mx"));
    const y = Number(tile.getAttribute("data-my"));
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
    walkPath(MAP.path(p, { x: x, y: y }));
  }

  function startPad(dx, dy) {
    stopWalk();
    padDir = { x: dx, y: dy };
    tryStep(dx, dy);
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
    const unit = { heroId: heroId, facing: (saveRef && saveRef.facing) || MAP.facing || "s", walkFrame: saveRef && saveRef.walkFrame };
    if (root.FX && FX.spriteSrc) return FX.spriteSrc(heroId, unit);
    return "assets/chars/" + (heroId || "warrior") + "_s.png";
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
      const hid = (saveRef && saveRef.heroId) || "warrior";
      const face = (saveRef && saveRef.facing) || MAP.facing || "s";
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
      else if (ch === "W") cls += " npc shop shop-weapon";
      else if (ch === "P") cls += " npc shop shop-potion";
      else if (ch === "S") cls += " npc shop shop-kafra";
      else if (ch === "K") cls += " npc keep-gate";
      else if (ch === "G") cls += " gate";
      else if (walk) cls += " street";
      if (walk && flowerAt(x, y) && "WPSKGF".indexOf(ch) < 0) cls += " flower";
    }
    if (zoneId === "field") {
      if (fieldGrid.cells[x + "," + y] === "X") cls += " gate";
      if (walk && fieldGrid.trails && fieldGrid.trails[x + "," + y]) cls += " trail";
      if (walk && flowerAt(x, y)) cls += " flower";
    }
    if (zoneId === "bosses" && MAP.bossAt(x, y)) {
      const b = MAP.bossAt(x, y);
      cls += " boss" + (saveRef && saveRef.clearedBosses && saveRef.clearedBosses[b.id] ? " cleared" : "");
    }
    return cls;
  }

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
      if (ch === "W") return '<span class="map-boss-lab">อาวุธ</span>';
      if (ch === "P") return '<span class="map-boss-lab">ยา</span>';
      if (ch === "S") return '<span class="map-boss-lab">คาฟร้า</span>';
      if (ch === "K") return x === 40 && y === 16 ? '<span class="map-boss-lab">ปราสาทโลหิต</span>' : "";
      if (ch === "G") return x === 78 && y === 40 ? '<span class="map-boss-lab">ป่าสงบ</span>' : "";
      if (ch === "T" || ch === "#") return tileArt("assets/tiles/tree.png", "tree");
      if (ch === "B" || (walk && flowerAt(x, y))) return tileArt("assets/tiles/flowers.png", "flower");
      return "";
    }
    if (zoneId === "field") {
      const ch = fieldGrid.cells[x + "," + y] || "";
      if (ch === "X") {
        if (fieldGrid.gate && x === fieldGrid.gate.x && y === fieldGrid.gate.y) {
          return '<span class="map-boss-emo">🚪</span><span class="map-boss-lab">กลับหมู่บ้าน</span>';
        }
        return "";
      }
      if (!walk) {
        const dec = (fieldGrid.decor || []).find(function (d) {
          return d.x === x && d.y === y;
        });
        if (dec && dec.kind === "rock") return tileArt("assets/tiles/rock.png", "rock");
        if (dec && dec.kind === "fern") return tileArt("assets/tiles/flowers.png", "fern");
        return tileArt("assets/tiles/tree.png", "tree");
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
            (inMap && walk && flowerAt(x, y) ? '" data-flower="1' : "") +
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
        if (inMap && walk && flowerAt(x, y)) el.setAttribute("data-flower", "1");
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
      '">' +
      buildTilesHtml() +
      '<div class="map-avatar" style="left:' +
      (sp.x * 100) / vw +
      "%;top:" +
      (sp.y * 100) / vh +
      '%">' +
      '<img class="map-sprite hero" src="' +
      spriteSrc(hid) +
      '" alt="">' +
      "</div></div>";
    paintPlayer();
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
    MAP.render(el, save);
    keyHandler = onKey;
    document.addEventListener("keydown", keyHandler);
    el.addEventListener("click", onClick);
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
    if (hostEl) hostEl.removeEventListener("click", onClick);
    hostEl = null;
    saveRef = null;
    lastCam = { x: -999, y: -999 };
  };

  MAP.resumeAutoIfNeeded = function (save) {
    saveRef = save;
    if (root.WORLD && WORLD.live && WORLD.live()) return;
    if (save && save.autoFarm && zoneId === "field" && hostEl) startAutoLoop();
  };

  root.MAP = MAP;
})(typeof globalThis !== "undefined" ? globalThis : window);
