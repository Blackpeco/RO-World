# RO-World UI — classic window chrome

Direction locked 2026-08-26: Gravity-style RO windows over the map.
Not the current dark-gold rounded cards.

## Tokens

| Token | Hex | Use |
|---|---|---|
| parchment | `#f3e2b8` | window body |
| inner | `#efe0b0` | inset panels |
| frame | `#c9a35a` | gold mid-frame |
| outer | `#5c3d1a` | dark outer edge |
| hi | `#fff1c4` | top/left bevel |
| lo | `#8a6230` | bottom/right bevel |
| title0 | `#d8bc72` | title bar top |
| title1 | `#b8893a` | title bar bottom |
| ink | `#3a2410` | text |
| mute | `#6a5030` | secondary text |
| hp | `#c6e04a → #7aa818` | HP fill |
| sp | `#4aa0e0 → #1e5a9a` | SP/MP fill |
| exp | `#e0c040 → #a07a10` | EXP fill |
| slot | `#c4b07a` | item / skill inset |

Font: Noto Sans Thai, 11–13px. No Cinzel on window chrome.
Radius: 0–2px. No pills.

## Anatomy

1. Double beveled frame (light top-left, dark bottom-right).
2. Title bar: name left, `[.]` `[x]` right.
3. Cream body, dark-brown ink.
4. Slots are inset squares, not cards.

## First pass (field)

- Top-left: Basic Info (`ข้อมูล`) — face, name, Base/Job, HP/SP/EXP, weight, Zeno, ASPD
- Top-center: Target (`เป้า`)
- Bottom-center: shortcut 1–6
- Right: bag grid (`กระเป๋า`)
- Bottom-left: small menu buttons (bag / equip / skills / F / home)

Maps onto existing `UI.adventureHud`, `UI.rtStrip`, `UI.openBag`.
