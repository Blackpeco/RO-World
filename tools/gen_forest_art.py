#!/usr/bin/env python3
"""Generate calm-forest starter-map art (pollinations + painted fallback)."""
from __future__ import annotations

import math
import os
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOBS = os.path.join(ROOT, "assets", "mobs")
TILES = os.path.join(ROOT, "assets", "tiles")
os.makedirs(MOBS, exist_ok=True)
os.makedirs(TILES, exist_ok=True)

COMMON = (
    "2.5D ARPG game asset, slightly 3D rendered, visible depth, painterly, "
    "cute peaceful not scary, no text, no watermark, no letters, no logo, not photoreal, not chibi"
)

MOBS_JOBS = [
    (
        "poring.png",
        768,
        1024,
        COMMON
        + ", full body pink jelly blob slime creature with a cute smiling face and tiny sparkly eyes, "
        "sitting on a small mossy rock with dewdrops, round glossy translucent pink body, "
        "dark muted brown-olive studio background, game sprite",
    ),
    (
        "fabre.png",
        768,
        1024,
        COMMON
        + ", full body green leafy caterpillar with tiny translucent leaf wings, "
        "soft mossy segments, gentle face, sitting on a fern, "
        "dark muted brown-olive studio background, game sprite",
    ),
    (
        "lunatic.png",
        768,
        1024,
        COMMON
        + ", full body fluffy cream forest rabbit, calm kind eyes, soft fur, "
        "sitting on moss, small wildflowers nearby, "
        "dark muted brown-olive studio background, game sprite",
    ),
    (
        "willow.png",
        768,
        1024,
        COMMON
        + ", full body gentle young tree spirit, mossy bark body, kind carved face, "
        "small leafy crown, standing on forest floor, "
        "dark muted brown-olive studio background, game sprite",
    ),
    (
        "condor.png",
        768,
        1024,
        COMMON
        + ", full body small forest hawk bird perched calmly, soft brown and cream feathers, "
        "gentle eyes, not aggressive, perched on a mossy branch, "
        "dark muted brown-olive studio background, game sprite",
    ),
]

TILE_JOBS = [
    (
        "grass.png",
        512,
        512,
        "seamless painted game tileset, 1:1 square, sun-dappled mossy forest grass, "
        "soft gold morning light, calm green, top-down, no text no watermark no letters",
    ),
    (
        "path.png",
        512,
        512,
        "seamless painted game tileset, 1:1 square, forest dirt path with pine needles, "
        "warm brown earth, moss edges, top-down, no text no watermark no letters",
    ),
    (
        "tree.png",
        768,
        1024,
        "2.5D painted game asset, tall peaceful pine oak tree, full tree, "
        "soft morning light, dark muted brown-olive studio background, "
        "no text no watermark no letters no logo",
    ),
    (
        "rock.png",
        768,
        768,
        "2.5D painted game asset, single mossy forest stone boulder, "
        "calm, dark muted brown-olive studio background, "
        "no text no watermark no letters no logo",
    ),
    (
        "flowers.png",
        512,
        512,
        "2.5D painted game asset, small cluster of wildflowers and tiny ferns, "
        "white yellow violet blossoms, mossy base, dark muted brown-olive studio background, "
        "no text no watermark no letters no logo",
    ),
    (
        "city_path.png",
        512,
        512,
        "seamless painted game tileset, 1:1 square, warm cobblestone village path "
        "with grass between stones, forest village, top-down, no text no watermark",
    ),
    (
        "city_bg.png",
        1280,
        720,
        "wide 16:9 misty forest village sky, wooden cottages among pines, "
        "gold morning haze, calm peaceful, painted, no text no watermark no letters",
    ),
    (
        "field_bg.png",
        1280,
        720,
        "wide 16:9 misty green forest glade, sun shafts, gold morning light, "
        "calm peaceful woodland, painted, no text no watermark no letters",
    ),
]

KNOCKOUT = {"poring.png", "fabre.png", "lunatic.png", "willow.png", "condor.png", "tree.png", "rock.png", "flowers.png"}


