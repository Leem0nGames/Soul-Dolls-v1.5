---
description: Review 2D art assets (sprites, tilemaps, animations, placeholders) against the art bible and pipeline conventions.
---

Review $ARGUMENTS for 2D art quality.

Load the `art-bible` and `tilemap-pipeline` skills via the skill tool (exact IDs: `art-bible`, `tilemap-pipeline`) before starting.

Run a 2D art pass over the project's sprites, tilemaps, animations and placeholders.

Required checks:

1. Sprite sheets: naming, resolution, atlas fit, transparency readiness, baked WebP state, display-size vs body-size agreement.
2. Tilemaps: tileset completeness, auto-tile adjacency rules (no visual seams), collision shapes matching visual boundaries, layer naming/sorting, draw call budget.
3. Animations: frame rate, state machine, memory budget, placeholder readiness.

Produce a structured report with:

- Pass/fail per category
- Concrete differences from the art bible
- Actionable fix recommendations
- Escalation notes when performance budgets are exceeded

Do not start changing files before the pass has a clear verdict; if the verdict is not a pass, propose a revision plan first.
