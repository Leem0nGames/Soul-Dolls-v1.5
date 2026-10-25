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
  Panels include the shared inset bronze-and-amber corner frame.
- `BrandButton` — `primary`, `secondary`, `quiet`, `danger`, `ki`, or `soul`
  action. Use `select` with `aria-pressed` for selected rows and toggle
  controls; it applies a shared gold/violet selected state.
- `BrandBadge` — compact status and metadata label.
- `BrandWidget` — compact metric card with a semantic `gold`, `ki`, `soul`, or
  `danger` accent.
- `BrandProgress` — accessible, bounded progress bar with the same semantic
  accent variants.
- `BrandSectionTitle` — reusable icon-and-title treatment for panel sections.
- `GameCabinetModal` — shared responsive modal frame, title bar, and close
  action; add screen-specific actions through `headerRight`.
- `sd-ornate-frame` — reusable ornamental inset border for modal shells and
  content panels; use it instead of drawing one-off corner treatments.

Use `sd-type-display`, `sd-type-heading`, `sd-type-label`, `sd-type-body`, and
`sd-type-meta` for the shared type scale. Cinzel is reserved for display and
section headings, Outfit for readable interface text, and Press Start 2P for
pixel-art details such as game IDs and compact level markers. Keep status and
action colors semantic; use element-specific colors only where the UI identifies
an element or its type.

Battle-specific styles such as `sd-battle-frame`, `sd-dialog-ornate`, and
`sd-action-btn` remain available for battle overlays and dialogue.

Use BrandButton for navigation, modal actions, tabs, and selectable rows in
the HUD, inventory, party, shop, evolution, and SoulDex. Keep virtual movement
controls and battle action buttons specialized to preserve their game-specific
interaction and visual affordances. Icon-only buttons should have an
`aria-label` and a touch target of at least 40px.

## Validation

Run `npm run brand:harness` when changing brand tokens or shared CSS. The
harness verifies that palette values match the TypeScript token contract and
that all required shared component styles remain defined. Always follow with
`npm run lint` and `npm run build`.
