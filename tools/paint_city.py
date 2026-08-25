#!/usr/bin/env python3
"""Paint Prontera 2.5D city sprites (transparent PNG, painterly noon light)."""
from __future__ import annotations

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "city")
os.makedirs(OUT, exist_ok=True)

# Warm noon, light from top-left, shadow bottom-right.
CREAM = (244, 220, 190)
CREAM_D = (214, 184, 152)
TIMBER = (72, 46, 32)
TIMBER_D = (48, 30, 20)
TERR = (206, 86, 58)
TERR_L = (228, 118, 82)
TERR_D = (168, 62, 44)
STONE = (176, 172, 164)
STONE_L = (206, 202, 194)
STONE_D = (128, 124, 116)
ROSE = (196, 132, 122)
ROSE_L = (222, 168, 152)
ROSE_D = (154, 92, 88)
LIME = (228, 226, 216)
LIME_D = (186, 182, 170)
AWN_ROSE = (196, 58, 68)
AWN_MINT = (86, 176, 128)
WATER = (110, 196, 220)
WATER_D = (62, 148, 180)
LEAF = (62, 148, 58)
LEAF_L = (118, 196, 86)
LEAF_D = (36, 102, 46)
FLAG = (196, 36, 40)


def clamp(v, lo=0, hi=255):
    return lo if v < lo else hi if v > hi else v


def rgba(c, a=255):
    if len(c) == 4:
        return (c[0], c[1], c[2], c[3] if a == 255 else a)
    return (c[0], c[1], c[2], a)


