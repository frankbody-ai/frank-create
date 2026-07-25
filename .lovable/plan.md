Make the feedback button match the normal button style and move it to the right side of the topbar.

## What I'll change

1. **Feedback button dimensions**
   - In `frank-create/src/styles.css`, update `.feedback-inline` to stop using `width: 100%` and `border-radius: 999px`.
   - Match the standard button sizing: `border-radius: 8px`, `padding: 10px 16px`, `font-size: 13px`, `font-weight: 600`, `letter-spacing: 0.06em`, `text-transform: uppercase`, `font-family: var(--font-body)`.
   - Keep the existing red background for visibility but let it shrink to its content width.

2. **Placement in the topbar**
   - In `frank-create/src/App.tsx`, inside `.studio-topbar-right`, move the `<FeedbackWidget variant="inline" />` after the `.stat-row` so it renders on the right.
   - Update `.studio-topbar-right` CSS to use a horizontal row layout (`flex-direction: row; align-items: center;`) with `gap: 12px` so the button sits beside the stats instead of stacked above them.
   - Remove `align-self: flex-end` from the feedback inline rule since it will already be in a row.

3. **Verification**
   - Check the preview renders the topbar with the feedback button at normal size on the right.
   - Ensure the button still opens the feedback modal and the brand voice/fonts remain intact.