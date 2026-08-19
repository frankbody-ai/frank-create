# Restore Studio image generation and Prompt Generator reliability

## Confirmed diagnosis

- Recent production requests show `POST /inference/turn` ending at **150s with 504**, and `POST /prompt-agent` ending at **160s with 504** or earlier with 502.
- The latest two Studio runs are still stored as `running`, with no generated assets. The backend currently performs up to five provider retries inside one synchronous request, then attempts fallback only afterward; the request can be terminated before either path returns a result or records failure.
- Prompt Generator uses `openai/gpt-5.6-sol` first; the gateway has returned a terminal 400 for that model. It then attempts another model inside the same request.
- Prompt Generator sends raw base64 references repeatedly with conversation history. Cliff’s stored reference payloads range from about **7 MB to 22 MB**, increasing processing time and request fragility. A recent 9 MB run did succeed, so size is an amplifier rather than the sole cause.
- The client retries 502/503/504 responses up to five times, replaying expensive requests and creating duplicate stuck runs.

## Changes

1. **Make Studio generation survive long provider runs**
   - Change image inference to return a persisted `running` turn promptly instead of holding the request open through model generation, retries, fallback, downloads, and storage writes.
   - Extend the existing turn-status polling path to finish OpenRouter image jobs, invoke Replicate fallback only when the primary failure qualifies, persist assets, and mark the turn `complete` or `failed`.
   - Put strict bounded retry rules around each provider: terminal 4xx failures return immediately; only 429/5xx retry with backoff and a small cap.
   - Add stale-run recovery so existing and future `running` turns cannot remain indefinite after an interrupted worker.

2. **Fix Prompt Generator’s model and payload path**
   - Replace the unsupported primary model with the supported default chat model and keep one supported fallback.
   - Compress/downscale attached images before sending them and stop resending their base64 bytes on wizard-answer and follow-up turns; retain the visual references only on the first model call that needs them.
   - Enforce a clear attachment payload limit before submission and surface the backend’s exact error message.
   - Apply the same bounded retry contract: no retries for terminal 400/401/402/403 responses, and capped delayed retries only for 429/5xx.

3. **Stop client request amplification**
   - Make API retry behavior operation-aware: ordinary idempotent reads may retry, but `/prompt-agent` and `/inference/turn` must not automatically replay after a gateway timeout.
   - Preserve user input/retry controls and show the real provider or timeout error instead of a generic reconnecting state.

4. **Repair current stuck data and verify end to end**
   - Mark orphaned `running` turns that have exceeded the recovery window as failed with a retryable interruption message.
   - Test one real image generation for each active image-provider family, including a reference-image edit and Replicate fallback.
   - Test Prompt Generator with no image, a normal image pair, and a deliberately over-limit pair; verify wizard and final-prompt calls both complete without duplicate submissions.
   - Confirm every tested run ends in `complete` or `failed`, produces assets when successful, and leaves no indefinite `running` rows.

## Technical scope

- Backend orchestration and status handling in `supabase/functions/frank-api/index.ts`.
- Prompt attachment preparation and conversation payload construction in `frank-create/src/components/PromptGenerator.tsx`.
- Operation-aware error/retry handling in `frank-create/src/lib/api.ts`.
- Minimal Studio polling/error-state adjustments in `frank-create/src/App.tsx` if required by the asynchronous response contract.
- No new tables are expected; existing turn snapshots can hold provider job and recovery metadata.
