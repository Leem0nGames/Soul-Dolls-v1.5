# AGENTS.md — SoulDolls RPG

Working notes for any AI agent (or human) touching this repository.
Read this before changing art, data or the render pipeline.

---

## 0. Commands

```bash
npm run dev            # vite dev server (port 3000)
npm run lint           # tsc --noEmit  (this IS the lint)
npm run build          # production build

npm run bake:sprites   # cookies las hojas de personajes -> WebP con alfa
npm run bake:props     # cookies los props del mapa -> PNG con alfa
npm run bake:npc-sprites # genera el atlas billboard de NPCs desde las poses CC0
npm run soul:harness   # analiza + hornea + informa del estado de las hojas
npm run souldoll:validate # valida catálogo JSON, evoluciones, movimientos y arte
npm run brand:harness  # valida los tokens y estilos compartidos de la marca
npm run world:harness  # valida conexiones, accesos y encuentros del mundo
```

`npm run lint` must stay green before every commit. The build must stay green too.

---

## 1. Sprite sheets (the dynamic folder)

The character artwork lives in a **dynamic folder**: new JPGs can be dropped in
at any moment.

```
public/assets/souldolls/
  manifest.json          <- SOURCE OF TRUTH: which sheet belongs to which species
  <id>.jpg               <- the original artwork (never modified)
  <id>.webp              <- baked by the harness: same sheet, alpha mask, ~40% smaller
```

### The flow, step by step

1. **Drop** a JPG in `public/assets/souldolls/` (1024x1024, two views: back on
   the left half, front on the right half).
2. **Run** `npm run soul:harness`. It
   - registers any new JPG in the manifest (unassigned),
   - analyses every sheet (size, detected backdrop colour, one or two views,
     whether it already has an alpha mask),
   - bakes the missing WebP,
   - regenerates `src/game/data/souldollSheets.ts`,
   - writes a preview of every sheet in `.harness/preview/`,
   - prints a report with the assigned sheets, the new ones, the species that
     still have no artwork (with a ready to paste template) and any warning.
3. **Interpret** the new sheet: decide which species/tier it belongs to, its
   name, its types and its evolution. Look at the preview PNG.
4. **Add the species data** as an entry in `src/game/data/souldolls.json`.
   Include its ID, name, stage, types, six base stats, description, catch rate,
   base experience, learnset, and color theme. Use existing move IDs from
   `src/game/data/moves.ts`; evolution targets must already exist and advance
   exactly one stage. The art harness prints a JSON template for unassigned
   sheets. Add an evolution only when its target species is also defined.
5. **Assign** it:
   ```bash
   npm run soul:harness -- --assign 105515179_1792644033044389 ignisaur
   ```
   This updates `manifest.json`, re-bakes and regenerates the mapping. The
   first sheet of the manifest for a species is the one that wins.
6. Run `npm run souldoll:validate`. It rejects malformed stats/types, unknown
   moves, invalid evolution targets, missing starters, and invalid art
   assignments. New species without artwork use a stable generic sheet (or
   generated procedural art) automatically.
7. To add a starter, set `"starter": true` and a unique `"starterOrder"` in
   the JSON entry. No UI code change is needed.
8. **Verify**: `npm run lint && npm run build`, then check the game.

### The backdrop colours

The sheets are JPGs, so the backdrop is *painted in*. The harness measures it
from the border of every sheet and keys it out.

| Sheets | Backdrop | Tolerance |
|---|---|---|
| SoulDoll sheets | `#19191E` (rgb 25,25,30) | 26 |
| Player sheet | `#FFFFFF` | 34 |

A sheet that already ships with an alpha channel is detected and used as is
(`hasTransparentBackground`). The colour key lives in
`src/game/graphics/BackgroundKey.ts`; **never** key by luminance: that eats the
black collar, the boot soles and the straps of the characters.

### Species and sheet mapping

Species gameplay data is sourced from `src/game/data/souldolls.json`. The
typed loader and runtime checks live in `src/game/data/souldolls.ts`; do not
duplicate species records in TypeScript. `npm run souldoll:validate` checks
the JSON catalog without baking or modifying any artwork.

`src/game/data/souldollSheets.ts` is **generated** by the harness, do not edit
it by hand. It maps every sheet to the species that owns it; the species
without their own sheet share the generic ones (chosen with a stable hash of
the id).

Current line of fire:

| Tier | Species id | Name | Sheet |
|---|---|---|---|
| 1 | `ignisaur` | Tomo | `105515179_1792644033044389` |
| 2 | `pyrodrake` | Tomoe | `408770211_1792644218641596` |
| 3 | `tomomusashi` | Tomoe Musashi | `642182396_1792644280769170` |
| 1 | `runika` | Runika | `317824974_1792673142986204` |
| 2 | `valkirun` | Valkirun | `205779987_1792673152725653` |
| 3 | `drakonika` | Drakonika | `175605669_1792673162653249` |

---

## 2. Overworld maps

The map progression and reusable authoring/validation workflow are in
[`WORLD_DESIGN.md`](./WORLD_DESIGN.md). Read that guide before adding an area;
every map must pass `npm run world:harness`.

The opening maps are **Villa Marionette** and **Ruta 1 · Sendero de los
Susurros**, an original village and its first connected route. Map IDs, names,
and scene palettes live in `src/game/data/world.ts`; terrain, encounters,
connections, collision, and decoration layouts live in
`src/game/graphics/OverworldTiles.ts`. The game store is the single source of
truth for the active map.

