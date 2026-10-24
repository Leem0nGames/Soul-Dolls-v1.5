---
name: Art Bible
description: Define the visual direction that artists, UI, technical art, and marketing can execute consistently
metadata:
  opencode/autoinvoke: true
---

# Art Bible

## Purpose
Define a visual direction that artists, UI, technical art, and marketing can execute consistently.

## Use When
- the visual style is still vague
- outsourcing or parallel art production is starting
- art consistency is drifting

## Inputs
- product pillars
- references
- platform targets
- camera and readability constraints

## Process
1. State the style pillars and what they explicitly exclude.
2. Define shape language, color intent, lighting mood, and material logic.
3. Show readability rules for gameplay-critical visuals.
4. Align the style with production capacity and technical limits.
5. Turn the bible into reviewable asset-class guidance.

## Outputs
- Art bible
- Style pillars
- Do/don't reference set
- Readability rules

## Quality Bar
- Usable by content creators without tribal knowledge.
- Respects quality bars and runtime constraints together.
- Defines validation and ownership for content flow.

## Common Failure Modes
- Style consistency that ignores gameplay readability.
- Manual pipeline steps that create drift.
- Content that cannot be validated before release.

## Related Agents
- technical-artist
- ui-ux-designer
- producer

## Related Commands
- art-2d-pass
- art-3d-pass
- vertical-slice

## Notes
- Keep this skill aligned with the relevant rules layer and current project documentation.
- If engine-specific constraints materially change the workflow, hand off to the matching engine skill or engine-specific reviewer.

## Project Anchors — SoulDolls RPG

- Overworld ground: one canvas baked at runtime (grass dithered over paths and tall grass with a 50% checkerboard), used as the texture of a single plane.
- Backdrop colours: SoulDoll sheets keyed at `#19191E` (rgb 25,25,30, tolerance 26); player sheet at `#FFFFFF` (tolerance 34). Never key by luminance.
- Pixel art conventions: `NearestFilter`, no mipmaps, `SRGBColorSpace`.
- Character artwork flows through the dynamic folder + harness (`npm run soul:harness`, `npm run bake:sprites`); `src/game/data/souldollSheets.ts` is generated.
