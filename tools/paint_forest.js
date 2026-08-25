"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "..");
const MOBS = path.join(ROOT, "assets", "mobs");
const TILES = path.join(ROOT, "assets", "tiles");
fs.mkdirSync(MOBS, { recursive: true });
fs.mkdirSync(TILES, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, t, data, crc]);
}

function savePNG(file, w, h, pixels, rgba) {
  const bpp = rgba ? 4 : 3;
  const raw = Buffer.alloc((w * bpp + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * bpp + 1);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * w * bpp, (y + 1) * w * bpp);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = rgba ? 6 : 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const out = Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, out);
  console.log("wrote", file, w + "x" + h, out.length);
}

function h01(x, y, s) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) >>> 0;
  n ^= n >>> 13;
  n = Math.imul(n, 1274126177) >>> 0;
  return (n & 0xffffff) / 16777215;
}
function fade(t) { return t * t * (3 - 2 * t); }
function vnoise(x, y, scale, seed) {
  const xf = x / scale, yf = y / scale;
  const x0 = Math.floor(xf), y0 = Math.floor(yf);
  const tx = fade(xf - x0), ty = fade(yf - y0);
  const n00 = h01(x0, y0, seed), n10 = h01(x0 + 1, y0, seed);
  const n01 = h01(x0, y0 + 1, seed), n11 = h01(x0 + 1, y0 + 1, seed);
  return (n00 * (1 - tx) + n10 * tx) * (1 - ty) + (n01 * (1 - tx) + n11 * tx) * ty;
}
function fbm(x, y, seed, oct, base) {
  let v = 0, a = 1, s = 0, sc = base;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise(x, y, sc, seed + i * 17);
    s += a; a *= 0.5; sc *= 0.5;
  }
  return v / s;
}
function clamp(n) { return n < 0 ? 0 : n > 255 ? 255 : n | 0; }
function mix(a, b, t) {
  return [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t)];
}

function rgbCanvas(w, h) { return { w, h, rgba: false, px: Buffer.alloc(w * h * 3) }; }
function rgbaCanvas(w, h) { return { w, h, rgba: true, px: Buffer.alloc(w * h * 4) }; }
function setRGB(c, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 3;
  c.px[i] = clamp(r); c.px[i + 1] = clamp(g); c.px[i + 2] = clamp(b);
}
function setRGBA(c, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  const na = clamp(a), oa = c.px[i + 3];
  if (na >= 250 || oa === 0) {
    c.px[i] = clamp(r); c.px[i + 1] = clamp(g); c.px[i + 2] = clamp(b); c.px[i + 3] = na;
    return;
  }
  const t = na / 255, it = 1 - t;
  c.px[i] = clamp(c.px[i] * it + r * t);
  c.px[i + 1] = clamp(c.px[i + 1] * it + g * t);
  c.px[i + 2] = clamp(c.px[i + 2] * it + b * t);
  c.px[i + 3] = clamp(oa + na * (1 - oa / 255));
}
function ellipse(c, x0, y0, x1, y1, col, rgba) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
  if (rx < 1 || ry < 1) return;
  const minx = Math.max(0, Math.floor(cx - rx)), maxx = Math.min(c.w - 1, Math.ceil(cx + rx));
  const miny = Math.max(0, Math.floor(cy - ry)), maxy = Math.min(c.h - 1, Math.ceil(cy + ry));
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      const u = (x - cx) / rx, v = (y - cy) / ry;
      if (u * u + v * v <= 1) {
        const edge = u * u + v * v;
        const aa = edge > 0.82 ? (1 - edge) / 0.18 : 1;
        if (rgba) setRGBA(c, x, y, col[0], col[1], col[2], (col[3] != null ? col[3] : 255) * aa);
        else setRGB(c, x, y, col[0], col[1], col[2]);
      }
    }
  }
}
function rect(c, x0, y0, x1, y1, col, rgba) {
  for (let y = Math.max(0, y0 | 0); y < Math.min(c.h, y1 | 0); y++) {
    for (let x = Math.max(0, x0 | 0); x < Math.min(c.w, x1 | 0); x++) {
      if (rgba) setRGBA(c, x, y, col[0], col[1], col[2], col[3] != null ? col[3] : 255);
      else setRGB(c, x, y, col[0], col[1], col[2]);
    }
  }
}
function poly(c, pts, col, rgba) {
  let minx = c.w, miny = c.h, maxx = 0, maxy = 0;
  for (const p of pts) {
    minx = Math.min(minx, p[0]); miny = Math.min(miny, p[1]);
    maxx = Math.max(maxx, p[0]); maxy = Math.max(maxy, p[1]);
  }
  minx = Math.max(0, minx | 0); miny = Math.max(0, miny | 0);
  maxx = Math.min(c.w - 1, maxx | 0); maxy = Math.min(c.h - 1, maxy | 0);
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        const inter = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-6) + xi;
        if (inter) inside = !inside;
      }
      if (inside) {
        if (rgba) setRGBA(c, x, y, col[0], col[1], col[2], col[3] != null ? col[3] : 255);
        else setRGB(c, x, y, col[0], col[1], col[2]);
      }
    }
  }
}

