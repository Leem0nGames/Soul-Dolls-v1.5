---
name: Tilemap Pipeline
description: Define tileset creation, auto-tile rules, collision shapes, and tilemap configuration for 2D levels
metadata:
  opencode/autoinvoke: true
---

# Tilemap Pipeline

## Purpose
Define tileset creation, auto-tile rules, collision shapes, and tilemap configuration so 2D levels are buildable, consistent, and performant.

## Use When
- the project uses tile-based level construction
- a new tileset is being created or an existing one is extended
- auto-tile or rule-tile behaviour needs standardisation
- tile collisions or sorting layers need validation

## Inputs
- Level design requirements (tile size, grid dimensions, layer count)
- Art bible or visual direction for environment tiles
- Platform constraints (max tilemap size, draw call budget)
- Collision requirements per tile type

## Process
1. Define tile size, grid unit, and layer naming convention.
2. Create or validate tileset layout (rows, columns, padding, tile variants).
3. Configure auto-tile or rule-tile adjacency rules.
4. Assign collision shapes and physics layers per tile type.
5. Validate tilemap rendering, sorting order, and draw call count.

## Outputs
- Tileset specification (tile size, layout, variant rules)
- Auto-tile adjacency configuration
- Collision shape mapping per tile type
- Tilemap layer naming and sorting convention

## Quality Bar
- Every tile in the set has correct adjacency rules — no visual seams
- Collision shapes match the visual tile boundaries
- Tilemap draw calls stay within the platform budget
- Layer naming and sorting order are documented and enforced

## Common Failure Modes
- Tile seams caused by incorrect padding or filtering settings
- Auto-tile rules that produce visual artefacts at certain adjacency combinations
- Collision shapes that do not match the visual boundary, causing gameplay bugs
- Unbounded tilemap size that causes memory or rendering spikes

## Related Agents
- 2d-artist
- level-designer
- performance-reviewer

## Related Commands
- art-2d-pass
- level-beat
- perf-budget

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.

## Project Anchors — SoulDolls RPG

- Overworld ground: one canvas baked at runtime (grass dithered over paths and tall grass with a 50% checkerboard), used as the texture of a single plane.
- Backdrop colours: SoulDoll sheets keyed at `#19191E` (rgb 25,25,30, tolerance 26); player sheet at `#FFFFFF` (tolerance 34). Never key by luminance.
- Pixel art conventions: `NearestFilter`, no mipmaps, `SRGBColorSpace`.
- Character artwork flows through the dynamic folder + harness (`npm run soul:harness`, `npm run bake:sprites`); `src/game/data/souldollSheets.ts` is generated.
