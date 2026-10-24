# CraftPix dungeon objects

Seven transparent PNG sheets from the CraftPix free dungeon objects pack,
including traps, supplies, pedestals, and general objects. `full.png` is the
combined atlas; use the individual sheets when authoring.

These are sprite sheets, not individual billboards. The current overworld
renderer treats each prop image as one sprite, so crop the required objects
into transparent images before adding them to `PROP_DEFS` in
`src/game/graphics/OverworldProps.ts`. Keep trap collision and activation
behavior explicit in the map data rather than relying on the artwork.

See [LICENSE.txt](./LICENSE.txt) for source and usage terms.
