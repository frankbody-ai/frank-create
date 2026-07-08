# Cliff Access Readiness — Build Plan

Three deliverables, in order. All scoped to `frank-create/` SPA + a new `scripts/` playwright runbook. No changes to edge functions, schema, or Lovable Cloud backend.

---

## 1. In-app Cliff Access Checklist page

**Route:** `/#/cliff-access` (hash route, same pattern as `/#/health` and `/#/review/:id`).

**File:** `frank-create/src/components/CliffAccessPage.tsx` (new)
**Wire-up:** `frank-create/src/main.tsx` — add `isCliffRoute` check next to `isHealthRoute`, render behind `AuthGate`.

**UI layout (single scrollable page, Frank dark theme):**

```text
+------------------------------------------------------+
| Frank Create — Cliff Access Checklist                |
| Status: READY / BLOCKED  (auto-derived)              |
+------------------------------------------------------+
| Quick links                                          |
|   [ Open /health ]   [ Open sample review board ]    |
|   [ Copy published URL ]                             |
+------------------------------------------------------+
| Phase 1 — Access & routing         3/5 passing       |
|  [x] Google sign-in whitelisted domain               |
|  [x] Non-whitelisted denied                          |
|  [ ] /#/health renders green                         |
|  ...                                                 |
| Phase 2 — Nano Banana Pro loop     0/6                |
| Phase 3 — Nano Banana 2 loop       0/2                |
| Phase 4 — Approve/Export/Handoff   0/8                |
+------------------------------------------------------+
| Live probes (auto-run on load)                       |
|   Edge fn frank-generate: OK / FAIL                  |
|   Storage bucket studio-images: OK / FAIL            |
|   AI gateway reachable: OK / FAIL                    |
|   Current user email + allowed?: didac@...  YES      |
+------------------------------------------------------+
| [ Mark all Phase 1 verified ]  [ Reset checklist ]   |
| [ Export JSON report ]                               |
+------------------------------------------------------+
```

**Behavior:**
- Checklist state persisted to `localStorage` under `frank-create.cliff-checklist.v1` so testers survive refresh.
- Each row: checkbox + label + optional "run" button for auto-verifiable items (routing, edge-fn ping, sign-out key cleanup).
- Auto-run probes on mount: reuses existing `HealthPage` checks (edge-fn OPTIONS, storage HEAD, AI gateway probe).
- `Export JSON report` → downloads `cliff-access-report-<timestamp>.json` with pass/fail per row + probe results + user email + timestamp.
- Top status pill flips to **READY** only when every row is checked AND all live probes pass.
- No new backend calls beyond what `HealthPage` already does.

**Discoverability:** small "Cliff Access" link in the auth'd shell footer (App.tsx nav footer only, not the auth gate).

---

## 2. Playwright runbook — Phase 1–4 against production

**File:** `scripts/cliff_access_playwright.py` (new; sibling of existing `scripts/Test-FrankCreate*.ps1`)
**Target:** `https://frank-create.lovable.app`
**Runtime:** Python + Playwright (already used elsewhere per browser-use conventions).
**Output:** `user/frank_create/qa/cliff-access-report-<timestamp>.{json,md}` + screenshots per step.

**Inputs (env vars, never hardcoded):**
- `CLIFF_QA_EMAIL` + `CLIFF_QA_GOOGLE_STORAGE_STATE` (path to a pre-authed Playwright storage_state.json for the whitelisted Google account — Google OAuth cannot be automated fresh in headless Chromium).
- `CLIFF_QA_DENY_STORAGE_STATE` (optional, for the non-whitelisted denial check).

**Phase mapping (matches the review I gave earlier):**

| Phase | Steps automated | Steps flagged manual |
|---|---|---|
| 1 Access & routing | Load `/#/health`, `/#/review/nonexistent`, sign-out key cleanup, storage assertions | Fresh Google OAuth (uses storage_state instead) |
| 2 Nano Banana Pro loop | Model select, empty-prompt disabled, prompt+preset generate, ref upload, edit round, masked edit | Visual quality judgement (screenshot only) |
| 3 Nano Banana 2 loop | Model switch, prompt-only + reference round | Same |
| 4 Approve/Export/Handoff | Export disabled empty, approve 2, network assert `asset_approval_events` 200, open review board tab, open sync manifest, download Cliff Pack ZIP, copy run brief secret-scan, download workflow JSON secret-scan | ZIP contents byte-check (done post-run by existing `VERIFY_CLIFF_PACK.cmd`) |

**Per-step contract:**
- Screenshot on entry + on assertion.
- Structured log line: `{phase, step, status: pass|fail|skip, evidence: path, notes}`.
- Network interception to assert:
  - `frank-generate` returns 200 with image URL.
  - `asset_approval_events` insert returns 2xx.
  - No response body visible to client contains `LOVABLE_API_KEY`, `GOOGLE_API_KEY`, `sb_secret_`, or bearer JWT patterns.
