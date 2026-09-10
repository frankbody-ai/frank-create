# Replace the AutoSolutions logo

## What will change

- Upload the supplied `AutoSolutions-OS.svg` through the project asset flow.
- Make every app-level AutoSolutions lockup use this supplied artwork, including sign-in, top navigation, consent, and small-screen views.
- Replace the browser favicon with the same supplied SVG.
- Leave company marks, app labels, copy, and behavior unchanged.

## Technical details

- Add an app-level `.as-logo` image override after the attached design-system stylesheet, without editing managed design-system files.
- Preserve the design system's locked logo sizing and layout behavior.
- Verify the visible logo in the running app and check that the favicon resolves.