function paintGrass() {
  const w = 512, h = 512, c = rgbCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm(x, y, 11, 5, 36);
    const sun = vnoise(x, y, 80, 19);
    const blade = vnoise(x * 0.7, y * 1.8, 6, 3);
    let col = mix([58, 96, 42], [96, 146, 62], n * 0.7 + blade * 0.3);
    col = mix(col, [176, 186, 86], sun * 0.32);
    if (h01(x, y, 41) < 0.012) col = mix(col, [214, 196, 92], 0.7);
    if (h01(x, y, 77) < 0.008) col = mix(col, [186, 120, 168], 0.5);
    setRGB(c, x, y, col[0], col[1], col[2]);
  }
  return c;
}
function paintPath() {
  const w = 512, h = 512, c = rgbCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm(x, y, 5, 4, 28);
    let r = 128 + n * 46, g = 94 + n * 28, b = 56 + n * 16;
    if ((x * 3 + y * 5) % 23 < 2) { r -= 22; g -= 10; b -= 8; }
    if (h01(x, y, 2) < 0.045) { r = 74; g = 104; b = 52; }
    if (h01(x, y, 9) < 0.03) { r = 58; g = 46; b = 28; }
    setRGB(c, x, y, r, g, b);
  }
  return c;
}
function paintCityPath() {
  const w = 512, h = 512, c = rgbCanvas(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cx = Math.floor(x / 40), cy = Math.floor(y / 30);
    const j = ((h01(cx, cy, 9) - 0.5) * 10) | 0;
    const ox = x + j, oy = y + (((h01(cx, cy, 3) - 0.5) * 6) | 0);
    const grout = (ox % 40 < 4) || (oy % 30 < 4);
    const n = vnoise(x, y, 9, 4);
    let col = grout ? mix([68, 108, 50], [102, 138, 66], n) : mix([186, 150, 108], [142, 112, 78], n);
    if (!grout && h01(x, y, 12) < 0.04) col = mix(col, [70, 108, 52], 0.55);
    setRGB(c, x, y, col[0], col[1], col[2]);
  }
  return c;
}
function paintWide(kind) {
  const w = 1280, h = 720, c = rgbCanvas(w, h);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const sky = kind === "field" ? mix([198, 216, 176], [86, 128, 70], Math.pow(t, 0.9))
      : mix([216, 200, 164], [104, 126, 78], Math.pow(t, 0.9));
    for (let x = 0; x < w; x++) {
      const mist = vnoise(x, y, 90, kind === "field" ? 1 : 2);
      const shaft = Math.max(0, 1 - Math.abs(x / w - 0.38) * 3.2) * (1 - t) * 0.28;
      const gold = kind === "field" ? [236, 220, 164] : [240, 214, 170];
      const col = mix(sky, gold, mist * 0.22 + shaft);
      setRGB(c, x, y, col[0], col[1], col[2]);
    }
  }
  for (let i = 0; i < 9; i++) {
    const xx = 40 + i * 150;
    const hgt = 260 + (i * 47) % 180;
    ellipse(c, xx - 110, h - hgt, xx + 130, h + 50, [38 + i * 3, 68 + i * 2, 34], false);
    rect(c, xx + 4, h - 100, xx + 22, h + 10, [78, 56, 32], false);
  }
  if (kind === "city") {
    [[310, 88, 150], [540, 100, 170], [820, 92, 140]].forEach(function (p) {
      const xx = p[0], ww = p[1], hh = p[2];
      rect(c, xx, h - hh, xx + ww, h - 18, [128, 88, 52], false);
      poly(c, [[xx - 8, h - hh], [xx + ww / 2, h - hh - 56], [xx + ww + 8, h - hh]], [96, 54, 32], false);
    });
  }
  return c;
}

