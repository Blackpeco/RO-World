#!/usr/bin/env python3
"""Force-regenerate full-body 2.5D character art (overwrite existing)."""
import os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAR = os.path.join(ROOT, "assets", "chars")
os.makedirs(CHAR, exist_ok=True)

# 2.5D ARPG standing fighters, 3/4 view, full body, dark studio, no text
CHARS = [
    ("warrior.png", 768, 1024,
     "2.5D ARPG game character full body three-quarter view, slightly 3D rendered standing fighter, visible depth, brave golden armored knight warrior holding ornate longsword, gold plate armor, red cape, heroic stance, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
    ("assassin.png", 768, 1024,
     "2.5D ARPG game character full body three-quarter view, slightly 3D rendered standing fighter, visible depth, hooded shadow assassin in black purple cloak, dual daggers, face hidden in hood, glowing amber eyes, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
    ("hunter.png", 768, 1024,
     "2.5D ARPG game character full body three-quarter view, slightly 3D rendered standing fighter, visible depth, green cloak forest hunter ranger with longbow and hawk on shoulder, leather armor, standing pose, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
    ("monster.png", 768, 1024,
     "2.5D ARPG game monster full body three-quarter view, slightly 3D rendered standing beast, visible depth, feral monstrous dragon-beast snarling fangs claws, wild mane, blood red eyes, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
    ("golem.png", 768, 1024,
     "2.5D ARPG game monster full body three-quarter view, slightly 3D rendered standing golem, visible depth, massive ancient stone golem, mossy rocks, glowing runic cracks, boulder fists, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
    ("wolf.png", 768, 1024,
     "2.5D ARPG game monster full body three-quarter view, slightly 3D rendered standing wolf, visible depth, huge white fur dire wolf boss on hind legs, icy blue eyes, frost mist, fangs, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
    ("knight.png", 768, 1024,
     "2.5D ARPG game character full body three-quarter view, slightly 3D rendered standing fighter, visible depth, blood-iron knight in crimson dark steel armor, closed helm visor, blood stained greatsword, ominous stance, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
    ("demon.png", 768, 1024,
     "2.5D ARPG game character full body three-quarter view, slightly 3D rendered standing demon king, visible depth, large horns, crown of fire, dark red black armor, infernal flames, terrifying majesty, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
    ("angel.png", 768, 1024,
     "2.5D ARPG game character full body three-quarter view, slightly 3D rendered standing void angel, visible depth, fallen dark angel with tattered black-violet wings, cracked silver crown, pale porcelain skin, glowing violet eyes, death-halo, ornate void armor, ominous grace, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
    ("dragon.png", 768, 1024,
     "2.5D ARPG game monster full body three-quarter view, slightly 3D rendered standing world-ending dragon, visible depth, colossal apocalyptic dragon rearing, obsidian scales, molten cracks, world-breaker horns, fire and void aura, terrifying majesty, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
]

def fetch(prompt, w, h, dest, tries=5):
    q = urllib.parse.quote(prompt)
    # unique seed so we do not get cached old portraits
    seed = abs(hash(os.path.basename(dest) + "25d-v2")) % 999999
    url = "https://image.pollinations.ai/prompt/%s?width=%d&height=%d&nologo=true&model=flux&seed=%d" % (q, w, h, seed)
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
                from PIL import Image
                im = Image.open(tmp)
                im = im.convert("RGB")
                im.save(dest, "PNG")
                os.remove(tmp)
            except Exception:
                os.replace(tmp, dest)
            print("ok", dest, os.path.getsize(dest), flush=True)
            return True
        except Exception as e:
            last = str(e)
            print("retry", dest, last, flush=True)
            time.sleep(2 + i * 2)
    print("FAIL", dest, last, flush=True)
    return False

def main():
    ok = 0
    for name, w, h, p in CHARS:
        dest = os.path.join(CHAR, name)
        if fetch(p, w, h, dest):
            ok += 1
        time.sleep(0.3)
    print("DONE %d/%d" % (ok, len(CHARS)), flush=True)
    return 0 if ok == len(CHARS) else 1

if __name__ == "__main__":
    sys.exit(main())
