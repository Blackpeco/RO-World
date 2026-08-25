"""Paint unique dark-fantasy PNGs if a download is missing."""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAR = os.path.join(ROOT, "assets", "chars")
SKILL = os.path.join(ROOT, "assets", "skills")

def noise(im, amt=18):
    rnd = random.Random(im.size[0] * 97 + im.size[1])
    px = im.load()
    w, h = im.size
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            j = rnd.randint(-amt, amt)
            px[x, y] = (max(0, min(255, r + j)), max(0, min(255, g + j)), max(0, min(255, b + j)))
    return im.filter(ImageFilter.SMOOTH_MORE)

def grad(w, h, c0, c1, vertical=True):
    im = Image.new("RGB", (w, h))
    dr = ImageDraw.Draw(im)
    for i in range(h if vertical else w):
        t = i / max(1, (h if vertical else w) - 1)
        c = tuple(int(a + (b - a) * t) for a, b in zip(c0, c1))
        if vertical:
            dr.line([(0, i), (w, i)], fill=c)
        else:
            dr.line([(i, 0), (i, h)], fill=c)
    return im

def vignette(im):
    w, h = im.size
    overlay = Image.new("RGB", (w, h), (0, 0, 0))
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse((-w * 0.15, -h * 0.1, w * 1.15, h * 1.2), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(80))
    return Image.composite(im, overlay, mask)

def blob(draw, xy, fill, outline=None):
    draw.ellipse(xy, fill=fill, outline=outline)

