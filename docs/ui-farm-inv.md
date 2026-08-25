# Auto Farm + Inventory windows

Classic RO parchment overlays (`city-win` kinds `"farm"` / `"inv"`). Dark ink on cream. Copy is Thai.

## AUTO FARM (`UI.farmWin`)

Dock **FARM** or HUD **F** opens the window (`App.goFarm`). Keyboard **F** still toggles Auto Farm on/off — it does not steal F for the window.

`save.autoFarm` is the master switch. Settings live in `save.autoFarmCfg` (filled by `PVE.ensureAutoFarmCfg` / `createSave`):

| Field | Default | Notes |
|---|---|---|
| sitHpOn / sitHp | true / 30 | นั่งเมื่อ HP ต่ำกว่า % (1–99) |
| sitMpOn / sitMp | true / 20 | นั่งเมื่อ MP ต่ำกว่า % |
| skills | `[null × 4]` | learned skill ids only |
| pots | 3 slots `{id, when: hp\|mp, pct}` | first match with count>0 drinks |

Helpers: `setFarmSit`, `setFarmSkill`, `setFarmPot`, `learnedSkillIds`, `maybeAutoPotion`, `shouldSit`.

Sit is data + `PVE.shouldSit` only (no sit animation yet). If every pot slot is empty, `maybeAutoPotion` keeps the old HP 40% orange/red/white fallback.

### Skill drag

Palette of learned skills (`draggable`, `data-skill`). Drop on one of four `.farm-skill-slot` squares. Drag a filled slot off the row to clear. Click palette then click a slot as fallback (`App._farmPickSkill`). Click × to clear.

## INVENTORY (`UI.invWin`)

Dock **INV** `<small>I</small>`, HUD 🎒 (`App.openBag` → `App.goInv`), hotkey **I** on a live map (same block as E/R/C/K; not WASD). Title: INVENTORY / กระเป๋า.

Tabs (`UI._invTab`): **ใช้ / ยา** · **สวมใส่** · **วัสดุ**.

- ยา: all `DATA.POTION_ORDER`, faded at 0, click ใช้ → `App.usePotion`. Remaining buff shown.
- สวมใส่: owned `DATA.ITEMS`, type from `DATA.SLOTS`, equipped badge, click → `App.toggleInvItem`.
- วัสดุ: `save.materials` (default `{}`). Icons from `DATA.MATERIALS` (jellopy / clover / feather). Empty hint: ยังไม่มีวัสดุ. Field drop tables unchanged.

`App.closeBag` closes leftover `#bag-overlay` and the inv city-win if that kind is open.

## Dock (every zone)

SKILL K · STATUS C · **FARM** · **INV I** · สวมใส่ E · ร้านอุปกรณ์ R · ตีบวก · ร้านยา R · SAVE.

S stays walk south. Do not bind S to save or sit.
