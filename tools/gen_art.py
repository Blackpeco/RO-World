#!/usr/bin/env python3
"""Download dark-fantasy portraits/icons and save as PNG under assets/."""
import os, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHAR = os.path.join(ROOT, "assets", "chars")
SKILL = os.path.join(ROOT, "assets", "skills")
os.makedirs(CHAR, exist_ok=True)
os.makedirs(SKILL, exist_ok=True)

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
     "2.5D ARPG game character full body three-quarter view, slightly 3D rendered standing void angel, visible depth, fallen dark angel with tattered black-violet wings, cracked silver crown, pale porcelain skin, glowing violet eyes, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
    ("dragon.png", 768, 1024,
     "2.5D ARPG game monster full body three-quarter view, slightly 3D rendered standing world-ending dragon, visible depth, colossal apocalyptic dragon rearing, obsidian scales, molten cracks, dark studio background, game asset, not photoreal, not oil painting portrait, not chibi, no text, no watermark, no letters, no logo"),
]

SKILLS = [
    ("attack.png", "dark fantasy game skill icon, square, ornate gold frame, steel sword slash slash-arc, sparks, no text no letters no watermark"),
    ("magifireblade.png", "dark fantasy game skill icon, square, ornate gold frame, flaming magic sword engulfed in fire, no text no letters no watermark"),
    ("guard.png", "dark fantasy game skill icon, square, ornate gold frame, glowing magic kite shield, runes, no text no letters no watermark"),
    ("heal.png", "dark fantasy game skill icon, square, ornate gold frame, holy glowing cross of light, warm gold, no text no letters no watermark"),
    ("stab.png", "dark fantasy game skill icon, square, ornate gold frame, single dark dagger stab, steel blade, no text no letters no watermark"),
    ("shadowkill.png", "dark fantasy game skill icon, square, ornate gold frame, poison green mist and skull, toxic, no text no letters no watermark"),
    ("veil.png", "dark fantasy game skill icon, square, ornate gold frame, shadow cloak swirling darkness, no text no letters no watermark"),
    ("counter.png", "dark fantasy game skill icon, square, ornate gold frame, two crossed blades rebound clash sparks, no text no letters no watermark"),
    ("arrowshot.png", "dark fantasy game skill icon, square, ornate gold frame, single flying arrow, fletching, no text no letters no watermark"),
    ("powershot.png", "dark fantasy game skill icon, square, ornate gold frame, glowing charged longbow with energy, no text no letters no watermark"),
    ("focus.png", "dark fantasy game skill icon, square, ornate gold frame, glowing eye with crosshair aura, no text no letters no watermark"),
    ("soularrow.png", "dark fantasy game skill icon, square, ornate gold frame, spirit purple ghostly arrow, no text no letters no watermark"),
    ("boss_basic.png", "dark fantasy game skill icon, square, dark iron frame, generic monster claw strike, no text no letters no watermark"),
    ("boss_special.png", "dark fantasy game skill icon, square, dark iron frame, swirling special attack energy burst, no text no letters no watermark"),
    ("boss_buff.png", "dark fantasy game skill icon, square, dark iron frame, glowing self buff aura, no text no letters no watermark"),
    ("boss_ult.png", "dark fantasy game skill icon, square, dark iron frame, apocalyptic explosion skull fire, no text no letters no watermark"),
]

def fetch(prompt, w, h, dest, tries=4):
    if os.path.isfile(dest) and os.path.getsize(dest) > 8000:
        print("skip exists", dest)
        return True
    q = urllib.parse.quote(prompt)
    url = "https://image.pollinations.ai/prompt/%s?width=%d&height=%d&nologo=true&model=flux" % (q, w, h)
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "RagnarokATB/1.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            if len(data) < 2000:
                last = "tiny %d" % len(data)
                time.sleep(2)
                continue
            tmp = dest + ".tmp"
            with open(tmp, "wb") as f:
                f.write(data)
            # convert to png via pillow if available
            try:
                from PIL import Image
                im = Image.open(tmp)
                im = im.convert("RGB")
                im.save(dest, "PNG")
                os.remove(tmp)
            except Exception:
                os.replace(tmp, dest)
            print("ok", dest, os.path.getsize(dest))
            return True
        except Exception as e:
            last = str(e)
            print("retry", dest, last)
            time.sleep(2 + i * 2)
    print("FAIL", dest, last)
    return False

def main():
    ok = 0
    jobs = []
    for name, w, h, p in CHARS:
        jobs.append((p, w, h, os.path.join(CHAR, name)))
    for name, p in SKILLS:
        jobs.append((p, 512, 512, os.path.join(SKILL, name)))
    for j in jobs:
        if fetch(*j):
            ok += 1
        time.sleep(0.4)
    print("DONE %d/%d" % (ok, len(jobs)))
    return 0 if ok == len(jobs) else 1

if __name__ == "__main__":
    sys.exit(main())