Ground is baked from the **modern tileset** in `modern/`: tiles cut out
of Kenney's Roguelike pack (CC0, 16x16, 1px spacing) by
`tools/bake-modern-tiles.py` from the vendored sheet
`tools/modern-source/RoguelikeSheet_misa.png`.

```
public/tilesets/overworld/modern/     <- the cut tiles in use (16x16) + LICENSE.txt
public/tilesets/overworld/            <- archived, inactive Gen 2 source assets + license
public/assets/buildings/              <- Kenney City Kit Suburban GLB exteriors (CC0)
public/assets/npcs/                   <- Kenney Toon Characters, used as NPC billboards (CC0)
tools/bake-npc-sprites.ts             <- packs the poses into the NPC billboard atlas
tools/bake-modern-tiles.py            <- regenerates the cut tiles (pure stdlib)
tools/modern-source/                  <- vendored Kenney sheet (source of truth)
tools/world-harness.ts                <- validates map links, bounds and encounter reachability
src/game/graphics/OverworldTiles.ts   <- the grid, the transitions, the layout
src/game/graphics/OverworldBuildings.ts <- Villa Marionette building placement and GLB loading
src/game/graphics/OverworldProps.ts   <- the billboards (trees, rocks, flowers)
src/game/data/world.ts                <- canonical map IDs, names, and palettes
public/assets/props/                  <- the baked modern props with alpha (CC0)
tools/bake-modern-props.py            <- extracts props from the vendored Kenney sheet
```

- 1 tile = 1.5 world units; each current area is 40x40 tiles (60x60 units).
- Villa Marionette connects north to Ruta 1; the route returns south to the
  village. Continue the progression by adding the next area and reciprocal
  links instead of extending an unrelated map.
- Exteriors use eight CC0 GLB models from Kenney's City Kit (Suburban); the
  source and license are recorded in `public/assets/buildings/LICENSE.txt`.
- The whole ground is **one canvas** baked at runtime and used as the texture
  of a single plane (one draw call).
- **9-patch overlays**: spirit grass tufts (wild encounter patches) and the
  gravel plaza pick their piece from the exposed cardinal edges.
- **Transitions**: grass is dithered over path/sand with a 50% checkerboard;
  water and the gravel island carry their own rounded shore pieces.
- The props are **billboards** (sprites) so the player walks behind them.
- Residential facades face the village interior; the south home faces north
  toward the plaza. Model footprints and entry points follow those rotations.
- Every facility interior has a visible door in an actual opening in the front
  wall, aligned with the interaction and exit point.
- The tall-tree billboard uses one complete source tile, avoiding a seam from
  stacking two separate tree sprites.
- The trees block the player (slide collision), the rest of the props do not.
- The important places stay clear: shrine, tamers and the spawn.
- The player begins inside the garden home; the first SoulDoll is chosen by
  speaking to the researcher inside the laboratory. The party and SoulDex start
  empty, and wild/trainer battles stay unavailable until the choice is made.
- NPC billboards use CC0 poses from Kenney Toon Characters; the round bush is
  from Kenney Tiny Town. Their source commits and licenses are recorded beside
  the assets.

Rebake the modern props with `npm run bake:props`. Their sprites are extracted
from the transparent Kenney sheet. Add each new prop's size to `PROP_DEFS` in
`OverworldProps.ts`. The root-level Gen 2 tiles are archived for provenance
and are not part of any runtime or bake pipeline.

---

## 3. Battle VFX

```
src/game/graphics/BattleVfx.ts         <- the typed bridge (no Three.js)
src/game/graphics/BattleVfxDirector.ts  <- the effects
```

- The combat rules never depend on Three.js: `BattleUI` asks for an effect and
  awaits the `impact` frame, and applies the HP change there.
- Every move of `MOVES_DATABASE` has its own signature
  (`MOVE_SIGNATURE`) and every element has its own silhouette
  (`drawGlyph`).
- A watchdog guarantees the promise resolves even if WebGL is missing, so the
  battle can never stall because of the visuals.

---

## 4. Conventions

- The UI is in Spanish, the code comments and the docs in English.
- Pixel art: `NearestFilter`, no mipmaps, `SRGBColorSpace`.
- Anything that allocates per frame is forbidden in the render loops.
- The software WebGL fallback halves the amount of particles.
- The battle arena lives at Y = -50; the VFX group is parented to
  `battleArenaPlatform` so every effect is authored in arena local space.

### UI brand system

The battle UI defines the shared visual identity: deep ink/wood surfaces,
bronze framing, amber focus, and restrained soul-violet/ki accents. Use
`src/components/ui/BrandKit.tsx` (`BrandPanel`, `BrandButton`, `BrandBadge`)
and the `sd-brand-*` / `sd-cabinet-*` classes in `src/index.css` for new
screens. Reuse `GameCabinetModal` for modal framing instead of creating a
separate cabinet. Run `npm run brand:harness` after changing palette tokens
or shared UI styles. See `BRAND_GUIDE.md` for the component contract.

---

## 5. Golden rules

1. `npm run lint` and `npm run build` must be green.
2. Never commit `node_modules`, `dist` or `package-lock.json` (the project uses
   `bun.lock`).
3. New artwork goes through the harness, never by hand editing the WebPs.
4. If a change touches the art pipeline, update this file.