def paint_char(name, w=768, h=1024):
    pal = {
        "warrior": ((40, 22, 8), (12, 8, 6), (201, 162, 39), (139, 30, 30), (230, 210, 160)),
        "assassin": ((18, 8, 28), (6, 4, 10), (123, 63, 160), (20, 10, 30), (180, 140, 80)),
        "hunter": ((16, 32, 14), (6, 12, 6), (61, 139, 74), (90, 60, 30), (200, 190, 140)),
        "monster": ((40, 10, 8), (10, 4, 4), (194, 59, 34), (80, 30, 20), (220, 80, 40)),
        "golem": ((30, 28, 24), (10, 10, 8), (122, 116, 100), (60, 70, 50), (180, 170, 140)),
        "wolf": ((24, 28, 36), (8, 10, 14), (216, 212, 200), (160, 180, 200), (80, 140, 180)),
        "knight": ((28, 6, 8), (8, 2, 4), (139, 18, 18), (40, 10, 10), (180, 40, 40)),
        "demon": ((36, 8, 4), (10, 2, 2), (255, 77, 0), (80, 10, 10), (255, 180, 40)),
        "angel": ((22, 10, 36), (8, 4, 16), (180, 140, 255), (40, 20, 70), (220, 200, 255)),
        "dragon": ((20, 6, 4), (6, 2, 2), (255, 80, 20), (40, 8, 6), (255, 160, 40)),
    }[name]
    bg0, bg1, accent, dark, light = pal
    im = grad(w, h, bg0, bg1)
    dr = ImageDraw.Draw(im, "RGBA")
    # atmosphere
    for i in range(8):
        blob(dr, (w*0.1+i*20, h*0.05+i*10, w*0.9-i*10, h*0.55+i*8), accent + (18,))
    # torso
    cx, cy = w // 2, int(h * 0.62)
    blob(dr, (cx - 150, cy - 180, cx + 150, h + 20), dark + (255,))
    # shoulders
    blob(dr, (cx - 220, cy - 160, cx - 20, cy + 40), accent + (220,))
    blob(dr, (cx + 20, cy - 160, cx + 220, cy + 40), accent + (220,))
    # head
    hx, hy = cx, int(h * 0.32)
    blob(dr, (hx - 90, hy - 110, hx + 90, hy + 90), light + (255,))
    if name == "warrior":
        # helm + sword
        dr.polygon([(hx - 100, hy - 40), (hx, hy - 160), (hx + 100, hy - 40)], fill=accent)
        dr.rectangle((cx + 120, 180, cx + 155, h - 80), fill=(180, 180, 190))
        dr.polygon([(cx + 90, 160), (cx + 185, 160), (cx + 138, 80)], fill=accent)
    elif name == "assassin":
        dr.polygon([(hx - 120, hy + 40), (hx, hy - 170), (hx + 120, hy + 40)], fill=dark)
        dr.polygon([(cx - 200, cy), (cx - 40, cy - 40), (cx - 80, cy + 20)], fill=(90, 90, 100))
        dr.polygon([(cx + 200, cy), (cx + 40, cy - 40), (cx + 80, cy + 20)], fill=(90, 90, 100))
        blob(dr, (hx - 40, hy - 10, hx - 10, hy + 16), (255, 160, 40, 255))
        blob(dr, (hx + 10, hy - 10, hx + 40, hy + 16), (255, 160, 40, 255))
    elif name == "hunter":
        dr.polygon([(hx - 110, hy + 30), (hx - 20, hy - 150), (hx + 80, hy + 20)], fill=accent)
        dr.arc((cx + 80, 200, cx + 280, 700), 200, 340, fill=light, width=10)
        # hawk
        blob(dr, (cx + 130, hy - 40, cx + 230, hy + 50), (90, 70, 40, 255))
        blob(dr, (cx + 200, hy - 20, cx + 250, hy + 10), (200, 160, 60, 255))
    elif name == "monster":
        blob(dr, (hx - 130, hy - 80, hx + 130, hy + 120), (80, 30, 20, 255))
        dr.polygon([(hx - 80, hy - 70), (hx - 40, hy - 180), (hx - 10, hy - 70)], fill=light)
        dr.polygon([(hx + 80, hy - 70), (hx + 40, hy - 180), (hx + 10, hy - 70)], fill=light)
        blob(dr, (hx - 50, hy - 10, hx - 10, hy + 20), (220, 30, 20, 255))
        blob(dr, (hx + 10, hy - 10, hx + 50, hy + 20), (220, 30, 20, 255))
    elif name == "golem":
        for dx, dy, s in [(-80, -40, 140), (40, -80, 160), (-20, 40, 180), (70, 60, 120)]:
            blob(dr, (cx + dx, cy + dy - 200, cx + dx + s, cy + dy - 200 + s), (110, 105, 90, 255))
        dr.line((cx - 40, hy, cx + 40, hy + 80), fill=(180, 220, 120), width=8)
    elif name == "wolf":
        blob(dr, (hx - 140, hy - 40, hx + 140, hy + 140), (230, 228, 220, 255))
        dr.polygon([(hx - 120, hy - 20), (hx - 70, hy - 160), (hx - 20, hy - 10)], fill=(240, 240, 235))
        dr.polygon([(hx + 120, hy - 20), (hx + 70, hy - 160), (hx + 20, hy - 10)], fill=(240, 240, 235))
        blob(dr, (hx - 50, hy + 10, hx - 15, hy + 40), (80, 160, 220, 255))
        blob(dr, (hx + 15, hy + 10, hx + 50, hy + 40), (80, 160, 220, 255))
    elif name == "knight":
        dr.polygon([(hx - 110, hy - 30), (hx, hy - 170), (hx + 110, hy - 30)], fill=(40, 10, 10))
        dr.rectangle((hx - 70, hy - 20, hx + 70, hy + 50), fill=(20, 8, 8))
        dr.rectangle((cx + 130, 160, cx + 165, h - 60), fill=(90, 20, 20))
        blob(dr, (cx + 110, 140, cx + 185, 210), accent + (255,))
    elif name == "demon":
        dr.polygon([(hx - 130, hy - 20), (hx - 90, hy - 200), (hx - 40, hy - 30)], fill=(40, 8, 8))
        dr.polygon([(hx + 130, hy - 20), (hx + 90, hy - 200), (hx + 40, hy - 30)], fill=(40, 8, 8))
        blob(dr, (hx - 40, hy - 10, hx - 5, hy + 20), (255, 120, 0, 255))
        blob(dr, (hx + 5, hy - 10, hx + 40, hy + 20), (255, 120, 0, 255))
        dr.polygon([(hx - 60, hy - 90), (hx, hy - 150), (hx + 60, hy - 90)], fill=accent)
    elif name == "angel":
        dr.polygon([(hx - 180, hy + 20), (hx - 40, hy - 80), (hx - 20, hy + 40)], fill=(200, 190, 230, 220))
        dr.polygon([(hx + 180, hy + 20), (hx + 40, hy - 80), (hx + 20, hy + 40)], fill=(200, 190, 230, 220))
        dr.polygon([(hx - 50, hy - 80), (hx, hy - 160), (hx + 50, hy - 80)], fill=accent)
        blob(dr, (hx - 30, hy - 10, hx - 5, hy + 16), (180, 160, 255, 255))
        blob(dr, (hx + 5, hy - 10, hx + 30, hy + 16), (180, 160, 255, 255))
    elif name == "dragon":
        dr.polygon([(hx - 140, hy - 10), (hx - 80, hy - 210), (hx - 20, hy - 20)], fill=(40, 10, 8))
        dr.polygon([(hx + 140, hy - 10), (hx + 80, hy - 210), (hx + 20, hy - 20)], fill=(40, 10, 8))
        blob(dr, (hx - 50, hy - 10, hx - 10, hy + 24), (255, 80, 20, 255))
        blob(dr, (hx + 10, hy - 10, hx + 50, hy + 24), (255, 80, 20, 255))
        dr.polygon([(hx - 40, hy + 40), (hx + 40, hy + 40), (hx, hy + 120)], fill=accent)
    im = im.convert("RGB")
    im = noise(im, 14)
    im = vignette(im)
    im = ImageEnhance.Color(im).enhance(1.15)
    im = ImageEnhance.Contrast(im).enhance(1.12)
    return im.filter(ImageFilter.SMOOTH)

