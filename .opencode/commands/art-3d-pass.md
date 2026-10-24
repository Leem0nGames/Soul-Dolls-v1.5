---
description: Review 3D art assets (models, rigs, animations, materials, lighting, LOD) against the art bible and pipeline conventions.
---

Review $ARGUMENTS for 3D art quality.

Load the `art-bible` skill via the skill tool (exact ID: `art-bible`) before starting.

Run a 3D art pass over the project's 3D assets: models, rigs, animations, materials, lighting and LODs.

Required checks:

1. Import correctness: scale, orientation, pivots, naming, polycount budgets.
2. Rig compliance: skeleton conventions, bone/influence budgets, deformation quality.
3. Animation clips: naming, root motion policy, loops/blends, compression.
4. Materials: library usage, texture packing, colour spaces, batching.
5. Lighting and LODs: budget compliance, switch distances, culling.

Produce a structured report with:

- Pass/fail per category
- Concrete differences from the art bible
- Actionable fix recommendations
- Escalation notes (e.g. performance reviewer) when budgets are exceeded.

Do not start changing files before the pass has a clear verdict; if the verdict is not a pass, propose a revision plan first.