def h01(x, y, s):
    n = (x * 374761393 + y * 668265263 + s * 1274126177) & 0xFFFFFFFF
    n ^= n >> 13
    n = (n * 1274126177) & 0xFFFFFFFF
    return (n & 0xFFFFFF) / 16777215.0


def vnoise(x, y, scale, seed):
    xf, yf = x / scale, y / scale
    x0, y0 = int(math.floor(xf)), int(math.floor(yf))
    tx, ty = xf - x0, yf - y0
    tx = tx * tx * (3 - 2 * tx)
    ty = ty * ty * (3 - 2 * ty)
    n00 = h01(x0, y0, seed)
    n10 = h01(x0 + 1, y0, seed)
    n01 = h01(x0, y0 + 1, seed)
    n11 = h01(x0 + 1, y0 + 1, seed)
    return (n00 * (1 - tx) + n10 * tx) * (1 - ty) + (n01 * (1 - tx) + n11 * tx) * ty


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def paint_tile(name, w, h):
    im = Image.new("RGB", (w, h))
    px = im.load()
    if name == "grass.png":
        for y in range(h):
            for x in range(w):
                n = vnoise(x, y, 28, 11) * 0.55 + vnoise(x, y, 9, 3) * 0.3 + vnoise(x, y, 4, 7) * 0.15
                sun = vnoise(x, y, 64, 19)
                g = 78 + n * 70 + sun * 28
                r = 48 + n * 36 + sun * 40
                b = 36 + n * 28
                if h01(x, y, 41) < 0.018:
                    r, g, b = 210, 190, 90
                px[x, y] = (int(min(255, r)), int(min(255, g)), int(min(255, b)))
    elif name == "path.png":
        for y in range(h):
            for x in range(w):
                n = vnoise(x, y, 22, 5) * 0.6 + vnoise(x, y, 6, 8) * 0.4
                r = 118 + n * 50
                g = 86 + n * 32
                b = 48 + n * 18
                if (x + y * 3) % 17 < 2:
                    r, g, b = r - 18, g - 8, b - 10
                if h01(x, y, 2) < 0.04:
                    r, g, b = 70, 92, 48
                px[x, y] = (int(r), int(g), int(b))
    elif name == "city_path.png":
        for y in range(h):
            for x in range(w):
                cx, cy = x // 36, y // 28
                j = int((h01(cx, cy, 9) - 0.5) * 8)
                ox, oy = x + j, y
                in_grout = (ox % 36 < 3) or (oy % 28 < 3)
                n = vnoise(x, y, 10, 4)
                if in_grout:
                    px[x, y] = mix((72, 110, 52), (96, 130, 64), n)
                else:
                    base = mix((176, 142, 102), (148, 118, 82), n)
                    px[x, y] = base
    elif name == "field_bg.png":
        for y in range(h):
            t = y / max(1, h - 1)
            sky = mix((186, 210, 168), (92, 130, 72), t)
            for x in range(w):
                mist = vnoise(x, y, 80, 1)
                shaft = max(0, 1 - abs((x / w) - 0.35) * 4) * (1 - t) * 0.25
                c = mix(sky, (230, 220, 160), mist * 0.25 + shaft)
                px[x, y] = c
        dr = ImageDraw.Draw(im, "RGBA")
        for i, xx in enumerate((80, 220, 400, 700, 980, 1180)):
            hgt = 280 + (i * 37) % 160
            dr.ellipse((xx - 90, h - hgt, xx + 110, h + 40), fill=(40, 70, 36, 180))
            dr.rectangle((xx - 8, h - 90, xx + 10, h), fill=(70, 50, 28, 200))
    elif name == "city_bg.png":
        for y in range(h):
            t = y / max(1, h - 1)
            sky = mix((210, 196, 160), (110, 130, 78), t)
            for x in range(w):
                mist = vnoise(x, y, 90, 2)
                px[x, y] = mix(sky, (240, 220, 180), mist * 0.2)
        dr = ImageDraw.Draw(im, "RGBA")
        for i, xx in enumerate((60, 200, 360, 620, 880, 1100)):
            hgt = 300 + (i * 53) % 140
            dr.ellipse((xx - 100, h - hgt, xx + 120, h + 30), fill=(46, 72, 40, 190))
        for xx in (300, 540, 820):
            dr.rectangle((xx, h - 160, xx + 90, h - 20), fill=(120, 82, 48, 220))
            dr.polygon([(xx - 10, h - 160), (xx + 45, h - 220), (xx + 100, h - 160)], fill=(90, 50, 30, 230))
    else:
        for y in range(h):
            for x in range(w):
                px[x, y] = mix((60, 80, 40), (30, 40, 20), y / max(1, h - 1))
    return im.filter(ImageFilter.SMOOTH_MORE)


