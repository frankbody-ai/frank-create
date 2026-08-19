# Carry prompt generator references into Studio

Today "Send to Studio" only moves the text prompt. The reference images you attached during the wizard conversation stay behind in the Prompt Generator, so you have to re-add them manually in Studio.

## What changes

- When you press **Send to Studio**, every reference image used in that conversation comes with the prompt.
- Those images land in Studio's reference dock, already loaded for the next run (same as if you had added them yourself).
- If a model accepts fewer references than the conversation used, Studio keeps the first N and says so in the status line ("Prompt loaded with 3 of 5 references — <model> accepts 3.").
- Status feedback while it happens: "Loading prompt and references into the Studio composer…" then a confirmation once the uploads finish.
- If an image fails to upload, the prompt still loads and the status names which references were skipped, so the handoff never blocks on one bad file.
- No session active → the prompt still loads, and the status says references need an active session.

## Technical notes

- `PromptGenerator.tsx`: collect the deduped set of attachment data URLs from all `user` messages of the current thread (rendered thread and restored history alike). Widen `onUsePrompt` to `(prompt: string, images?: string[]) => void` and pass that set from both "Send to Studio" buttons.
- `App.tsx` `onUsePrompt` handler: `setPrompt(value)`, `showImageStudio()`, then convert each data URL to a `File` (fetch the data URL → blob → `new File`) and pass them to the existing `addReferenceFiles(files, { attach: true })`, which already handles storage upload, `createReference`, asset state, and the active reference ids. Clamp to `modelOptions.referenceLimit` before calling and report the clamp in the status text.
- Reuse the existing upload path rather than a new one, so tagged `@refN` behaviour, the reference dock, and receipts stay consistent.
