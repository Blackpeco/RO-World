
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
MAP.setZone("city");
const cg = MAP.ZONES.city.grid;
const spawn = MAP.ZONES.city.spawn;

function findCell(ch) {
  const keys = Object.keys(cg.cells);
  for (let i = 0; i < keys.length; i++) {
    if (cg.cells[keys[i]] === ch) {
      const p = keys[i].split(",");
      return { x: Number(p[0]), y: Number(p[1]) };
    }
  }
  return null;
}

let fountainN = 0;
let houseN = 0;
let carpet = 0;
Object.keys(cg.cells).forEach(function (k) {
  const ch = cg.cells[k];
  const p = k.split(",");
  const x = Number(p[0]);
  const y = Number(p[1]);
  if (ch === "F" || ch === "f") fountainN += 1;
  if (ch === "H" || ch === "h" || ch === "R" || ch === "r") houseN += 1;
  if ((ch === "H" || ch === "h" || ch === "R" || ch === "r") && y < 30 && x < 30) carpet += 1;
});

let churchC = 0;
let churchN = 0;
for (let y = 8; y <= 20; y++) {
  for (let x = 52; x <= 62; x++) {
    const ch = cg.cells[x + "," + y];
    if (ch === "C") churchC += 1;
    if (ch === "N") churchN += 1;
  }
}
let keepD = 0;
for (let y = 4; y <= 16; y++) {
  for (let x = 34; x <= 46; x++) {
    if (cg.cells[x + "," + y] === "D") keepD += 1;
  }
}

console.log("spawn", spawn.x + "," + spawn.y, "walkable", MAP.isWalkable(spawn.x, spawn.y));
console.log("gateSpawn", cg.gateSpawn.x + "," + cg.gateSpawn.y, "walkable", MAP.isWalkable(cg.gateSpawn.x, cg.gateSpawn.y));
console.log("castleSpawn", cg.castleSpawn.x + "," + cg.castleSpawn.y, "walkable", MAP.isWalkable(cg.castleSpawn.x, cg.castleSpawn.y));
console.log("fountain", cg.fountain.x + "," + cg.fountain.y, "tiles", fountainN);
console.log("houses", houseN);
console.log("church bbox C/N", churchC, churchN, "ok", churchC > 0 && churchN > 0);
console.log("castle bbox D", keepD, "ok", keepD > 0);
console.log("NW roof-carpet x<30 y<30", carpet);
["W", "P", "S", "K", "G"].forEach(function (id) {
  const at = findCell(id);
  const walk = !!(at && MAP.isWalkable(at.x, at.y));
  const plen = at ? MAP.path(spawn, at).length : -1;
  console.log("NPC", id, at.x + "," + at.y, "walkable", walk, "pathLen", plen);
});
