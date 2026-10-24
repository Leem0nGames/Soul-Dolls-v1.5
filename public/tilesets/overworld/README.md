# Overworld tileset

Pixel art tiles used by the overworld map (`src/game/graphics/OverworldTiles.ts`).

## Modern tiles (in use)

The ground is now baked from `modern/`: tiles cut out of Kenney's
**Roguelike pack** (16x16, CC0) by `tools/bake-modern-tiles.py` from the
vendored sheet `tools/modern-source/RoguelikeSheet_misa.png`.
See `modern/LICENSE.txt`.

## Legacy Gen 2 tiles (no longer loaded)

- **Project:** [nikouu/Pokemon-gen-2-style-tilemap](https://github.com/nikouu/Pokemon-gen-2-style-tilemap)
- **Author:** nikouu
- **Licence:** MIT (see `LICENSE`)
- **Used set:** the `Custom/` folder of the project, which contains *original* tiles
  inspired by the Game Boy games (the author explicitly states they are not a
  one to one copy of the Nintendo assets). No ripped Nintendo artwork is used.

The legacy tiles are 8x8 pixels and cover the whole overworld: grass, tall grass
(the wild encounter patches), the sand paths, the paved plaza, the void border
and the decorations (short and tall trees, flowers and signposts).
