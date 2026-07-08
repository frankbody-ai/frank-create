# Cliff Access QA — Playwright runbook

Runs Phase 1–4 of the pre-handover checks against the published Frank Create app
and emits a pass/fail report you can attach to the Cliff handover email.

## One-time setup

1. Install Python + Playwright browsers (once per machine):
   ```
   pip install playwright
   playwright install chromium
   ```

2. Capture a whitelisted Google session (Google OAuth cannot be automated fresh
   in headless Chromium, so we log in once and reuse the storage state):
   ```
   playwright codegen --save-storage=user/frank_create/qa/state.json https://frank-create.lovable.app
   ```
   Log in with the whitelisted account (e.g. didac@frankbody.com), close the
   Codegen window. The file `state.json` now holds the session.

3. (Optional) Repeat with a non-whitelisted account, save to `state-deny.json`,
   to exercise the denial branch in Phase 1.

## Run

```
set CLIFF_QA_URL=https://frank-create.lovable.app
set CLIFF_QA_EMAIL=didac@frankbody.com
set CLIFF_QA_STORAGE_STATE=user\frank_create\qa\state.json
set CLIFF_QA_DENY_STORAGE_STATE=user\frank_create\qa\state-deny.json
set CLIFF_QA_SAMPLE_SESSION=<seeded session id with >=1 unapproved asset>
python scripts\cliff_access_playwright.py
```

`CLIFF_QA_SAMPLE_SESSION` is optional. If unset, the runbook falls back to
the `cliff.qa.sampleSessionId` value persisted from the in-app
`/#/cliff-access` checklist. When present, Phase 4 opens
`/#/review/<id>`, clicks the first enabled **Approve**, and asserts a 2xx
`POST` to the PostgREST `asset_approval_events` endpoint (network-level, not
just UI state).

Exit code `0` = READY, `1` = BLOCKED.

## Output

- `user/frank_create/qa/cliff-access-report-<ts>.json` — machine-readable
- `user/frank_create/qa/cliff-access-report-<ts>.md` — human summary
- `user/frank_create/qa/screens/<ts>_*.png` — evidence screenshots

## What is automated vs. manual

Automated: routing (`/#/health`, `/#/review/<unknown>`), sign-out key
cleanup, non-whitelisted denial, model selectability, empty-prompt Generate
disable, Export-Cliff-Pack disabled when 0 approved.

Manual (flagged `skip` in report — tester marks these in the in-app checklist
at `/#/cliff-access`): live Nano Banana Pro / NB 2 generation rounds, mask
paint, approve flow, Cliff Pack ZIP download, run brief and workflow JSON
secret scans.

The in-app checklist page `/#/cliff-access` mirrors the same phase/row
structure and is the source of truth for the READY/BLOCKED gate.
