import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const ctx = { console, Math, Date, Object, Array, Number, String, Boolean, Error };
vm.createContext(ctx);
for (const f of ["data.js", "stats.js", "combat.js", "pve.js", "map.js"]) {
  vm.runInContext(readFileSync(join(root, "js", f), "utf8"), ctx, { filename: f });
}

const { MAP } = ctx;
MAP.setZone("field");
const g = MAP.ZONES.field.grid;
const spawn = g.spawn;
const n = g.cols;

function inEllipse(x, y, cx, cy, rx, ry) {
  const nx = (x - cx) / (rx || 1);
  const ny = (y - cy) / (ry || 1);
  return nx * nx + ny * ny <= 1.08;
}

const trails = [];
for (let y = 1; y < n - 1; y++) {
  for (let x = 1; x < n - 1; x++) {
    if (g.trails && g.trails[x + "," + y]) trails.push({ x, y });
  }
}

function widthAt(x, y) {
  let wx = 1;
  for (let dx = 1; g.trails[(x + dx) + "," + y]; dx++) wx++;
  for (let dx = 1; g.trails[(x - dx) + "," + y]; dx++) wx++;
  let wy = 1;
  for (let dy = 1; g.trails[x + "," + (y + dy)]; dy++) wy++;
  for (let dy = 1; g.trails[x + "," + (y - dy)]; dy++) wy++;
  return { wx, wy, min: Math.min(wx, wy), max: Math.max(wx, wy) };
}

const samples = [];
const step = Math.max(1, Math.floor(trails.length / 12));
for (let i = 0; i < trails.length; i += step) {
  const t = trails[i];
  const w = widthAt(t.x, t.y);
  samples.push({ x: t.x, y: t.y, wx: w.wx, wy: w.wy, thin: w.min });
}

let w2 = 0;
let w3 = 0;
let w4p = 0;
trails.forEach((t) => {
  const w = widthAt(t.x, t.y);
  if (w.min <= 2) w2++;
  else if (w.min === 3) w3++;
  else w4p++;
});

console.log("field", n + "x" + n, "spawn", spawn.x + "," + spawn.y, "gate", g.gate.x + "," + g.gate.y);
console.log("walkable spawn/gate", MAP.isWalkable(spawn.x, spawn.y), MAP.isWalkable(g.gate.x, g.gate.y));
console.log("trail tiles", trails.length, "thin<=2", w2, "min=3", w3, "min>=4", w4p);

console.log("width samples (every ~" + step + " trail tiles):");
samples.forEach((s) => {
  console.log("  " + s.x + "," + s.y + "  x-run=" + s.wx + " y-run=" + s.wy + " thin=" + s.thin);
});

const pockets = g.pockets || {};
const list = Array.isArray(pockets) ? pockets : Object.keys(pockets).map((id) => ({ id, ...pockets[id] }));
console.log("pockets:");
list.forEach((pk) => {
  const cx = pk.cx != null ? pk.cx : pk.x;
  const cy = pk.cy != null ? pk.cy : pk.y;
  let walk = 0;
  let hunt = 0;
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      if (!inEllipse(x, y, cx, cy, pk.rx, pk.ry)) continue;
      if (!g.walkable[y][x]) continue;
      walk++;
      if (!g.trails[x + "," + y]) hunt++;
    }
  }
  const manh = Math.abs(cx - spawn.x) + Math.abs(cy - spawn.y);
  console.log("  " + (pk.id || pk.name) + " @(" + cx + "," + cy + ") rx" + pk.rx + " ry" + pk.ry + " open" + pk.open + " manh=" + manh + " walk=" + walk + " hunt=" + hunt);
});

const mobs = MAP.listFieldSpawns();
const ids = {};
mobs.forEach((m) => { ids[m.monsterId] = (ids[m.monsterId] || 0) + 1; });
console.log("mobs", mobs.length, "kinds", Object.keys(ids).length, Object.keys(ids).sort().join(","));

let xN = 0;
Object.keys(g.cells).forEach((k) => { if (g.cells[k] === "X") xN++; });
console.log("X pad tiles", xN);
