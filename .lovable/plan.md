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

1. **[DONE] Provider Setup parity note in-app.** Rendered in the README-for-Cliff card on `/#/cliff-access` so testers and Cliff see the cloud-vs-local key story before flagging it as a missing feature.
2. **[AUTO-PROBED] `asset_approval_events` audit verification.** `/#/cliff-access` now runs a live `select id` against `asset_approval_events` on load; if RLS blocks the signed-in user the row goes red and Phase 4 can't reach READY. Existing migration `20260701113526` already grants insert/select — this probe catches regressions.
3. **[MANUAL] Cliff Pack cloud path smoke.** Still needs a live click-through: sign in, approve 2 assets in a real session, hit Export Cliff Pack, confirm the ZIP downloads and opens. The Phase 4 checklist row (`p4-zip`) tracks it.
4. **[UI-READY] Sample review board seed.** `/#/cliff-access` now has a persisted "Sample review session id" input; paste a session id that already has approved assets and the "Open sample review board" link routes there. Still need to actually create + note one pre-seeded session.
5. **[DONE] README-for-Cliff card** rendered at the top of `/#/cliff-access`: NB Pro default, NB 2 fast path, masked edit for retouch, Cliff Pack for handoff, plus the Provider Setup parity note and deep links.


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
