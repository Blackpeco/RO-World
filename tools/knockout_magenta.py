
from PIL import Image
import os, sys

def dist2(a, b):
    return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2

def sample_corners(im, inset=20):
    w, h = im.size
    px = im.load()
    samples = []
    boxes = [(0,0,inset,inset),(w-inset,0,w,inset),(0,h-inset,inset,h),(w-inset,h-inset,w,h)]
    for x0,y0,x1,y1 in boxes:
        rs=gs=bs=n=0
        for y in range(y0,y1):
            for x in range(x0,x1):
                r,g,b = px[x,y][:3]
                rs+=r; gs+=g; bs+=b; n+=1
        samples.append((rs//n, gs//n, bs//n))
    return samples

def is_magenta(p, samples):
    r,g,b = p[:3]
    if r >= 180 and b >= 160 and g <= 90 and (r+b) > g*3 + 80:
        return True
    if r >= 200 and b >= 180 and g <= 120:
        return True
    for s in samples:
        if dist2((r,g,b), s) <= 48*48:
            return True
        if dist2((r,g,b), s) <= 72*72 and g < 140 and r > 160 and b > 140:
            return True
    return False

def knockout(src, dest):
    im = Image.open(src).convert("RGBA")
    w,h = im.size
    px = im.load()
    samples = sample_corners(im)
    out = Image.new("RGBA", (w,h), (0,0,0,0))
    opx = out.load()
    kept = 0
    for y in range(h):
        for x in range(w):
            p = px[x,y]
            if is_magenta(p, samples):
                opx[x,y] = (p[0], p[1], p[2], 0)
            else:
                opx[x,y] = (p[0], p[1], p[2], 255)
                kept += 1
    for y in range(1,h-1):
        for x in range(1,w-1):
            r,g,b,a = opx[x,y]
            if a == 0:
                continue
            neigh = 0
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                if opx[x+dx,y+dy][3] == 0:
                    neigh += 1
            if neigh >= 1 and r > 160 and b > 140 and g < 150:
                opx[x,y] = (r,g,b, 0 if neigh >= 2 else 180)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    out.save(dest, "PNG")
    print(dest, out.size, os.path.getsize(dest), "kept", kept)
    return dest

if __name__ == "__main__":
    pairs = zip(sys.argv[1::2], sys.argv[2::2])
    for src, dest in pairs:
        knockout(src, dest)