function paintTree() {
  const w = 512, h = 640, c = rgbaCanvas(w, h);
  const cx = w >> 1;
  rect(c, cx - 16, (h * 0.46) | 0, cx + 16, (h * 0.94) | 0, [96, 68, 38, 255], true);
  poly(c, [[cx - 18, h * 0.5], [cx - 42, h * 0.62], [cx - 10, h * 0.6]], [86, 60, 34, 255], true);
  const cy = (h * 0.58) | 0;
  const layers = [[-8, -150, 150, [48, 96, 50]], [40, -90, 120, [62, 118, 58]],
    [-50, -70, 118, [44, 90, 46]], [8, -210, 132, [72, 132, 64]],
    [-36, -20, 90, [56, 108, 52]], [52, -16, 86, [68, 122, 60]]];
  layers.forEach(function (L) {
    ellipse(c, cx + L[0] - L[2], cy + L[1] - L[2], cx + L[0] + L[2], cy + L[1] + L[2], L[3].concat([255]), true);
  });
  ellipse(c, cx - 30, cy - 220, cx + 50, cy - 120, [150, 186, 90, 70], true);
  return c;
}
function paintRock() {
  const w = 420, h = 360, c = rgbaCanvas(w, h);
  const cx = w >> 1, cy = (h * 0.55) | 0;
  ellipse(c, cx - 150, cy - 80, cx + 160, cy + 120, [132, 128, 116, 255], true);
  ellipse(c, cx - 70, cy - 50, cx + 50, cy + 40, [168, 164, 150, 255], true);
  ellipse(c, cx - 130, cy + 40, cx - 10, cy + 118, [72, 108, 54, 230], true);
  ellipse(c, cx + 10, cy + 50, cx + 140, cy + 124, [64, 100, 50, 210], true);
  return c;
}
function paintFlowers() {
  const w = 360, h = 300, c = rgbaCanvas(w, h);
  const cx = w >> 1, cy = (h * 0.62) | 0;
  ellipse(c, cx - 90, cy + 8, cx + 100, cy + 78, [62, 102, 48, 230], true);
  const cols = [[232, 210, 86], [236, 236, 246], [214, 118, 164], [176, 96, 204], [240, 170, 80]];
  const pos = [[-40, -8], [18, -36], [58, 4], [-8, 14], [36, -12], [-60, 16]];
  pos.forEach(function (p, i) {
    const col = cols[i % cols.length];
    ellipse(c, cx + p[0] - 14, cy + p[1] - 14, cx + p[0] + 14, cy + p[1] + 14, col.concat([255]), true);
    ellipse(c, cx + p[0] - 5, cy + p[1] - 5, cx + p[0] + 5, cy + p[1] + 5, [236, 214, 80, 255], true);
  });
  ellipse(c, cx - 88, cy - 50, cx - 50, cy + 10, [70, 128, 58, 255], true);
  ellipse(c, cx - 70, cy - 80, cx - 30, cy - 20, [86, 150, 70, 255], true);
  return c;
}
function paintPoring() {
  const w = 640, h = 720, c = rgbaCanvas(w, h), cx = w >> 1;
  ellipse(c, cx - 170, 560, cx + 180, 680, [68, 112, 52, 240], true);
  ellipse(c, cx - 200, 300, cx + 210, 640, [255, 132, 178, 255], true);
  ellipse(c, cx - 90, 340, cx + 40, 470, [255, 196, 216, 210], true);
  ellipse(c, cx + 90, 420, cx + 122, 452, [255, 255, 255, 160], true);
  ellipse(c, cx - 78, 430, cx - 36, 478, [48, 32, 40, 255], true);
  ellipse(c, cx + 40, 430, cx + 82, 478, [48, 32, 40, 255], true);
  ellipse(c, cx - 66, 440, cx - 50, 456, [255, 255, 255, 220], true);
  ellipse(c, cx + 52, 440, cx + 68, 456, [255, 255, 255, 220], true);
  ellipse(c, cx - 36, 510, cx + 40, 560, [190, 64, 100, 80], true);
  ellipse(c, cx - 110, 500, cx - 80, 528, [255, 150, 170, 180], true);
  ellipse(c, cx + 86, 500, cx + 116, 528, [255, 150, 170, 180], true);
  return c;
}
function paintFabre() {
  const w = 640, h = 720, c = rgbaCanvas(w, h), cx = w >> 1;
  ellipse(c, cx - 140, 600, cx + 150, 690, [70, 114, 54, 230], true);
  [380, 450, 520, 590, 650].forEach(function (yy, i) {
    const r = 78 - i * 6;
    ellipse(c, cx - r, yy - 48, cx + r, yy + 56, [86 + i * 10, 162 - i * 8, 72, 255], true);
  });
  ellipse(c, cx - 68, 300, cx + 68, 420, [118, 178, 82, 255], true);
  ellipse(c, cx - 26, 348, cx - 8, 368, [36, 44, 24, 255], true);
  ellipse(c, cx + 12, 348, cx + 30, 368, [36, 44, 24, 255], true);
  poly(c, [[cx - 30, 360], [cx - 150, 220], [cx + 8, 350]], [150, 210, 100, 170], true);
  poly(c, [[cx + 30, 360], [cx + 150, 220], [cx - 8, 350]], [150, 210, 100, 170], true);
  return c;
}
function paintLunatic() {
  const w = 640, h = 720, c = rgbaCanvas(w, h), cx = w >> 1;
  ellipse(c, cx - 150, 600, cx + 160, 690, [72, 116, 56, 230], true);
  ellipse(c, cx - 78, 150, cx - 22, 420, [240, 224, 194, 255], true);
  ellipse(c, cx + 22, 150, cx + 78, 420, [240, 224, 194, 255], true);
  ellipse(c, cx - 64, 200, cx - 34, 380, [236, 186, 186, 220], true);
  ellipse(c, cx + 36, 200, cx + 66, 380, [236, 186, 186, 220], true);
  ellipse(c, cx - 150, 400, cx + 150, 680, [244, 232, 206, 255], true);
  ellipse(c, cx - 88, 300, cx + 88, 500, [248, 236, 214, 255], true);
  ellipse(c, cx - 28, 390, cx - 8, 412, [52, 40, 30, 255], true);
  ellipse(c, cx + 12, 390, cx + 32, 412, [52, 40, 30, 255], true);
  ellipse(c, cx - 8, 424, cx + 14, 444, [226, 176, 156, 255], true);
  ellipse(c, cx - 70, 430, cx - 42, 454, [236, 180, 170, 160], true);
  ellipse(c, cx + 44, 430, cx + 72, 454, [236, 180, 170, 160], true);
  return c;
}
function paintWillow() {
  const w = 640, h = 800, c = rgbaCanvas(w, h), cx = w >> 1;
  ellipse(c, cx - 160, 680, cx + 170, 780, [64, 104, 50, 230], true);
  rect(c, cx - 46, 360, cx + 46, 720, [104, 76, 46, 255], true);
  [[-10, 0, 150, [70, 116, 54]], [50, 40, 110, [86, 136, 64]],
    [-60, 50, 108, [58, 100, 48]], [0, -80, 120, [78, 128, 60]]].forEach(function (L) {
    ellipse(c, cx + L[0] - L[2], 300 + L[1] - L[2], cx + L[0] + L[2], 300 + L[1] + L[2], L[3].concat([255]), true);
  });
  ellipse(c, cx - 48, 390, cx + 48, 500, [214, 194, 154, 255], true);
  ellipse(c, cx - 20, 424, cx - 6, 440, [48, 36, 24, 255], true);
  ellipse(c, cx + 10, 424, cx + 24, 440, [48, 36, 24, 255], true);
  ellipse(c, cx - 16, 452, cx + 18, 478, [90, 58, 34, 90], true);
  ellipse(c, cx - 40, 560, cx + 8, 600, [76, 120, 56, 200], true);
  return c;
}
function paintCondor() {
  const w = 640, h = 720, c = rgbaCanvas(w, h), cx = w >> 1;
  rect(c, 80, 560, 560, 590, [96, 70, 42, 255], true);
  ellipse(c, 70, 548, 160, 604, [68, 110, 52, 220], true);
  ellipse(c, cx - 86, 360, cx + 90, 560, [146, 112, 76, 255], true);
  ellipse(c, cx - 48, 280, cx + 48, 400, [172, 136, 94, 255], true);
  poly(c, [[cx - 8, 372], [cx + 8, 372], [cx, 414]], [226, 168, 64, 255], true);
  ellipse(c, cx - 18, 328, cx - 4, 344, [44, 32, 22, 255], true);
  ellipse(c, cx + 6, 328, cx + 20, 344, [44, 32, 22, 255], true);
  poly(c, [[cx - 80, 430], [cx - 230, 500], [cx - 60, 510]], [118, 90, 58, 255], true);
  poly(c, [[cx + 80, 430], [cx + 230, 500], [cx + 60, 510]], [118, 90, 58, 255], true);
  ellipse(c, cx - 40, 430, cx + 40, 530, [226, 210, 176, 230], true);
  return c;
}

function out(file, canvas) {
  savePNG(file, canvas.w, canvas.h, canvas.px, canvas.rgba);
}

out(path.join(TILES, "grass.png"), paintGrass());
out(path.join(TILES, "path.png"), paintPath());
out(path.join(TILES, "city_path.png"), paintCityPath());
out(path.join(TILES, "field_bg.png"), paintWide("field"));
out(path.join(TILES, "city_bg.png"), paintWide("city"));
out(path.join(TILES, "tree.png"), paintTree());
out(path.join(TILES, "rock.png"), paintRock());
out(path.join(TILES, "flowers.png"), paintFlowers());
out(path.join(MOBS, "poring.png"), paintPoring());
out(path.join(MOBS, "fabre.png"), paintFabre());
out(path.join(MOBS, "lunatic.png"), paintLunatic());
out(path.join(MOBS, "willow.png"), paintWillow());
out(path.join(MOBS, "condor.png"), paintCondor());
console.log("PAINTED OK");