- Clipboard read via `page.evaluate(navigator.clipboard.readText)` for run-brief secret scan.
- Downloaded Cliff Pack ZIP saved to output dir; runbook only checks it opened, exists, and is >0 bytes — deep byte verification stays in `VERIFY_CLIFF_PACK.cmd`.

**Report shape:**
- `cliff-access-report-<ts>.json` — machine-readable phase/step/status array + summary counts + pass/fail overall.
- `cliff-access-report-<ts>.md` — human summary with inline screenshot links, mirrors the in-app checklist row order.
- Exit code 0 = READY, 1 = BLOCKED (for CI use).

**Wrapper:** `scripts/Test-FrankCreateCliffAccess.ps1` — thin PowerShell that sets env, runs the Python script, opens the MD report.

---

## 3. Roadmap to complete remaining Cliff requirements

Grouped by what actually blocks handover vs. what Cliff will notice but accept.

### 3a. Must-close before granting Cliff access

1. **Provider Setup parity note in-app.** Cliff's spec assumes a Provider Setup screen. Cloud build uses Lovable AI Gateway so no key fields exist. Add a small "Provider Setup" panel in Studio settings that shows: "Cloud build — keys managed via Lovable AI Gateway. Local Studio (`CLIFF_START_HERE.cmd`) exposes Gemini/OpenAI/Replicate key fields." Prevents "missing feature" flag.
2. **`asset_approval_events` audit verification.** Confirm the RLS policy allows the signed-in user to insert their approve/reject events; if the Phase 4 network assert fails, add the missing policy in a migration and re-run.
3. **Cliff Pack cloud path smoke.** Verify `supabase/functions/frank-api/handoff.ts` actually returns a ZIP when called from the cloud build (not just locally). Fix if the edge fn is missing dependencies or storage grants.
4. **Sample review board seed.** Provide one shareable session ID with pre-approved assets so Cliff's very first click on "Open sample review board" from the checklist shows a populated board, not an empty state.
5. **README-for-Cliff card** on `/#/cliff-access` linking to `FRANK_CREATE_DEMO.md` highlights: NB Pro is default, NB 2 is the fast path, masked edit is the retouch path, Cliff Pack is the handoff.

### 3b. Nice-to-have, ship if time allows

6. **Session share link with expiring token** for review board (currently anyone auth'd in the domain can view any session ID they know). Signed URL or `share_tokens` table.
7. **Cliff-only role.** Add `app_role = 'cliff'` via the standard `user_roles` pattern; scope review board + Cliff Pack read to that role + Frank/Autosolutions domains. Gives clean revocation later.
8. **Responsive collapse ≥915px (FC-011)** at least for the Studio shell so Cliff's laptop doesn't horizontal-scroll.

### 3c. Explicitly deferred, disclosed to Cliff

9. FC-008 Lovable auth-bridge branding on published URL — hosting concern.
10. FC-010 anon key in bundle — expected Supabase behavior, note in security memory.
11. Full local Comfy checkpoint parity in cloud build — not feasible; direct Cliff to local Studio for that path.

### Sequencing

```text
Day 1  → 1 (checklist UI) + 2 (Playwright runbook)  [this plan's build phase]
Day 2  → 3a items 1–5  (parity note, audit fix, cloud handoff smoke, seed, readme card)
Day 3  → Run Playwright runbook end-to-end, resolve reds
Day 4  → 3b items if green; otherwise ship as-is with 3c disclosures
Day 5  → Grant Cliff access, keep runbook on a daily cron for regression
```

### Definition of done for handover

- `/#/cliff-access` shows READY with all phases checked and probes green.
- Latest `cliff-access-report-*.md` exit-code 0, attached to the handover email.
- Sample review board session ID + Cliff Pack ZIP link included.
- One-paragraph note to Cliff covering the three deferred items (3c) so nothing looks like a bug on his first login.

---

## Technical details (for the build phase)

- `CliffAccessPage.tsx` reuses `HealthPage`'s probe helpers — extract them into `frank-create/src/lib/healthProbes.ts` on the way in so both pages share one source of truth.
- Checklist state type lives in `frank-create/src/lib/cliffChecklist.ts`: `{ version: 1, phases: Array<{id, label, rows: Array<{id, label, status: 'pending'|'pass'|'fail', evidence?: string}>}> }`.
- Route wire-up in `main.tsx`:

  ```ts
  const isCliffRoute = hashPath === "/cliff-access" || pathname === "/cliff-access";
  ```

- Playwright script structure: one `async def phase_N(page, ctx)` per phase, each appends to a shared `results` list; `main()` writes JSON+MD at the end.
- Secret-scan regexes reused across clipboard, downloaded JSON, and network response bodies — one helper `contains_secret(text: str) -> Optional[str]`.
- Storage state generation documented in a short `scripts/README-cliff-qa.md` (one-time manual Google sign-in with `playwright codegen`, save `storage_state.json`, path passed via env).