def paint_prop(name, w, h):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im, "RGBA")
    cx, cy = w // 2, int(h * 0.62)
    if name == "tree.png":
        dr.rectangle((cx - 18, int(h * 0.48), cx + 18, int(h * 0.92)), fill=(92, 64, 36, 255))
        for i, (ox, oy, r) in enumerate(((-40, -80, 110), (50, -60, 100), (0, -140, 130), (-70, -20, 80), (70, -10, 84))):
            col = (46 + i * 8, 92 + i * 10, 48 + i * 4, 255)
            dr.ellipse((cx + ox - r, cy + oy - r, cx + ox + r, cy + oy + r), fill=col)
    elif name == "rock.png":
        dr.ellipse((cx - 160, cy - 90, cx + 170, cy + 130), fill=(120, 118, 108, 255))
        dr.ellipse((cx - 80, cy - 40, cx + 40, cy + 50), fill=(150, 148, 136, 255))
        dr.ellipse((cx - 140, cy + 40, cx - 20, cy + 120), fill=(70, 100, 52, 220))
        dr.ellipse((cx + 20, cy + 50, cx + 140, cy + 130), fill=(64, 96, 48, 200))
    elif name == "flowers.png":
        dr.ellipse((cx - 90, cy + 20, cx + 100, cy + 90), fill=(60, 96, 44, 230))
        for ox, oy, col in ((-50, -10, (230, 210, 90)), (20, -40, (220, 120, 160)), (60, 0, (240, 240, 250)), (-10, 10, (180, 90, 200))):
            dr.ellipse((cx + ox - 16, cy + oy - 16, cx + ox + 16, cy + oy + 16), fill=col + (255,))
            dr.ellipse((cx + ox - 5, cy + oy - 5, cx + ox + 5, cy + oy + 5), fill=(240, 220, 80, 255))
        dr.polygon([(cx - 80, cy + 10), (cx - 40, cy - 70), (cx - 20, cy + 20)], fill=(70, 130, 60, 255))
    return im


