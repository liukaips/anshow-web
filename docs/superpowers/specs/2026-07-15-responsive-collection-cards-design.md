# Responsive Collection Cards

## Goal

Remove the visually distracting empty grid area when a public collection has an incomplete final row without stretching its image across the full row.

## Design

- Keep the existing two-column tablet and three-column desktop grid for complete rows.
- When a collection has an odd item count, render only the final item as a horizontal feature card at the desktop breakpoint.
- Keep the media in a fixed `16/9` box with `object-fit: cover`; this preserves the source aspect ratio and crops edges rather than distorting the image.
- Keep the normal stacked card layout below the desktop breakpoint so narrow screens remain easy to scan.

## Acceptance Criteria

- No painted empty grid tracks at 1024px or 1440px.
- The final image is not stretched and remains bounded by a stable aspect ratio.
- Existing card links, translations, media fallbacks, and accessibility semantics remain unchanged.
- Frontend lint, typecheck, tests, and public E2E continue to pass.
