## Verification Plan: Cliff Pack + NB Pro Inference + Phase 2–4 QA

Three verification tasks against the published `https://frank-create.lovable.app` build (post-`frank-api` fix for `messages.seq` / model routing).

### 1. Cliff Pack ZIP export smoke

- Sign in, open the Studio, pick a session that has at least one approved asset (seed one if empty by generating + approving).
- Click "Export Cliff Pack" in the Studio and on `/#/review/:sessionId`.
- Confirm:
  - Button leaves the disabled/0-approved state.
  - Browser download completes (`cliff-pack-*.zip`).
  - Unzip locally: verify `manifest.json` matches `handoff.ts` schema, images open, and `run_brief.md` / workflow JSON contain no `LOVABLE_API_KEY`, `sb_secret_`, or bearer tokens.
- Capture screenshots of: export button state, download toast, unzipped contents.

### 2. `/functions/v1/frank-api/inference/turn` NB Pro smoke

- Use `supabase--curl_edge_functions` (auto-injects the preview session bearer) with:
  - `path`: `/frank-api/inference/turn`
  - `method`: `POST`
  - body:
    ```json
    {
      "session_id": "<sample-session-uuid>",
      "prompt": "frank body coffee scrub hero shot, soft studio light",
      "model": "nano-banana-pro",
      "settings": { "aspect_ratio": "1:1", "image_size": "2K", "count": 1 }
    }
    ```
- Assert HTTP 200, response contains a `turn` with `status: "complete"` and at least one `asset` with a signed `preview_url`.
- Repeat once with `"model": "nano-banana-2"` to confirm the new `MODEL_MAP` routing.
- If a 5xx returns, capture the JSON `error` string (now a real message, not `[object Object]`) and stop.

### 3. Rerun Phase 2–4 of the Cliff access QA checklist

Run against `https://frank-create.lovable.app` using the existing Playwright runbook so results are reproducible:

```text
scripts/cliff_access_playwright.py
  env:
    CLIFF_QA_STORAGE_STATE=/tmp/browser/cliff-storage.json
    CLIFF_QA_SAMPLE_SESSION=<sample-session-uuid>
    CLIFF_QA_BASE_URL=https://frank-create.lovable.app
```

Phases executed:
- **Phase 2 — NB Pro live gen**: prompt + reference dock (1 image), assert asset renders in center Round card and right rail, screenshot.
- **Phase 3 — NB 2 live gen**: same flow, model swapped, assert asset appears, screenshot.
- **Phase 4 — Approve + audit + Cliff Pack**: approve on `/#/review/:sessionId`, assert `POST asset_approval_events` returns 2xx (existing network listener), then trigger Cliff Pack export and assert ZIP download event.

Deliverable:
- Pass/fail table per phase.
- Screenshots saved under `/tmp/browser/cliff-qa/` and referenced in a short report.
- If any phase fails, include the captured console + network error verbatim (no summarization) so the fix target is unambiguous.

### Technical notes

- Requires the `frank-api` deploy that includes the `messages.seq` fix and `MODEL_MAP`; if published build is older, republish before running.
- Storage state file must be captured once per Cliff-approved Google account (see `scripts/README-cliff-qa.md`).
- No app code changes are expected from this plan — it is verification only. Any bug found will be a follow-up plan.