def lit(c, k):
    return (clamp(c[0] + k), clamp(c[1] + k), clamp(c[2] + k), c[3] if len(c) > 3 else 255)


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def canvas(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def grain(im, amt=10, seed=1):
    rnd = random.Random(seed)
    px = im.load()
    w, h = im.size
    for y in range(0, h, 1):
        for x in range(0, w, 1):
            p = px[x, y]
            if p[3] < 8:
                continue
            j = rnd.randint(-amt, amt)
            px[x, y] = (clamp(p[0] + j), clamp(p[1] + j), clamp(p[2] + j // 2), p[3])
    return im


def soft(im, r=1.1):
    return im.filter(ImageFilter.GaussianBlur(r))


def paste(base, layer):
    return Image.alpha_composite(base, layer)


def layer_draw(im):
    lay = canvas(*im.size)
    return lay, ImageDraw.Draw(lay, "RGBA")


def ellipse(dr, box, fill, outline=None, width=1):
    dr.ellipse(box, fill=rgba(fill) if fill else None, outline=outline, width=width)


def poly(dr, pts, fill, outline=None):
    dr.polygon(pts, fill=rgba(fill), outline=outline)


def rect(dr, box, fill, outline=None):
    dr.rectangle(box, fill=rgba(fill), outline=outline)


def ground_shadow(im, cx, cy, rx, ry, a=72):
    lay, dr = layer_draw(im)
    ellipse(dr, (cx - rx, cy - ry, cx + rx, cy + ry), (36, 26, 16, a))
    return paste(im, lay.filter(ImageFilter.GaussianBlur(10)))


def blob(im, box, fill, blur=0):
    lay, dr = layer_draw(im)
    ellipse(dr, box, fill)
    if blur:
        lay = lay.filter(ImageFilter.GaussianBlur(blur))
    return paste(im, lay)


def cone(dr, cx, top, r, bot, c_l, c, c_d):
    # Conical roof, light from top-left.
    poly(dr, [(cx, top), (cx - r, bot), (cx, bot + 2)], c_d)
    poly(dr, [(cx, top), (cx, bot + 2), (cx + r, bot)], c)
    poly(dr, [(cx, top), (cx - r * 0.35, bot - 2), (cx + r * 0.08, bot - 6)], c_l)


def gable(dr, x0, y0, x1, y1, ridge_y, left_lit=True):
    mid = (x0 + x1) / 2
    c_l, c, c_d = TERR_L, TERR, TERR_D
    # left slope
    poly(dr, [(x0, y1), (mid, ridge_y), (mid, y1)], lit(c, 8) if left_lit else c_d)
    # right slope
    poly(dr, [(mid, ridge_y), (x1, y1), (mid, y1)], c_d if left_lit else lit(c, 6))
    # ridge highlight
    dr.line([(x0 + 4, y1 - 2), (mid, ridge_y + 2), (x1 - 4, y1 - 2)], fill=rgba(TERR_L, 180), width=2)
    # tile rows
    h = y1 - ridge_y
    for i in range(5):
        t = (i + 1) / 6
        y = ridge_y + h * t
        w = (x1 - x0) * t * 0.92
        dr.line([(mid - w / 2, y), (mid + w / 2, y)], fill=rgba(TERR_D, 90), width=2)


def timber_frame(dr, x0, y0, x1, y1):
    # Tudor beams
    dr.rectangle((x0, y0, x0 + 7, y1), fill=rgba(TIMBER))
    dr.rectangle((x1 - 7, y0, x1, y1), fill=rgba(TIMBER))
    dr.rectangle((x0, y1 - 8, x1, y1), fill=rgba(TIMBER_D))
    dr.rectangle((x0, y0, x1, y0 + 6), fill=rgba(TIMBER))
    mid = (x0 + x1) / 2
    dr.rectangle((mid - 3, y0, mid + 3, y1), fill=rgba(TIMBER))
    # diagonals
    dr.line([(x0 + 6, y0 + 8), (mid - 4, y1 - 10)], fill=rgba(TIMBER, 210), width=4)
    dr.line([(x1 - 6, y0 + 8), (mid + 4, y1 - 10)], fill=rgba(TIMBER, 210), width=4)


def window(dr, x, y, w, h, night=False):
    glass = (120, 168, 196, 230) if not night else (80, 110, 140, 230)
    rect(dr, (x, y, x + w, y + h), glass, outline=rgba(TIMBER_D))
    dr.line([(x + w / 2, y), (x + w / 2, y + h)], fill=rgba(TIMBER), width=2)
    dr.line([(x, y + h / 2), (x + w, y + h / 2)], fill=rgba(TIMBER), width=2)
    # highlight TL
    dr.rectangle((x + 2, y + 2, x + w * 0.4, y + h * 0.35), fill=(230, 240, 248, 70))


def door(dr, x, y, w, h, stain=(96, 58, 36)):
    rect(dr, (x, y, x + w, y + h), stain, outline=rgba(TIMBER_D))
    dr.rectangle((x + 3, y + 4, x + w / 2 - 2, y + h - 4), fill=rgba(lit(stain, 18)))
    dr.rectangle((x + w / 2 + 2, y + 4, x + w - 3, y + h - 4), fill=rgba(lit(stain, -8)))
    ellipse(dr, (x + w - 12, y + h * 0.5, x + w - 5, y + h * 0.5 + 7), (196, 168, 72))


def chimney(dr, x, y, w, h):
    rect(dr, (x, y, x + w, y + h), (154, 86, 70))
    rect(dr, (x - 3, y - 6, x + w + 3, y + 8), (132, 70, 56))
    # puff
    ellipse(dr, (x - 2, y - 22, x + w + 8, y - 4), (220, 220, 224, 80))


def flag(dr, x, y, left=False):
    dr.line([(x, y), (x, y + 28)], fill=rgba((90, 70, 50)), width=2)
    if left:
        poly(dr, [(x, y), (x - 18, y + 7), (x, y + 14)], FLAG)
    else:
        poly(dr, [(x, y), (x + 18, y + 7), (x, y + 14)], FLAG)


def stone_fill(dr, x0, y0, x1, y1, base, seed=3):
    rnd = random.Random(seed)
    rect(dr, (x0, y0, x1, y1), base)
    bw = 14
    bh = 10
    row = 0
    y = y0
    while y < y1:
        x = x0 + (-6 if row % 2 else 0)
        while x < x1:
            j = rnd.randint(-10, 12)
            c = lit(base, j)
            xa, ya = max(x0, x), max(y0, y)
            xb, yb = min(x1 - 1, x + bw - 1), min(y1 - 1, y + bh - 1)
            if xb > xa and yb > ya:
                rect(dr, (xa, ya, xb, yb), c)
                dr.line([(xa, yb), (xb, yb)], fill=rgba(lit(base, -24), 80), width=1)
            x += bw
        y += bh
        row += 1


def crenel(dr, x0, y, x1, h=14, c=STONE_L):
    x = x0
    on = True
    while x < x1:
        if on:
            rect(dr, (x, y - h, min(x + 12, x1), y + 2), c)
        on = not on
        x += 12


def paint_house(path, awning=None):
    w, h = 420, 560
    im = canvas(w, h)
    im = ground_shadow(im, 210, 530, 150, 28, 80)
    lay, dr = layer_draw(im)

    # body
    x0, y0, x1, y1 = 70, 250, 350, 500
    # right (darker) face for 2.5D
    poly(dr, [(x1 - 8, y0 + 10), (390, 270), (390, 478), (x1, y1)], CREAM_D)
    rect(dr, (x0, y0, x1, y1), CREAM)
    # sun wash TL
    poly(dr, [(x0, y0), (x0 + 90, y0), (x0, y0 + 140)], (255, 244, 220, 50))
    timber_frame(dr, x0, y0, x1, y1)
    window(dr, 100, 300, 52, 58)
    window(dr, 268, 300, 52, 58)
    window(dr, 186, 292, 44, 40)
    door(dr, 178, 390, 64, 108)

    if awning:
        # fabric awning over door
        ax0, ay0, ax1, ay1 = 150, 368, 274, 402
        poly(dr, [(ax0, ay0), (ax1, ay0), (ax1 + 8, ay1), (ax0 - 8, ay1)], awning)
        for i in range(5):
            xx = ax0 + i * 24
            dr.line([(xx, ay0), (xx - 4, ay1)], fill=rgba(lit(awning, -30), 120), width=2)
        # scallops
        for i in range(6):
            cx = ax0 + i * 20
            ellipse(dr, (cx, ay1 - 6, cx + 20, ay1 + 10), lit(awning, -10))

    # gable roof
    gable(dr, 48, 250, 372, 268, 78)
    # side roof plane
    poly(dr, [(372, 268), (210, 78), (404, 96), (404, 286)], TERR_D)
    chimney(dr, 292, 108, 28, 70)

    im = paste(im, lay)
    im = grain(im, 9, 11)
    im = soft(im, 0.7)
    im.save(path, "PNG")
    print("ok", path, os.path.getsize(path))


def paint_shop(path, awning):
    w, h = 360, 460
    im = canvas(w, h)
    im = ground_shadow(im, 180, 438, 130, 24, 75)
    lay, dr = layer_draw(im)
    x0, y0, x1, y1 = 58, 210, 300, 420
    poly(dr, [(x1 - 6, y0 + 8), (332, 228), (332, 400), (x1, y1)], CREAM_D)
    rect(dr, (x0, y0, x1, y1), CREAM)
    timber_frame(dr, x0, y0, x1, y1)
    # counter opening
    rect(dr, (100, 300, 258, 418), (60, 40, 28))
    rect(dr, (108, 308, 250, 360), (244, 230, 200))
    # goods blobs
    ellipse(dr, (120, 318, 148, 348), (210, 70, 70))
    ellipse(dr, (160, 316, 190, 350), (80, 160, 90))
    ellipse(dr, (200, 320, 232, 352), (80, 110, 190))
    # awning
    poly(dr, [(78, 248), (292, 248), (308, 302), (64, 302)], awning)
    for i in range(8):
        xx = 86 + i * 26
        dr.line([(xx, 248), (xx - 6, 302)], fill=rgba(lit(awning, -28), 130), width=2)
    for i in range(9):
        cx = 70 + i * 26
        ellipse(dr, (cx, 292, cx + 24, 316), lit(awning, -8))
    gable(dr, 40, 214, 318, 230, 62)
    poly(dr, [(318, 230), (178, 62), (346, 80), (346, 248)], TERR_D)
    chimney(dr, 246, 88, 22, 56)
    im = paste(im, lay)
    im = grain(im, 8, 22)
    im = soft(im, 0.65)
    im.save(path, "PNG")
    print("ok", path, os.path.getsize(path))


def paint_castle(path):
    w, h = 900, 860
    im = canvas(w, h)
    im = ground_shadow(im, 450, 820, 340, 36, 90)
    lay, dr = layer_draw(im)

    def keep_block(x0, y0, x1, y1, seed):
        stone_fill(dr, x0, y0, x1, y1, ROSE, seed)
        # TL wash
        poly(dr, [(x0, y0), (x0 + 70, y0), (x0, y0 + 90)], (255, 220, 200, 35))
        crenel(dr, x0, y0, x1, 16, ROSE_L)
        # windows
        for wx in range(x0 + 22, x1 - 20, 48):
            for wy in (y0 + 36, y0 + 100, (y0 + y1) // 2):
                if wy + 28 < y1 - 16:
                    window(dr, wx, wy, 16, 26)

    def tower(cx, base_y, r, body_h, roof_h, seed):
        x0, x1 = cx - r, cx + r
        y0 = base_y - body_h
        stone_fill(dr, x0, y0, x1, base_y, ROSE_D, seed)
        # cylinder shade
        rect(dr, (cx + r * 0.25, y0, x1, base_y), (0, 0, 0, 28))
        rect(dr, (x0, y0, cx - r * 0.35, base_y), (255, 230, 210, 22))
        cone(dr, cx, y0 - roof_h, r + 10, y0 + 6, TERR_L, TERR, TERR_D)
        flag(dr, cx, y0 - roof_h - 6)
        for wy in (y0 + 24, y0 + body_h * 0.45):
            window(dr, cx - 8, wy, 14, 22)

    # rear towers
    tower(210, 700, 58, 280, 110, 4)
    tower(690, 700, 58, 280, 110, 5)
    # main keep
    keep_block(250, 360, 650, 760, 7)
    # front side towers
    tower(270, 770, 70, 340, 130, 8)
    tower(630, 770, 70, 340, 130, 9)
    # center gate tower
    tower(450, 790, 64, 260, 150, 6)
    # gate arch
    rect(dr, (400, 640, 500, 800), (40, 22, 22))
    ellipse(dr, (400, 590, 500, 720), (30, 16, 16))
    # door
    door(dr, 418, 690, 64, 108, (70, 36, 32))
    # inner wall merlons
    crenel(dr, 250, 360, 650, 18, ROSE_L)

    im = paste(im, lay)
    im = grain(im, 8, 31)
    im = soft(im, 0.8)
    im.save(path, "PNG")
    print("ok", path, os.path.getsize(path))


def paint_church(path):
    w, h = 720, 900
    im = canvas(w, h)
    im = ground_shadow(im, 360, 860, 280, 32, 85)
    lay, dr = layer_draw(im)

    # nave
    stone_fill(dr, 160, 430, 560, 820, LIME, 12)
    poly(dr, [(160, 430), (360, 300), (560, 430)], LIME_D)
    # terracotta nave roof
    poly(dr, [(150, 440), (360, 250), (360, 430)], TERR_L)
    poly(dr, [(360, 250), (570, 440), (360, 430)], TERR)
    for i in range(6):
        t = (i + 1) / 7
        y = 250 + 190 * t
        half = 210 * t
        dr.line([(360 - half, y), (360 + half, y)], fill=rgba(TERR_D, 100), width=2)

    # twin spires
    def spire(cx):
        stone_fill(dr, cx - 42, 280, cx + 42, 520, LIME, 15 + cx)
        crenel(dr, cx - 42, 280, cx + 42, 12, LIME)
        cone(dr, cx, 70, 52, 286, TERR_L, TERR, TERR_D)
        flag(dr, cx, 52)
        window(dr, cx - 10, 340, 18, 50)
        window(dr, cx - 10, 410, 18, 40)

    spire(230)
    spire(490)

    # facade
    stone_fill(dr, 250, 500, 470, 830, LIME, 21)
    # rose window
    ellipse(dr, (300, 530, 420, 650), (90, 70, 140, 230))
    ellipse(dr, (318, 548, 402, 632), (160, 90, 150, 200))
    ellipse(dr, (348, 578, 372, 602), (240, 210, 160, 220))
    for i in range(8):
        ang = i * math.pi / 4
        x2 = 360 + math.cos(ang) * 48
        y2 = 590 + math.sin(ang) * 48
        dr.line([(360, 590), (x2, y2)], fill=rgba((210, 190, 150), 160), width=2)
    # portal
    rect(dr, (330, 700, 390, 830), (50, 40, 36))
    ellipse(dr, (330, 660, 390, 760), (50, 40, 36))
    door(dr, 338, 740, 44, 88, (80, 52, 40))
    # side buttresses
    poly(dr, [(160, 620), (130, 830), (176, 830), (176, 640)], LIME_D)
    poly(dr, [(560, 620), (590, 830), (544, 830), (544, 640)], LIME_D)

    im = paste(im, lay)
    im = grain(im, 8, 44)
    im = soft(im, 0.75)
    im.save(path, "PNG")
    print("ok", path, os.path.getsize(path))


def paint_fountain(path):
    w, h = 360, 380
    im = canvas(w, h)
    im = ground_shadow(im, 180, 350, 140, 22, 70)
    lay, dr = layer_draw(im)
    # basins bottom to top
    def basin(cx, cy, rx, ry, rim):
        ellipse(dr, (cx - rx, cy - ry * 0.45, cx + rx, cy + ry), rim)
        ellipse(dr, (cx - rx + 10, cy - ry * 0.35, cx + rx - 10, cy + ry - 8), WATER)
        ellipse(dr, (cx - rx + 22, cy - ry * 0.15, cx + rx * 0.15, cy + ry * 0.35), (190, 230, 240, 90))
        # rim highlight TL
        dr.arc((cx - rx, cy - ry * 0.45, cx + rx, cy + ry), 200, 330, fill=rgba(STONE_L), width=5)

    basin(180, 300, 150, 70, (168, 186, 196))
    basin(180, 230, 100, 48, (176, 194, 204))
    basin(180, 176, 56, 30, (186, 202, 212))
    # spout
    rect(dr, (172, 120, 188, 176), (170, 188, 198))
    ellipse(dr, (166, 108, 194, 132), WATER)
    # droplets
    for dx, dy in ((-8, 140), (14, 150), (0, 160), (-16, 200), (18, 210)):
        ellipse(dr, (176 + dx, dy, 184 + dx, dy + 10), (150, 220, 240, 140))
    im = paste(im, lay)
    im = grain(im, 6, 55)
    im = soft(im, 0.6)
    im.save(path, "PNG")
    print("ok", path, os.path.getsize(path))


def paint_gatehouse(path):
    w, h = 720, 520
    im = canvas(w, h)
    im = ground_shadow(im, 360, 500, 300, 26, 80)
    lay, dr = layer_draw(im)

    def sq_tower(x0, y0, x1, y1, seed):
        stone_fill(dr, x0, y0, x1, y1, STONE, seed)
        crenel(dr, x0 - 4, y0, x1 + 4, 18, STONE_L)
        rect(dr, ((x0 + x1) / 2 - 8, y0 + 30, (x0 + x1) / 2 + 8, y0 + 70), (40, 36, 32))
        window(dr, (x0 + x1) / 2 - 10, y0 + 100, 18, 28)
        window(dr, (x0 + x1) / 2 - 10, y0 + 170, 18, 28)

    sq_tower(40, 80, 200, 490, 2)
    sq_tower(520, 80, 680, 490, 3)
    # middle hall
    stone_fill(dr, 190, 160, 530, 490, STONE_D, 4)
    crenel(dr, 190, 160, 530, 16, STONE)
    # three arches
    for ax in (230, 330, 430):
        rect(dr, (ax, 300, ax + 80, 490), (32, 28, 24))
        ellipse(dr, (ax, 250, ax + 80, 370), (32, 28, 24))
        # inner highlight
        ellipse(dr, (ax + 10, 270, ax + 70, 360), (20, 16, 14))
    im = paste(im, lay)
    im = grain(im, 8, 66)
    im = soft(im, 0.7)
    im.save(path, "PNG")
    print("ok", path, os.path.getsize(path))


def paint_tower(path):
    w, h = 280, 440
    im = canvas(w, h)
    im = ground_shadow(im, 140, 422, 90, 18, 70)
    lay, dr = layer_draw(im)
    cx = 140
    stone_fill(dr, 70, 150, 210, 410, STONE, 9)
    rect(dr, (160, 150, 210, 410), (0, 0, 0, 30))
    rect(dr, (70, 150, 110, 410), (255, 245, 230, 22))
    # rounded hint
    ellipse(dr, (70, 130, 210, 180), STONE)
    cone(dr, cx, 28, 86, 158, TERR_L, TERR, TERR_D)
    flag(dr, cx, 14)
    window(dr, 126, 200, 16, 26)
    window(dr, 126, 270, 16, 26)
    window(dr, 126, 330, 16, 22)
    im = paste(im, lay)
    im = grain(im, 8, 77)
    im = soft(im, 0.65)
    im.save(path, "PNG")
    print("ok", path, os.path.getsize(path))


def paint_wall(path):
    w, h = 280, 200
    im = canvas(w, h)
    im = ground_shadow(im, 140, 188, 120, 14, 50)
    lay, dr = layer_draw(im)
    stone_fill(dr, 8, 50, 272, 186, STONE, 14)
    crenel(dr, 8, 50, 272, 22, STONE_L)
    # TL wash
    rect(dr, (8, 50, 80, 186), (255, 245, 230, 18))
    im = paste(im, lay)
    im = grain(im, 7, 88)
    im = soft(im, 0.55)
    im.save(path, "PNG")
    print("ok", path, os.path.getsize(path))


def paint_tree(path):
    w, h = 300, 380
    im = canvas(w, h)
    im = ground_shadow(im, 150, 360, 80, 16, 70)
    # trunk
    lay, dr = layer_draw(im)
    poly(dr, [(136, 220), (158, 220), (168, 355), (122, 355)], (96, 64, 36))
    poly(dr, [(136, 220), (148, 220), (142, 350)], (128, 88, 50))
    im = paste(im, lay)
    # foliage clusters, overlap-friendly
    clusters = [
        (40, 40, 210, 210, LEAF_D, 6),
        (90, 20, 270, 190, LEAF, 8),
        (30, 90, 190, 250, LEAF, 7),
        (120, 80, 280, 250, LEAF_D, 5),
        (70, 50, 200, 180, LEAF_L, 10),
        (150, 40, 250, 160, lit(LEAF_L, 10), 8),
        (50, 120, 160, 230, lit(LEAF, -8), 6),
        (160, 130, 270, 240, LEAF, 7),
    ]
    for box in clusters:
        im = blob(im, box[:4], box[4], box[5])
    # highlight blobs TL
    im = blob(im, (80, 50, 150, 120), (190, 230, 130, 70), 8)
    im = grain(im, 7, 99)
    im = soft(im, 0.55)
    im.save(path, "PNG")
    print("ok", path, os.path.getsize(path))


def main():
    paint_house(os.path.join(OUT, "house.png"))
    paint_shop(os.path.join(OUT, "shop_west.png"), AWN_ROSE)
    paint_shop(os.path.join(OUT, "shop_east.png"), AWN_MINT)
    paint_castle(os.path.join(OUT, "castle.png"))
    paint_church(os.path.join(OUT, "church.png"))
    paint_fountain(os.path.join(OUT, "fountain.png"))
    paint_gatehouse(os.path.join(OUT, "gatehouse.png"))
    paint_tower(os.path.join(OUT, "tower.png"))
    paint_wall(os.path.join(OUT, "wall.png"))
    paint_tree(os.path.join(OUT, "tree.png"))
    print("city sprites ready in", OUT)


if __name__ == "__main__":
    main()
