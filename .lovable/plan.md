# Match Brief remix and Cancel to the Generate button

Right now Brief remix and Cancel are stacked in a small vertical pile with 28px height, 12px text and tighter padding, so they read as a different button family than Generate.

## What changes

- Un-stack the pair: Brief remix and Cancel sit side by side on the same line as Generate.
- Both get the exact same geometry as Generate: 46px height, same 8px corner radius, same padding rhythm, same label size/weight and icon size.
- Each one is half the width of Generate (Generate keeps its 132px minimum, so each of the two becomes 66px), centred labels, no wrapping.
- They keep their current colour roles: Brief remix and Cancel stay outlined/secondary (Cancel keeps its danger accent), Generate stays the solid ink button.
- Mobile: the trio wraps as it does today, keeping full-height touch targets.

## Technical notes

- `frank-create/src/styles.css`: replace the `.action-compact-pile` column rules and the 28px/0.75rem overrides on `.remix-button` / `.composer-cancel-button` with a horizontal row whose children inherit primary-button height and radius at `min-width: 66px`.
- `frank-create/src/App.tsx`: keep the wrapper element but rename it to a row class; icon sizes on both buttons go from 14 to 18 to match Generate.
- Verify with a build plus a Playwright element screenshot of the composer action row.
