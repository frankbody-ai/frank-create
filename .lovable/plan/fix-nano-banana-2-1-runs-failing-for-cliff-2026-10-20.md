# Fix: Nano Banana 2.1 runs failing for Cliff

## What I've confirmed so far

- Nano Banana 2.1 is live on OpenRouter, and the app's model name is correct.
- Direct test calls work: plain prompt, 2K at 4:5, and 4K at 16:9 all came back with an image.
- Asking for more than one image in a single request fails ("n must be 1"). The app already sends this model one image per request, so that is probably not Cliff's problem. I'll still double-check it on the real request path.
- Cliff's feedback note is stored in the shared AutoSolutions database, which my tools here can't read directly. So the actual cause is **not confirmed yet**.

## Step 1: Find the real cause

1. Read Cliff's feedback entry (his text, screenshot, and the run it points to) along with the failed run record. That gives me the exact error message and the settings he used: size, shape, count, and reference images.
2. Replay those exact settings against OpenRouter. If he used reference images or an edit, I'll test with references too, since that path hasn't been tested yet.
3. Pin down which setting causes the failure.

## Step 2: Fix only what Step 1 shows

- **A setting the model refuses** (a shape, size or reference count): limit the model's options in the picker to what it really accepts. I'll also add a safety net that quietly swaps an unsupported value for the closest one that works, the same way the Flare fix did.
- **Reference images get rejected** (format or size): resize or convert them before they're sent for this model.
- **Anything else**: I'll tell you what I found before changing anything.

Then I'll redeploy the backend, run one real Nano Banana 2.1 generation with Cliff's settings to confirm it works, and add a release note.

## Technical notes

- Model mapping: `google-nb-2-1` maps to `google/gemini-nano-banana-2.1` (`frank-api/index.ts` ~:409). It is not in `OPENROUTER_NATIVE_N`, so requests go out with n=1, fanned out.
- Request builder: `openrouterImage` (~:1280-1335). The fix would sit next to the GPT Image 2.5 aspect-ratio snapping.
- Picker limits: `src/lib/presets.ts` (aspect ratios list 4:5, 1:8, 8:1, and so on, which have only been partly checked).
- If I can't read the feedback, I'll ask you for Cliff's screenshot or error text.