def paint_mob(name, w, h):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im, "RGBA")
    cx = w // 2
    if name == "poring.png":
        dr.ellipse((cx - 200, 420, cx + 210, 900), fill=(255, 130, 176, 255))
        dr.ellipse((cx - 80, 500, cx + 40, 620), fill=(255, 190, 210, 200))
        dr.ellipse((cx - 90, 620, cx - 40, 680), fill=(40, 30, 40, 255))
        dr.ellipse((cx + 50, 620, cx + 100, 680), fill=(40, 30, 40, 255))
        dr.arc((cx - 50, 700, cx + 60, 780), 20, 160, fill=(180, 60, 90, 255), width=8)
        dr.ellipse((cx - 160, 820, cx + 170, 940), fill=(70, 110, 50, 230))
    elif name == "fabre.png":
        for i, yy in enumerate((520, 600, 680, 760, 840)):
            r = 70 - i * 4
            dr.ellipse((cx - r, yy - 50, cx + r, yy + 60), fill=(90 + i * 8, 160 - i * 6, 70, 255))
        dr.ellipse((cx - 70, 430, cx + 70, 560), fill=(120, 180, 80, 255))
        dr.ellipse((cx - 28, 480, cx - 8, 500), fill=(30, 40, 20, 255))
        dr.ellipse((cx + 12, 480, cx + 32, 500), fill=(30, 40, 20, 255))
        dr.polygon([(cx - 40, 500), (cx - 140, 360), (cx + 10, 470)], fill=(140, 200, 90, 180))
        dr.polygon([(cx + 40, 500), (cx + 140, 360), (cx - 10, 470)], fill=(140, 200, 90, 180))
    elif name == "lunatic.png":
        dr.ellipse((cx - 70, 220, cx - 20, 520), fill=(236, 220, 190, 255))
        dr.ellipse((cx + 20, 220, cx + 70, 520), fill=(236, 220, 190, 255))
        dr.ellipse((cx - 160, 520, cx + 160, 920), fill=(240, 228, 200, 255))
        dr.ellipse((cx - 90, 400, cx + 90, 620), fill=(245, 232, 208, 255))
        dr.ellipse((cx - 30, 500, cx - 8, 522), fill=(50, 40, 30, 255))
        dr.ellipse((cx + 12, 500, cx + 34, 522), fill=(50, 40, 30, 255))
        dr.ellipse((cx - 10, 540, cx + 16, 560), fill=(220, 170, 150, 255))
    elif name == "willow.png":
        dr.rectangle((cx - 50, 420, cx + 50, 900), fill=(96, 70, 42, 255))
        dr.ellipse((cx - 160, 280, cx + 170, 620), fill=(70, 110, 52, 255))
        dr.ellipse((cx - 50, 430, cx + 50, 540), fill=(210, 190, 150, 255))
        dr.ellipse((cx - 22, 470, cx - 6, 488), fill=(40, 30, 20, 255))
        dr.ellipse((cx + 10, 470, cx + 26, 488), fill=(40, 30, 20, 255))
        dr.arc((cx - 20, 500, cx + 24, 530), 20, 160, fill=(80, 50, 30, 255), width=4)
        dr.ellipse((cx - 140, 820, cx + 150, 940), fill=(64, 100, 48, 230))
    elif name == "condor.png":
        dr.ellipse((cx - 90, 420, cx + 90, 700), fill=(140, 108, 72, 255))
        dr.ellipse((cx - 50, 340, cx + 50, 460), fill=(168, 132, 90, 255))
        dr.polygon([(cx - 8, 430), (cx + 8, 430), (cx, 470)], fill=(220, 160, 60, 255))
        dr.ellipse((cx - 18, 390, cx - 4, 406), fill=(40, 30, 20, 255))
        dr.ellipse((cx + 6, 390, cx + 20, 406), fill=(40, 30, 20, 255))
        dr.polygon([(cx - 90, 520), (cx - 240, 600), (cx - 70, 600)], fill=(110, 86, 56, 255))
        dr.polygon([(cx + 90, 520), (cx + 240, 600), (cx + 70, 600)], fill=(110, 86, 56, 255))
        dr.ellipse((cx - 40, 680, cx + 40, 760), fill=(90, 70, 44, 255))
    return im


def paint_fallback(rel, w, h):
    name = os.path.basename(rel)
    if name in ("grass.png", "path.png", "city_path.png", "field_bg.png", "city_bg.png"):
        return paint_tile(name, w, h)
    if name in ("tree.png", "rock.png", "flowers.png"):
        bg = Image.new("RGB", (w, h), (28, 26, 20))
        prop = paint_prop(name, w, h)
        bg.paste(prop, (0, 0), prop)
        return prop  # keep alpha
    return paint_mob(name, w, h)


