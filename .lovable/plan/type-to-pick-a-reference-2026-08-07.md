# Type `@` to pick a reference

Right now the only way to use a tag is to click the `@refN` label on a thumbnail. Typing `@` in the brief does nothing, so people guess the numbers.

## Behaviour

- Typing `@` in the brief box (at the start or after a space) opens a small autocomplete popover anchored just under the textarea.
- The popover lists every currently loaded reference, one row each: thumbnail, its tag (`@ref1`, `@ref2`…), and the file/asset title. Video frame slots show as `@first` / `@last` when they're in use.
- Continuing to type filters the list (`@re`, `@ref2`, or part of the file name). Nothing matching closes the popover.
- Keyboard: Up/Down move the highlight, Enter or Tab inserts the highlighted tag, Escape closes and leaves the plain `@` text alone. Clicking a row inserts it too.
- Inserting replaces the partially typed `@…` token with the full tag plus a trailing space, and returns the caret right after it.
- Hovering or highlighting a row highlights that thumbnail in the dock below (reuses the existing hover-tag highlight).
- If no references are loaded, the popover shows a single row: "No references loaded — add references" which opens the reference picker.
- Cmd/Ctrl+Enter still generates; while the popover is open, Enter picks a suggestion instead of inserting a newline.

## Technical notes

- All of this stays in `frank-create/src/App.tsx` around the existing composer textarea plus new styles in `frank-create/src/styles.css`; no backend or prompt-expansion changes (`expandReferenceTags` already handles whatever tag ends up in the text).
- New local state: mention query string, token start index, and highlighted row index, derived on `onChange`/`onKeyUp` from the caret position in `prompt`.
- Reuses `referenceTagFor(index)` over the same ordered `referenceAssets` array the dock renders, so suggestions can't drift from what gets sent.
- Insertion reuses/extends `insertReferenceTag` so caret handling matches the existing thumbnail-click path.
- Popover is positioned relative to the textarea wrapper (not a portal) and closes on blur, outside click, and Escape.
