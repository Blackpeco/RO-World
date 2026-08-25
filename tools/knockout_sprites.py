#!/usr/bin/env python3
"""Knock out studio backdrops from assets/chars/*.png → *_sprite.png (RGBA)."""
from __future__ import annotations

import os
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAR = os.path.join(ROOT, "assets", "chars")


def dist2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def hsl(p):
    r, g, b = p[0] / 255.0, p[1] / 255.0, p[2] / 255.0
    mx, mn = max(r, g, b), min(r, g, b)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    sat = 0.0 if mx < 1e-6 else (mx - mn) / mx
    d = mx - mn
    if d < 1e-6:
        hue = 0.0
    elif mx == r:
        hue = (60 * ((g - b) / d) + 360) % 360
    elif mx == g:
        hue = 60 * ((b - r) / d) + 120
    else:
        hue = 60 * ((r - g) / d) + 240
    return hue, sat, lum


def sample_corners(im, inset=16):
    w, h = im.size
    px = im.load()
    samples = []
    boxes = [
        (0, 0, inset, inset),
        (w - inset, 0, w, inset),
        (0, h - inset, inset, h),
        (w - inset, h - inset, w, h),
    ]
    for x0, y0, x1, y1 in boxes:
        rs = gs = bs = n = 0
        for y in range(y0, y1):
            for x in range(x0, x1):
                r, g, b = px[x, y][:3]
                rs += r
                gs += g
                bs += b
                n += 1
        samples.append((rs // n, gs // n, bs // n))
    return samples


def is_backdrop(p, samples, kind):
    r, g, b = p[0], p[1], p[2]
    hue, sat, lum = hsl(p)
    for s in samples:
        if dist2((r, g, b), s) <= 55 * 55:
            return True
        if dist2((r, g, b), s) <= 88 * 88 and sat < 0.32:
            return True
    if sat < 0.16 and lum < 0.30:
        return True
    if sat < 0.10 and lum < 0.45:
        return True
    if sat < 0.08 and lum > 0.52 and abs(r - g) < 14 and abs(g - b) < 14:
        return True
    if kind == "warrior":
        if 0 <= hue <= 50 and sat > 0.25 and lum < 0.58 and r < 175 and b < 70:
            return True
        if r > g + 6 and g > b - 2 and r < 160 and lum < 0.50 and b < 55:
            return True
    if kind == "wolf":
        if 180 <= hue <= 250 and lum < 0.72 and sat < 0.55:
            return True
        if b >= g >= r - 8 and lum < 0.68 and sat < 0.45:
            return True
    return False


def knockout(src, dest, kind):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    px = im.load()
    samples = sample_corners(im)
    mark = [[False] * w for _ in range(h)]
    q = deque()

    def seed(x, y):
        if mark[y][x]:
            return
        if is_backdrop(px[x, y], samples, kind):
            mark[y][x] = True
            q.append((x, y))

    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)

    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= w or ny >= h or mark[ny][nx]:
                continue
            p = px[nx, ny]
            hue, sat, lum = hsl(p)
            if lum > 0.78:
                continue
            if sat > 0.55 and lum > 0.22 and kind != "warrior":
                continue
            if kind == "warrior" and lum > 0.62 and sat > 0.35:
                continue
            if kind == "wolf" and lum > 0.70:
                continue
            if is_backdrop(p, samples, kind):
                mark[ny][nx] = True
                q.append((nx, ny))

    for _ in range(2):
        extra = []
        for y in range(h):
            for x in range(w):
                if mark[y][x]:
                    continue
                p = px[x, y]
                if not is_backdrop(p, samples, kind):
                    hue, sat, lum = hsl(p)
                    near = any(dist2(p[:3], s) <= 95 * 95 for s in samples)
                    if not near and not (sat < 0.22 and lum < 0.35):
                        continue
                n = 0
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if nx < 0 or ny < 0 or nx >= w or ny >= h or mark[ny][nx]:
                        n += 1
                if n >= 3:
                    extra.append((x, y))
        for x, y in extra:
            mark[y][x] = True

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            if mark[y][x]:
                continue
            r, g, b, a = px[x, y]
            edge = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and mark[ny][nx]:
                    edge = True
                    break
            opx[x, y] = (r, g, b, 200 if edge else a)

    bbox = out.getbbox()
    if bbox:
        pad = 8
        out = out.crop(
            (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(w, bbox[2] + pad),
                min(h, bbox[3] + pad),
            )
        )
    out.save(dest, "PNG")
    return dest


def main():
    names = [
        "warrior",
        "assassin",
        "hunter",
        "monster",
        "golem",
        "wolf",
        "knight",
        "demon",
        "angel",
        "dragon",
    ]
    ok = 0
    for name in names:
        src = os.path.join(CHAR, name + ".png")
        dest = os.path.join(CHAR, name + "_sprite.png")
        if not os.path.isfile(src):
            print("missing", src)
            continue
        knockout(src, dest, name)
        im = Image.open(dest)
        print("ok", dest, im.size, os.path.getsize(dest))
        ok += 1
    print("DONE %d/%d" % (ok, len(names)))
    return 0 if ok == len(names) else 1


if __name__ == "__main__":
    raise SystemExit(main())