def fetch(prompt, w, h, dest, tries=4):
    q = urllib.parse.quote(prompt)
    seed = abs(hash(os.path.basename(dest) + "forest-calm-v1")) % 999999
    url = "https://image.pollinations.ai/prompt/%s?width=%d&height=%d&nologo=true&model=flux&seed=%d" % (
        q,
        w,
        h,
        seed,
    )
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "RagnarokATB/1.0"})
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            if len(data) < 2000:
                last = "tiny %d" % len(data)
                time.sleep(2)
                continue
            tmp = dest + ".tmp"
            with open(tmp, "wb") as f:
                f.write(data)
            try:
                im = Image.open(tmp)
                im = im.convert("RGB")
                im.save(dest, "PNG")
                os.remove(tmp)
            except Exception:
                os.replace(tmp, dest)
            print("ok fetch", dest, os.path.getsize(dest), flush=True)
            return True
        except Exception as e:
            last = str(e)
            print("retry", dest, last, flush=True)
            time.sleep(2 + i * 2)
    print("FAIL fetch", dest, last, flush=True)
    return False


def dist2(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def hsl(p):
    r, g, b = p[0] / 255.0, p[1] / 255.0, p[2] / 255.0
    mx, mn = max(r, g, b), min(r, g, b)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    sat = 0.0 if mx < 1e-6 else (mx - mn) / mx
    return sat, lum


def knockout(src_path, dest):
    im = Image.open(src_path).convert("RGBA")
    w, h = im.size
    px = im.load()
    samples = []
    inset = 14
    boxes = [(0, 0, inset, inset), (w - inset, 0, w, inset), (0, h - inset, inset, h), (w - inset, h - inset, w, h)]
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

    def is_bg(p):
        r, g, b = p[0], p[1], p[2]
        sat, lum = hsl(p)
        for s in samples:
            if dist2((r, g, b), s) <= 48 * 48:
                return True
            if dist2((r, g, b), s) <= 78 * 78 and sat < 0.28:
                return True
        if sat < 0.14 and lum < 0.28:
            return True
        return False

    mark = [[False] * w for _ in range(h)]
    q = deque()

    def seed(x, y):
        if mark[y][x]:
            return
        if is_bg(px[x, y]):
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
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if nx < 0 or ny < 0 or nx >= w or ny >= h or mark[ny][nx]:
                continue
            p = px[nx, ny]
            sat, lum = hsl(p)
            if sat > 0.42 and lum > 0.22:
                continue
            if is_bg(p):
                mark[ny][nx] = True
                q.append((nx, ny))

    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    opx = out.load()
    kept = 0
    for y in range(h):
        for x in range(w):
            if mark[y][x]:
                continue
            kept += 1
            r, g, b, a = px[x, y]
            opx[x, y] = (r, g, b, a)

    ratio = kept / float(w * h)
    if ratio < 0.06 or ratio > 0.92:
        print("knockout skip (ratio=%.3f)" % ratio, dest, flush=True)
        return False
    bbox = out.getbbox()
    if bbox:
        pad = 10
        out = out.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(w, bbox[2] + pad), min(h, bbox[3] + pad)))
    out.save(dest, "PNG")
    print("knockout", dest, out.size, "ratio=%.3f" % ratio, flush=True)
    return True


def one_job(kind, name, w, h, prompt):
    dest_dir = MOBS if kind == "mob" else TILES
    dest = os.path.join(dest_dir, name)
    got = fetch(prompt, w, h, dest)
    if not got:
        fb = paint_fallback(name, w, h)
        if fb.mode == "RGBA":
            fb.save(dest, "PNG")
        else:
            fb.save(dest, "PNG")
        print("fallback", dest, os.path.getsize(dest), flush=True)
    elif name in KNOCKOUT:
        knockout(dest, dest)
    return dest


def main():
    jobs = []
    for name, w, h, p in MOBS_JOBS:
        jobs.append(("mob", name, w, h, p))
    for name, w, h, p in TILE_JOBS:
        jobs.append(("tile", name, w, h, p))
    ok = 0
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = [ex.submit(one_job, *j) for j in jobs]
        for f in as_completed(futs):
            try:
                dest = f.result()
                if os.path.isfile(dest) and os.path.getsize(dest) > 800:
                    ok += 1
            except Exception as e:
                print("job err", e, flush=True)
    print("DONE %d/%d" % (ok, len(jobs)), flush=True)
    return 0 if ok == len(jobs) else 1


if __name__ == "__main__":
    sys.exit(main())