def paint_skill(name, w=512, h=512):
    pal = {
        "attack": ((30, 20, 10), (200, 180, 80), (180, 180, 190)),
        "magifireblade": ((40, 10, 4), (255, 120, 20), (255, 200, 60)),
        "guard": ((16, 20, 36), (80, 140, 220), (240, 210, 120)),
        "heal": ((20, 24, 16), (240, 210, 90), (255, 250, 200)),
        "stab": ((16, 10, 20), (90, 90, 100), (200, 200, 210)),
        "shadowkill": ((10, 20, 8), (80, 180, 60), (30, 30, 30)),
        "veil": ((12, 8, 22), (90, 40, 140), (20, 10, 30)),
        "counter": ((24, 10, 10), (220, 60, 40), (200, 200, 200)),
        "arrowshot": ((20, 24, 16), (180, 150, 80), (210, 210, 200)),
        "powershot": ((16, 22, 28), (80, 180, 255), (240, 220, 120)),
        "focus": ((18, 16, 8), (240, 200, 60), (80, 200, 120)),
        "soularrow": ((18, 8, 28), (160, 80, 220), (220, 180, 255)),
        "boss_basic": ((20, 10, 10), (180, 50, 40), (200, 180, 160)),
        "boss_special": ((16, 12, 28), (160, 80, 220), (255, 180, 60)),
        "boss_buff": ((16, 20, 16), (80, 200, 120), (240, 210, 100)),
        "boss_ult": ((20, 6, 6), (255, 60, 20), (40, 0, 0)),
        "blade_storm": ((28, 14, 6), (220, 180, 70), (240, 230, 180)),
        "sanctuary": ((16, 22, 18), (240, 210, 90), (180, 230, 160)),
        "nightfall": ((12, 8, 22), (90, 40, 160), (160, 80, 220)),
        "phantom": ((10, 10, 18), (160, 170, 200), (80, 80, 110)),
        "rain": ((12, 20, 28), (80, 170, 230), (220, 230, 240)),
        "mark": ((20, 16, 8), (230, 170, 50), (80, 160, 80)),
    }[name]
    bg, a, b = pal
    im = grad(w, h, bg, tuple(max(0, x - 20) for x in bg))
    dr = ImageDraw.Draw(im, "RGBA")
    dr.rounded_rectangle((18, 18, w - 18, h - 18), 28, outline=a + (255,), width=10)
    dr.rounded_rectangle((32, 32, w - 32, h - 32), 22, outline=b + (180,), width=3)
    cx, cy = w // 2, h // 2
    if name in ("attack", "magifireblade"):
        dr.polygon([(cx - 30, 80), (cx + 30, 80), (cx + 18, 300), (cx - 18, 300)], fill=b)
        dr.polygon([(cx - 70, 70), (cx + 70, 70), (cx, 30)], fill=a)
        if name == "magifireblade":
            blob(dr, (cx - 60, 90, cx + 60, 280), a + (90,))
    elif name == "guard":
        dr.polygon([(cx, 70), (cx + 130, 140), (cx + 90, 360), (cx, 420), (cx - 90, 360), (cx - 130, 140)], fill=a)
        dr.polygon([(cx, 110), (cx + 80, 160), (cx + 55, 320), (cx, 370), (cx - 55, 320), (cx - 80, 160)], fill=b)
    elif name == "heal":
        dr.rectangle((cx - 28, 90, cx + 28, 420), fill=a)
        dr.rectangle((90, cy - 28, 422, cy + 28), fill=a)
        blob(dr, (cx - 80, cy - 80, cx + 80, cy + 80), b + (80,))
    elif name == "stab":
        dr.polygon([(cx - 18, 70), (cx + 18, 70), (cx + 8, 340), (cx - 8, 340)], fill=b)
        dr.polygon([(cx, 40), (cx + 22, 80), (cx - 22, 80)], fill=b)
        dr.rectangle((cx - 50, 330, cx + 50, 360), fill=a)
    elif name == "shadowkill":
        blob(dr, (120, 140, 392, 420), a + (200,))
        blob(dr, (170, 90, 340, 260), (20, 20, 20, 230))
        dr.ellipse((200, 160, 250, 210), fill=a)
        dr.ellipse((270, 160, 320, 210), fill=a)
    elif name == "veil":
        dr.polygon([(cx - 140, 420), (cx, 80), (cx + 140, 420)], fill=a)
        dr.polygon([(cx - 80, 400), (cx, 140), (cx + 80, 400)], fill=b)
    elif name == "counter":
        dr.polygon([(80, 120), (220, 90), (200, 400), (90, 360)], fill=b)
        dr.polygon([(432, 120), (292, 90), (312, 400), (422, 360)], fill=a)
    elif name in ("arrowshot", "soularrow", "powershot"):
        col = a if name != "soularrow" else a
        dr.polygon([(cx, 60), (cx + 22, 140), (cx - 22, 140)], fill=col)
        dr.rectangle((cx - 8, 130, cx + 8, 400), fill=b)
        dr.polygon([(cx - 40, 400), (cx + 40, 400), (cx, 460)], fill=col)
        if name == "powershot":
            dr.arc((80, 80, 432, 420), 200, 340, fill=a, width=16)
    elif name == "focus":
        blob(dr, (140, 140, 372, 372), a + (200,))
        blob(dr, (190, 190, 322, 322), (20, 16, 8, 255))
        blob(dr, (230, 230, 282, 282), b + (255,))
        dr.line((cx, 60, cx, 452), fill=b, width=4)
        dr.line((60, cy, 452, cy), fill=b, width=4)
    elif name == "boss_basic":
        dr.polygon([(80, 200), (240, 160), (300, 280), (200, 400), (90, 340)], fill=a)
        dr.polygon([(120, 170), (200, 80), (230, 180)], fill=b)
    elif name == "boss_special":
        blob(dr, (110, 110, 402, 402), a + (180,))
        blob(dr, (180, 180, 332, 332), b + (200,))
    elif name == "boss_buff":
        blob(dr, (140, 140, 372, 372), a + (160,))
        dr.polygon([(cx, 80), (cx + 30, 200), (cx - 30, 200)], fill=b)
    elif name == "boss_ult":
        blob(dr, (80, 80, 432, 432), a + (200,))
        blob(dr, (160, 140, 352, 360), (20, 0, 0, 255))
        dr.ellipse((190, 190, 240, 240), fill=a)
        dr.ellipse((272, 190, 322, 240), fill=a)
    elif name == "blade_storm":
        dr.polygon([(80, 90), (200, 70), (180, 400), (70, 360)], fill=b)
        dr.polygon([(432, 90), (292, 70), (312, 400), (422, 360)], fill=a)
        dr.polygon([(cx - 20, 60), (cx + 20, 60), (cx + 8, 380), (cx - 8, 380)], fill=b)
    elif name == "sanctuary":
        dr.polygon([(cx, 70), (cx + 130, 140), (cx + 90, 360), (cx, 420), (cx - 90, 360), (cx - 130, 140)], fill=a)
        dr.rectangle((cx - 24, 160, cx + 24, 340), fill=b)
        dr.rectangle((160, cy - 24, 352, cy + 24), fill=b)
    elif name == "nightfall":
        blob(dr, (90, 90, 422, 422), a + (180,))
        blob(dr, (160, 140, 352, 360), (20, 10, 30, 230))
        dr.polygon([(cx - 14, 80), (cx + 14, 80), (cx + 6, 300), (cx - 6, 300)], fill=b)
        blob(dr, (cx - 70, 280, cx + 70, 430), a + (140,))
    elif name == "phantom":
        dr.polygon([(cx - 140, 420), (cx, 70), (cx + 140, 420)], fill=a)
        dr.polygon([(cx - 70, 400), (cx + 20, 120), (cx + 90, 400)], fill=b)
        blob(dr, (cx - 40, 140, cx + 50, 240), (240, 240, 255, 90))
    elif name == "rain":
        for dx in (-90, 0, 90):
            dr.polygon([(cx + dx, 70), (cx + dx + 16, 130), (cx + dx - 16, 130)], fill=a)
            dr.rectangle((cx + dx - 6, 120, cx + dx + 6, 360), fill=b)
            dr.polygon([(cx + dx - 28, 360), (cx + dx + 28, 360), (cx + dx, 420)], fill=a)
    elif name == "mark":
        blob(dr, (120, 120, 392, 392), a + (200,))
        blob(dr, (190, 190, 322, 322), (20, 16, 8, 255))
        blob(dr, (230, 230, 282, 282), b + (255,))
        dr.polygon([(cx - 18, 60), (cx + 18, 60), (cx, 140)], fill=a)
        dr.polygon([(cx - 70, 90), (cx - 30, 70), (cx - 50, 160)], fill=b)
    im = im.convert("RGB")
    return noise(im, 10).filter(ImageFilter.SMOOTH)

def ensure():
    os.makedirs(CHAR, exist_ok=True)
    os.makedirs(SKILL, exist_ok=True)
    made = []
    for n in ["warrior","assassin","hunter","monster","golem","wolf","knight","demon","angel","dragon"]:
        dest = os.path.join(CHAR, n + ".png")
        if not (os.path.isfile(dest) and os.path.getsize(dest) > 8000):
            paint_char(n).save(dest, "PNG")
            made.append(dest)
    for n in ["attack","magifireblade","guard","heal","stab","shadowkill","veil","counter",
              "arrowshot","powershot","focus","soularrow","blade_storm","sanctuary","nightfall",
              "phantom","rain","mark","boss_basic","boss_special","boss_buff","boss_ult"]:
        dest = os.path.join(SKILL, n + ".png")
        if not (os.path.isfile(dest) and os.path.getsize(dest) > 4000):
            paint_skill(n).save(dest, "PNG")
            made.append(dest)
    print("painted", len(made), "missing")
    for m in made:
        print(" ", m, os.path.getsize(m))

if __name__ == "__main__":
    ensure()
