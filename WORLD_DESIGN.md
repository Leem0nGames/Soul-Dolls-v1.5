# World map development

This guide is the contract for adding areas to the SoulDolls overworld. Read it
before editing map data, props, encounters, NPCs, or travel links. Keep the
world traversable, coherent with the opening journey, and testable without
starting the browser.

## Current progression

1. **Villa Marionette** — starting village, home, services, and the SoulDoll
   selection in the laboratory.
2. **Ruta 1 · Sendero de los Susurros** — the first trail: spirit-grass
   encounters, an optional tamer, and the northbound route for future growth.
3. **Next area** — not authored yet. Decide the destination, story beat, and
   map connection before extending the trail.

The first route introduces exploration and encounters after the player has
chosen a SoulDoll. Keep its wild levels close to the starter's level; use
optional grass and trainers to make the area rewarding without blocking the
main path.

## Source of truth

- `src/game/graphics/OverworldTiles.ts` owns map IDs, names, connections,
  terrain layout, encounter-zone definitions, decoration budgets, walkability,
  and the world consistency checks.
- `src/game/graphics/LuminatiRenderer.ts` owns map transitions, map-specific
  scene visibility, NPC/tamer placement, and encounter execution.
- `src/game/graphics/OverworldProps.ts` owns billboard sizes and prop loading.
- `src/game/graphics/OverworldBuildings.ts` owns Villa Marionette buildings;
  do not apply village footprints to other maps.
- `tools/world-harness.ts` is the repeatable validator for links and
  reachability. Run it before lint/build.

Do not create a second registry for encounters or travel. Add each area to
`MapId`, `MAP_NAMES`, `MAP_LAYOUTS`, `MAP_CLEAR_POINTS`, and `MAP_CONNECTIONS`.
Put encounter zones and their species pools in that area's `MAP_LAYOUTS`
entry, then make NPCs map-specific with their `mapId`.

## Area authoring checklist

1. **Define the journey purpose.** Record where the player comes from, the
   destination it points toward, the story beat, the intended level range, and
   optional content.
2. **Choose a readable footprint.** Current maps use a 40x40 tile canvas,
   1.5 world units per tile, and movement bounds near +/-26.8 units. Keep
   entrances on the walkable interior, not in the void border.
3. **Lay out the main path first.** `roadXs` and `roadZs` describe the path;
   grass, encounter patches, trees, and props are secondary. Add entrances,
   landmarks, NPCs, and encounter patches to `MAP_CLEAR_POINTS` so generated
   scenery cannot cover them.
4. **Author encounters in map data.** Each zone needs a unique name, an
   in-bounds rectangle, a measured encounter rate, and weighted species with
   sensible level ranges. Keep at least one safe route around trainer/NPC
   placement.
5. **Add reciprocal travel links.** A connection is a trigger point and a
   safe arrival point. Add a return connection in the destination map. Ensure
   both sides are walkable and the arrival is far enough inside to avoid
   immediately triggering the same link again.
6. **Scope scene objects.** Map-specific NPCs and tamers must declare `mapId`.
   Village facilities and buildings must stay hidden and non-interactive
   outside Villa Marionette.
7. **Validate the map.** Run `npm run world:harness`; it checks connection
   targets, bounds, blocked trigger/arrival points, return links, and
   walkability from each entrance to every encounter zone. It also verifies
   encounter rates, weighted species references, and level ranges.
8. **Validate the project.** Run `npm run lint && npm run build`. Inspect the
   area in the game for sightlines, prop overlap, pacing, and player access.
9. **Update this guide** when the world progression or map-authoring contract
   changes.

## Harness

```bash
npm run world:harness
npm run lint
npm run build
```

The harness is deliberately deterministic: map layouts and decoration
placement use stable map IDs as seeds, so validation and play use the same
obstacle layout. A failed check is a map-data defect; fix the entrance,
connection, clear point, or obstacle layout rather than bypassing the check.

## Asset and gameplay rules

- Use licensed project assets and keep their license/source records with them.
- Keep tiles nearest-neighbor and the ground as one baked canvas per map.
- Trees are solid; decorative bushes, flowers, grass tufts, and rocks are not.
- NPC billboards, encounter zones, interactions, and props must not leak into
  other maps.
- Do not put required story content behind random encounters or optional
  trainer battles.
- Keep player access to entrances, path junctions, and key NPCs clear.
