# Field monster 8-direction sprites

Cute 3D chibi. 5 drawn views + horizontal flip = 8 walk facings.

## Files
assets/mobs/<id>_{s,n,e,se,ne}.png
base drawn: s, n, e, se, ne
flips: w = e, sw = se, nw = ne

Fallback: assets/mobs/<id>.png if a dir file is missing.

## Facing map (mobs only, not heroes)
Do not reuse hero FX.facingArt (heroes map ne/nw to n). Use FX.mobFacingArt.

## Status (2026-08-26)
All 15 field ids have 5 views on disk (75 PNGs, RGBA ~1536x1024, magenta knockout):
poring, fabre, lunatic, willow, condor, wolf, poporing, chonchon, roda_frog, spore, rocker, steel_chonchon, savage_babe, elder_willow, skeleton.

Map scale: field mobs 280%, hero 300%, bosses 360%.
