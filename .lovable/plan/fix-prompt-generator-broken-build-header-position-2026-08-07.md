# Fix Prompt Generator: broken build + header position

## 1. Repair the broken build (blocking)

My last edit left a malformed conditional in the Prompt Generator message renderer, so the app currently fails to compile:

```text
src/components/PromptGenerator.tsx(85,29): error TS1005: '=>' expected.
src/components/PromptGenerator.tsx(90,7): error TS1005: '}' expected.
```

Fix: in `frank-create/src/components/PromptGenerator.tsx`, the `AgentBody` renderer has a duplicated/leftover branch in its ternary. Collapse it back to a single chain:

- list chunk -> numbered `<ol>`
- non-empty text chunk -> `<p>`
- empty chunk -> `null`

Then re-run the typecheck/build and confirm it passes before anything else.

## 2. Put the "Prompt Generator" heading above the chat

In the screenshot the `AGENT / Prompt Generator` title and its description sit underneath the composer card instead of at the top of the view. In the source the header element is already written before the chat shell, so the cause is layout/scroll, not JSX order — I will confirm it in the running app with a screenshot of the Prompt Generator view first, then apply the matching fix:

- If it is a scroll/height issue in the Prompt Generator column, pin the header as the first row of the scroll container (sticky top) so it is always visible above the thread and composer.
- If a CSS rule is reordering the column children, remove that rule rather than adding another override.

Scope: the Prompt Generator view header only — the skills row, thread, composer, and Discovery/Final behaviour stay as they are.

## Technical notes

- Files touched: `frank-create/src/components/PromptGenerator.tsx`, and `frank-create/src/styles.css` only if the verification shows a CSS ordering/scroll cause.
- Verification: `npx tsc -b` clean, plus a browser screenshot of the Prompt Generator view showing the title above the chat.
