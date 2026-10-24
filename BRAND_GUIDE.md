# SoulDolls UI Brand Guide

The battle screen is the source of truth for the game's interface identity.
The interface should feel like a SoulDolls battle console: dark ink surfaces,
engraved bronze framing, amber focus, and limited soul-violet and ki highlights.

## Palette

| Token | Color | Use |
|---|---|---|
| `--sd-ink` | `#14101C` | Deep inset surfaces and screen backdrops |
| `--sd-wood` | `#2A1F2D` | Raised panels and structural surfaces |
| `--sd-bronze` | `#8A6A3B` | Frames, dividers, and borders |
| `--sd-gold` | `#E8B84A` | Focus, selection, and important actions |
| `--sd-ki` | `#5FE3D2` | Healing and defensive accents |
| `--sd-soul` | `#9B6BFF` | Soul energy and magical highlights |
| `--sd-rift` | `#C2234B` | Danger, damage, and critical states |

Use white/amber text on dark surfaces. Element colors may retain their
element-specific hues, but should not replace the shared frame and surface
palette.

## Shared UI kit

Import primitives from `src/components/ui/BrandKit.tsx`:

- `BrandPanel` — `surface`, `raised`, or `inset` content container.
- `BrandButton` — `primary`, `secondary`, `quiet`, or `danger` action.
- `BrandBadge` — compact status and metadata label.
- `GameCabinetModal` — shared responsive modal frame, title bar, and close
  action; add screen-specific actions through `headerRight`.

Battle-specific styles such as `sd-battle-frame`, `sd-dialog-ornate`, and
`sd-action-btn` remain available for battle overlays and dialogue.

## Validation

Run `npm run brand:harness` when changing brand tokens or shared CSS. The
harness verifies that palette values match the TypeScript token contract and
that all required shared component styles remain defined. Always follow with
`npm run lint` and `npm run build`.
