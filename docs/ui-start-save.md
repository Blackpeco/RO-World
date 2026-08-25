# RO-World UI — start flow, save, map menus (locked 2026-08-26)

Kirito: merge this into the live game. UI chrome tokens stay as docs/ui-chrome.md.

## Start flow

1. **เลือกตัวละคร** (new, first screen)
   - Cards of saved accounts (portrait, charName, job, Base/Job lv, username)
   - สร้างตัวละครใหม่ → job select
   - Form: username + เล่นต่อ → load that save
2. **เลือกอาชีพ** (existing, back returns to char select)
3. **ตั้งชื่อ** Thai, 1–24 graphemes
4. **STATUS** start alloc
5. **เมืองพรอนเทรา** (or last mapId on load)

## Save / load

- Store: `localStorage["ro-world-accounts-v1"]` = `{ [username]: save }`
- Last user: `localStorage["ro-world-last-user"]`
- Username: 1–24 graphemes, Thai + latin + digits + `_` `-`
- SAVE overlay (dock button, no hotkey — S is walk south)
- `PVE.writeAccount` / `readAccount` / `listAccounts` / `validateUsername`

## Map menus (every zone: city, field, bosses)

Right dock always visible:

| Button | Hotkey | Window |
|---|---|---|
| SKILL | K | skill overlay |
| STATUS | C | alloc overlay |
| FARM | F toggles on/off (HUD F opens window) | auto farm settings — see ui-farm-inv.md |
| INV | I | inventory tabs |
| สวมใส่ | E | equip |
| ร้านอุปกรณ์ | R | shop (R again → potions → close) |
| ตีบวก | — | refine |
| ร้านยา | R (cycle) | potions |
| SAVE | — | username save |

Hotkeys work on any live map (`App.screen === "map"`), not city-only. Same key closes. Title-bar drag + last position stay.

## Camera

45×33 tiles, fills the viewport. No letterbox.

## Overlay chrome

`.ro-win` parchment, dark ink on cream. Compact widths (shop/equip/skills already sized).
