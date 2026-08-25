# RO-World combat SFX

Original synthesized hits (numpy + ffmpeg libvorbis). No sampled copyright audio.
All files: Ogg Vorbis, 44100 Hz, stereo, peak normalized to −1 dBFS.

| filename | duration | what it is | when to play |
|---|---|---|---|
| `hit_slash.ogg` | 0.255s | Metallic sword clang + short flesh/jelly thud. Classic RO melee homage, original. | Player swing-land: play when a hero melee hit connects with a monster (dmg event). Safe at 7 hits/sec. |
| `mob_poring_attack.ogg` | 0.245s | Cute high slime hop/splat — bouncy, wet. | Mob hits player: field mob id poring. |
| `mob_fabre_attack.ogg` | 0.235s | Bug nibble + leaf rustle bite. | Mob hits player: field mob id fabre. |
| `mob_lunatic_attack.ogg` | 0.235s | Rabbit scratch/kick — short squeak + thud. | Mob hits player: field mob id lunatic. |
| `mob_willow_attack.ogg` | 0.265s | Wood creak + root slap. | Mob hits player: field mob id willow. |
| `mob_condor_attack.ogg` | 0.255s | Wing flap + peck. | Mob hits player: field mob id condor. |
| `mob_wolf_attack.ogg` | 0.285s | Growl + bite. | Mob hits player: field mob id wolf. |
| `mob_poporing_attack.ogg` | 0.255s | Wetter/acid slime hop, lower than poring. | Mob hits player: field mob id poporing. |
| `mob_chonchon_attack.ogg` | 0.248s | Buzz + dive bonk. | Mob hits player: field mob id chonchon. |
| `mob_roda_frog_attack.ogg` | 0.270s | Tongue whip + slam. | Mob hits player: field mob id roda_frog. |
| `mob_spore_attack.ogg` | 0.295s | Puff / spore cloud — airy, magic. | Mob hits player: field mob id spore. |
| `mob_rocker_attack.ogg` | 0.250s | Cricket strum + screech. | Mob hits player: field mob id rocker. |
| `mob_steel_chonchon_attack.ogg` | 0.255s | Heavy metal buzz + ram. | Mob hits player: field mob id steel_chonchon. |
| `mob_savage_babe_attack.ogg` | 0.290s | Gore / charge grunt. | Mob hits player: field mob id savage_babe. |
| `mob_elder_willow_attack.ogg` | 0.290s | Burning branch crack + flame whoosh. | Mob hits player: field mob id elder_willow. |
| `mob_skeleton_attack.ogg` | 0.230s | Bone rattle slash. | Mob hits player: field mob id skeleton. |
| `ui_refine_hit.ogg` | 0.235s | Hammer-on-anvil clang + short wood/anvil body. Classic RO smith homage, original metal-on-metal workshop. | Player clicks ตีบวก (refine): play on each refine strike. |
| `ui_refine_ok.ogg` | 0.455s | Bright sparkle / holy chime / small fanfare — high, clear, rewarding. | Refine SUCCESS. |
| `ui_refine_fail.ogg` | 0.355s | Dull muted thud + short descending tone. Disappointing, not catastrophic (item is safe). | Refine FAIL (safe: plus stays, only Zeno lost). |

## Notes

- `hit_slash.ogg` is gated so the body is gone by ~180 ms and the file is silent by 280 ms — safe to overlap at 7 hits/sec.
- Each mob file is a unique pitch/texture family so field packs do not blend into one hit sound.
- Start padding is under 20 ms. Fade to digital zero at the end of every file.
- `ui_refine_hit.ogg` / `ui_refine_ok.ogg` / `ui_refine_fail.ogg` are UI refine cues (smith workshop / success chime / safe-fail thud). Fail is disappointing, not catastrophic — the item does not break.
