# Prompt Generator 502 on Cliff's account — investigate, then fix

## What the data already shows

- Cliff's last four failed prompt-generator chats are all the same brief with 2 attached references. Every one of them stored the user message but **zero assistant replies** — the agent call never returned.
- Those user messages carry **~7.2 MB of base64 image data** in a single request (2 images). His one successful heavy run was a different set; the repeated failures cluster on this specific pair of attachments.
- My own runs attach small screenshots (~1 MB), which is why I never see it. Nothing account-specific was found: his auth session, role, policies and grants are identical to mine, and his health check passes end to end.
- Attachments are read as raw data URLs with no downscaling, and the **entire image payload is re-sent on every wizard turn**, so a heavy first message stays heavy for the whole conversation.

Working theory (not yet confirmed): the backend worker dies while handling the oversized request body, which the platform surfaces as a `502 Bad Gateway`, and the client's retry loop replays the same oversized payload five times before showing the error plus the "reconnecting to studio backend" banner.

## Step 1 — Prove the cause

1. Add structured logging to the prompt-agent route: request body size, image count, per-image byte size, model latency, and the exact failure reason. Log the caller's id so his runs are identifiable.
2. Reproduce directly against the deployed backend with a synthetic payload matching his shape (2 images, ~3.5 MB each) and compare against a small-image control run. Confirm whether the 502 happens before the model call (body handling) or during it (gateway rejection).
3. Report findings: exact failure point, threshold at which it starts failing, and whether it is size, image format, or something else.

## Step 2 — Fix what step 1 proves

Only implement the branch the evidence supports:

- **If it's payload size:** downscale and re-encode attachments in the browser before sending (longest edge capped, JPEG re-encode), stop re-sending full image data on follow-up wizard turns, and reject over-limit payloads with a clear message instead of a 502.
- **If it's the model/gateway rejecting the images:** normalise image format/dimensions to what the model accepts and return the gateway's real reason to the UI.
- **If it's neither:** report the actual cause before changing behaviour.

In both cases: stop retrying a request that already failed for a non-transient reason, so users get one clear message instead of a long "reconnecting" spinner.

## Technical notes

- Route: `POST /prompt-agent` in `supabase/functions/frank-api/index.ts` (lines ~2696-2739). Images pass straight through into the chat message as `image_url` parts.
- Client: `frank-create/src/components/PromptGenerator.tsx` (`fileToDataUrl`, `send`) and `fetchJson` in `frank-create/src/lib/api.ts`, which retries 502/503/504 five times with backoff.
- Persistence tables `prompt_chats` / `prompt_chat_messages` are fine; RLS and grants verified.
- No schema changes needed.
