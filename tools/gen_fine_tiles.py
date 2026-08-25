#!/usr/bin/env python3.13
"""Fine-grain seamless walk tiles + small field canopy backdrop."""
from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES = os.path.join(ROOT, "assets", "tiles")


def h01(x: int, y: int, s: int) -> float:
    n = (x * 374761393 + y * 668265263 + s * 1274126177) & 0xFFFFFFFF
    n ^= n >> 13
    n = (n * 1274126177) & 0xFFFFFFFF
    return (n & 0xFFFFFF) / 16777215.0


def vnoise_wrap(x: float, y: float, scale: float, seed: int, w: int, h: int) -> float:
    xf, yf = x / scale, y / scale
    x0, y0 = int(math.floor(xf)), int(math.floor(yf))
    tx, ty = xf - x0, yf - y0
    tx = tx * tx * (3 - 2 * tx)
    ty = ty * ty * (3 - 2 * ty)
    px = max(1, int(round(w / scale)))
    py = max(1, int(round(h / scale)))

    def n(ix: int, iy: int) -> float:
        return h01(ix % px, iy % py, seed)

    n00, n10 = n(x0, y0), n(x0 + 1, y0)
    n01, n11 = n(x0, y0 + 1), n(x0 + 1, y0 + 1)
    return (n00 * (1 - tx) + n10 * tx) * (1 - ty) + (n01 * (1 - tx) + n11 * tx) * ty


def mix(a, b, t):
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def grain_tile(w, h, lo, hi, seed, extra=None):
    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        for x in range(w):
            n = (
                vnoise_wrap(x, y, 5.0, seed, w, h) * 0.38
                + vnoise_wrap(x, y, 2.4, seed + 11, w, h) * 0.32
                + h01(x, y, seed + 3) * 0.30
            )
            col = mix(lo, hi, n)
            # sparse flecks, still high-frequency
            if h01(x, y, seed + 41) < 0.045:
                col = mix(col, lo, 0.45)
            if h01(x, y, seed + 77) < 0.035:
                col = mix(col, hi, 0.5)
            if extra:
                col = extra(x, y, col, w, h)
            px[x, y] = col
    return im


def paint_field_bg(w=384, h=216):
    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        sky = mix((28, 62, 60), (10, 28, 26), t ** 0.78)
        for x in range(w):
            mist = vnoise_wrap(x, y, 48, 3, w, h)
            mist2 = vnoise_wrap(x, y + 40, 28, 5, w, h)
            canopy = vnoise_wrap(x, y, 16, 8, w, h)
            dapple = vnoise_wrap(x, y, 7, 19, w, h)
            shaft = max(0.0, 1.0 - abs((x / w) - 0.26 - t * 0.16) * 7.4) * (1.0 - t) * 0.2
            shaft2 = max(0.0, 1.0 - abs((x / w) - 0.64 - t * 0.1) * 8.2) * (1.0 - t) * 0.12
            c = mix(sky, (86, 120, 112), mist * 0.22)
            c = mix(c, (54, 78, 74), mist2 * 0.16)
            c = mix(c, (8, 22, 20), canopy * 0.42 * (1 - t * 0.35))
            c = mix(c, (150, 186, 160), shaft + shaft2)
            c = mix(c, (22, 48, 42), (dapple - 0.5) * 0.18 + 0.09)
            px[x, y] = c
    dr = ImageDraw.Draw(im, "RGBA")
    blobs = [
        (-30, -36, 80, 72),
        (40, -48, 168, 64),
        (120, -28, 250, 88),
        (210, -54, 340, 58),
        (290, -32, 410, 82),
        (8, 4, 108, 92),
        (150, 6, 270, 104),
        (260, 2, 390, 86),
        (70, 18, 150, 110),
        (200, 22, 300, 118),
    ]
    for i, (x0, y0, x1, y1) in enumerate(blobs):
        a = 100 + (i * 19) % 60
        dr.ellipse((x0, y0, x1, y1), fill=(8, 24, 22, a))
    im = im.filter(ImageFilter.GaussianBlur(1.05))
    return im


def main():
    os.makedirs(TILES, exist_ok=True)

    city = grain_tile(128, 128, (196, 180, 154), (216, 200, 176), 21)
    city.save(os.path.join(TILES, "city_ground.png"), optimize=True)
    print("city_ground", os.path.getsize(os.path.join(TILES, "city_ground.png")))

    plaza = grain_tile(128, 128, (234, 218, 196), (248, 238, 220), 33)
    plaza.save(os.path.join(TILES, "city_plaza.png"), optimize=True)
    print("city_plaza", os.path.getsize(os.path.join(TILES, "city_plaza.png")))

    def moss_extra(x, y, col, w, h):
        n = vnoise_wrap(x, y, 1.7, 61, w, h)
        if n > 0.78:
            return mix(col, (72, 118, 86), 0.35)
        if h01(x, y, 91) < 0.03:
            return mix(col, (18, 44, 38), 0.5)
        if h01(x, y, 103) < 0.02:
            return mix(col, (96, 148, 108), 0.32)
        return col

    grass = grain_tile(128, 128, (18, 46, 40), (52, 92, 70), 11, moss_extra)
    grass.save(os.path.join(TILES, "grass.png"), optimize=True)
    print("grass", os.path.getsize(os.path.join(TILES, "grass.png")))

    def dirt_extra(x, y, col, w, h):
        pebble = h01(x, y, 5)
        if pebble < 0.045:
            return mix(col, (168, 142, 104), 0.4)
        if pebble > 0.97:
            return mix(col, (78, 60, 40), 0.35)
        if h01(x, y, 19) < 0.02:
            return mix(col, (58, 86, 56), 0.28)
        return col

    path = grain_tile(128, 128, (118, 94, 64), (168, 140, 98), 7, dirt_extra)
    path.save(os.path.join(TILES, "path.png"), optimize=True)
    print("path", os.path.getsize(os.path.join(TILES, "path.png")))

    bg = paint_field_bg(384, 216)
    dest = os.path.join(TILES, "field_bg.png")
    bg.save(dest, optimize=True)
    print("field_bg", bg.size, os.path.getsize(dest))


if __name__ == "__main__":
    main()
