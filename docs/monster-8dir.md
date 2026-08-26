# Field monster 8-direction sprites

Cute 3D chibi. 5 drawn views + horizontal flip = 8 walk facings.

## Files
assets/mobs/<id>_<base>.png
base drawn: n, ne, e, se, s
flips: w = e, sw = se, nw = ne

Fallback: assets/mobs/<id>.png

## Facing map (mobs only, not heroes)
n, ne, e, se, s unique
w = e + flip
sw = se + flip
nw = ne + flip

## Status
poring: 5 views landed
remaining 14: generating
