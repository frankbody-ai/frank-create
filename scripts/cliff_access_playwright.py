#!/usr/bin/env python3
"""
Cliff Access Playwright runbook.

Runs Phase 1–4 of the pre-handover suite against the published Frank Create app
and emits a pass/fail report (JSON + Markdown) plus screenshots.

Env vars:
  CLIFF_QA_URL                  Target URL (default: https://frank-create.lovable.app)
  CLIFF_QA_EMAIL                Whitelisted Google account email (for report metadata only)
  CLIFF_QA_STORAGE_STATE        Path to Playwright storage_state.json for the whitelisted
                                account. Generate once with:
                                    playwright codegen --save-storage=state.json <URL>
  CLIFF_QA_DENY_STORAGE_STATE   Optional storage_state.json for a non-whitelisted account
                                (Phase 1 denial check). Skipped if missing.
  CLIFF_QA_OUT                  Output directory (default: user/frank_create/qa)
  CLIFF_QA_HEADLESS             "0" to run headed (default: headless)

Exit code:
  0 = READY, 1 = BLOCKED
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

URL = os.environ.get("CLIFF_QA_URL", "https://frank-create.lovable.app").rstrip("/")
OUT_DIR = Path(os.environ.get("CLIFF_QA_OUT", "user/frank_create/qa"))
STORAGE_STATE = os.environ.get("CLIFF_QA_STORAGE_STATE")
DENY_STORAGE_STATE = os.environ.get("CLIFF_QA_DENY_STORAGE_STATE")
QA_EMAIL = os.environ.get("CLIFF_QA_EMAIL", "unknown")
HEADLESS = os.environ.get("CLIFF_QA_HEADLESS", "1") != "0"

SECRET_PATTERNS = [
    re.compile(r"LOVABLE_API_KEY", re.I),
    re.compile(r"GOOGLE_API_KEY", re.I),
    re.compile(r"OPENAI_API_KEY", re.I),
    re.compile(r"REPLICATE_API_TOKEN", re.I),
    re.compile(r"SUPABASE_SERVICE_ROLE_KEY", re.I),
    re.compile(r"sb_secret_[A-Za-z0-9_-]+"),
    re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}"),  # JWT
]


def contains_secret(text: str | None) -> str | None:
    if not text:
        return None
    for pat in SECRET_PATTERNS:
        m = pat.search(text)
        if m:
            return m.group(0)[:24] + "…"
    return None


class Runner:
    def __init__(self, out_dir: Path):
        self.out_dir = out_dir
        self.out_dir.mkdir(parents=True, exist_ok=True)
        (self.out_dir / "screens").mkdir(exist_ok=True)
        self.results: list[dict[str, Any]] = []
        self.ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    def record(self, phase: str, step: str, status: str, notes: str = "", evidence: str = ""):
        entry = {"phase": phase, "step": step, "status": status, "notes": notes, "evidence": evidence}
        self.results.append(entry)
        icon = {"pass": "✓", "fail": "✗", "skip": "·"}.get(status, "?")
        print(f"  {icon} [{phase}] {step} — {status}{(': ' + notes) if notes else ''}", flush=True)

    async def shot(self, page: Page, name: str) -> str:
        path = self.out_dir / "screens" / f"{self.ts}_{name}.png"
        try:
            await page.screenshot(path=str(path))
        except Exception as e:
            return f"(screenshot failed: {e})"
        return str(path.relative_to(self.out_dir))

    def summary(self) -> dict[str, Any]:
        counts = {"pass": 0, "fail": 0, "skip": 0}
        for r in self.results:
            counts[r["status"]] = counts.get(r["status"], 0) + 1
        ready = counts["fail"] == 0 and counts["pass"] > 0
        return {"counts": counts, "ready": ready, "total": len(self.results)}

    def write_reports(self):
        summary = self.summary()
        report = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "url": URL,
            "qaEmail": QA_EMAIL,
            "summary": summary,
            "results": self.results,
        }
        json_path = self.out_dir / f"cliff-access-report-{self.ts}.json"
        json_path.write_text(json.dumps(report, indent=2))

        md_lines = [
            f"# Cliff Access Report — {self.ts}",
            "",
            f"- URL: {URL}",
            f"- Tester: {QA_EMAIL}",
            f"- **Status: {'READY' if summary['ready'] else 'BLOCKED'}**",
            f"- Counts: pass={summary['counts']['pass']} fail={summary['counts']['fail']} skip={summary['counts']['skip']}",
            "",
            "| Phase | Step | Status | Notes | Evidence |",
            "| --- | --- | --- | --- | --- |",
        ]
        for r in self.results:
            md_lines.append(
                f"| {r['phase']} | {r['step']} | {r['status']} | {r['notes'].replace('|', '\\|')} | {r['evidence']} |"
            )
        md_path = self.out_dir / f"cliff-access-report-{self.ts}.md"
        md_path.write_text("\n".join(md_lines))
        print(f"\nReports written:\n  {json_path}\n  {md_path}", flush=True)
        return summary


async def new_context(browser: Browser, storage_state: str | None) -> BrowserContext:
    kwargs: dict[str, Any] = {"viewport": {"width": 1280, "height": 1800}}
    if storage_state and Path(storage_state).exists():
        kwargs["storage_state"] = storage_state
    return await browser.new_context(**kwargs)


# ---------- Phase 1 ----------
async def phase_1(browser: Browser, r: Runner):
    print("\n== Phase 1 — Access & routing ==", flush=True)

    # Authed session probe
    if STORAGE_STATE and Path(STORAGE_STATE).exists():
        ctx = await new_context(browser, STORAGE_STATE)
        page = await ctx.new_page()
        await page.goto(URL, wait_until="domcontentloaded")
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
        shot = await r.shot(page, "p1_signin")
        html = (await page.content()).lower()
        signed_in = "sign in" not in html and "continue with google" not in html
        r.record("Phase 1", "Whitelisted account reaches Studio", "pass" if signed_in else "fail",
                 evidence=shot)

        # /#/health
        await page.goto(f"{URL}/#/health", wait_until="domcontentloaded")
        await asyncio.sleep(4)
        shot = await r.shot(page, "p1_health")
        content = await page.content()
        health_ok = "operational" in content.lower() or content.lower().count("✓") >= 3
        r.record("Phase 1", "/#/health renders green", "pass" if health_ok else "fail",
                 evidence=shot)

        # /#/review/nonexistent
        await page.goto(f"{URL}/#/review/nonexistent-cliff-qa", wait_until="domcontentloaded")
        await asyncio.sleep(3)
        shot = await r.shot(page, "p1_review_404")
        try:
            body = await page.locator("body").inner_text(timeout=5000)
            crashed = "something went wrong" in body.lower() or "uncaught" in body.lower()
        except Exception:
            crashed = True
        r.record("Phase 1", "/#/review/<unknown> renders without crash",
                 "pass" if not crashed else "fail", evidence=shot)

        # Sign-out key cleanup: navigate back, look for sign-out control, then verify sb-* gone
        await page.goto(URL, wait_until="domcontentloaded")
        await asyncio.sleep(2)
        sb_before = await page.evaluate(
            "Object.keys(localStorage).filter(k => k.startsWith('sb-')).length"
        )
        clicked = False
        for label in ["Sign out", "Sign Out", "Log out", "Logout"]:
            try:
                btn = page.get_by_role("button", name=re.compile(label, re.I))
                if await btn.count() > 0:
                    await btn.first.click(timeout=3000)
                    clicked = True
                    break
            except Exception:
                continue
        if clicked:
            await asyncio.sleep(3)
            sb_after = await page.evaluate(
                "Object.keys(localStorage).filter(k => k.startsWith('sb-')).length"
            )
            shot = await r.shot(page, "p1_signout")
            r.record("Phase 1", "Sign-out clears sb-* localStorage keys",
                     "pass" if sb_after == 0 else "fail",
                     notes=f"before={sb_before} after={sb_after}", evidence=shot)
        else:
            r.record("Phase 1", "Sign-out clears sb-* localStorage keys", "skip",
                     notes="Sign-out control not found")
        await ctx.close()
    else:
        r.record("Phase 1", "Whitelisted account reaches Studio", "skip",
                 notes="CLIFF_QA_STORAGE_STATE not set")
        r.record("Phase 1", "/#/health renders green", "skip",
                 notes="Needs authed session for full check")
        r.record("Phase 1", "/#/review/<unknown> renders without crash", "skip")
        r.record("Phase 1", "Sign-out clears sb-* localStorage keys", "skip")

    # Denied account
    if DENY_STORAGE_STATE and Path(DENY_STORAGE_STATE).exists():
        ctx = await new_context(browser, DENY_STORAGE_STATE)
        page = await ctx.new_page()
        await page.goto(URL, wait_until="domcontentloaded")
        await asyncio.sleep(3)
        shot = await r.shot(page, "p1_denied")
        body = (await page.locator("body").inner_text()).lower()
        denied = "access is restricted" in body or "different account" in body
        r.record("Phase 1", "Non-whitelisted account is denied",
                 "pass" if denied else "fail", evidence=shot)
        await ctx.close()
    else:
        r.record("Phase 1", "Non-whitelisted account is denied", "skip",
                 notes="CLIFF_QA_DENY_STORAGE_STATE not set")


# ---------- Phase 2/3 — model loops (mostly manual, we assert what's cheap) ----------
async def phase_model(browser: Browser, r: Runner, phase: str, model_label_regex: str,
                      expected_provider_model: str):
    print(f"\n== {phase} ==", flush=True)
    if not (STORAGE_STATE and Path(STORAGE_STATE).exists()):
        for step in ["Model selectable", "Empty prompt disables Generate", "Live generate returns image"]:
            r.record(phase, step, "skip", notes="No auth storage state")
        return

    ctx = await new_context(browser, STORAGE_STATE)
    page = await ctx.new_page()

    # Watch for generation network activity
    gen_responses: list[dict[str, Any]] = []

    def on_response(resp):
        url = resp.url
        if "frank-generate" in url or "generate" in url.lower():
            gen_responses.append({"url": url, "status": resp.status})

    page.on("response", on_response)

    await page.goto(URL, wait_until="domcontentloaded")
    try:
        await page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass

    # Try to find and select the model
    selected = False
    try:
        # Attempt a few common selectors
        for sel in [f"text=/{model_label_regex}/i"]:
            el = page.locator(sel)
            if await el.count() > 0:
                await el.first.click(timeout=3000)
                selected = True
                break
    except Exception:
        pass
    shot = await r.shot(page, f"{phase.lower().replace(' ', '_')}_select")
    r.record(phase, f"Select model matching /{model_label_regex}/",
             "pass" if selected else "fail",
             notes=f"target: {expected_provider_model}", evidence=shot)

    # Empty-prompt: find Generate button, check disabled
    try:
        gen = page.get_by_role("button", name=re.compile("^generate", re.I)).first
        if await gen.count() > 0:
            disabled = await gen.is_disabled()
            r.record(phase, "Empty prompt disables Generate",
                     "pass" if disabled else "fail")
        else:
            r.record(phase, "Empty prompt disables Generate", "skip",
                     notes="Generate button not found")
    except Exception as e:
        r.record(phase, "Empty prompt disables Generate", "fail", notes=str(e))

    # Live generation is flagged manual — visual quality judgement + provider cost.
    r.record(phase, "Live generate returns image", "skip",
             notes="Manual visual check required — capture screenshot after prompt run")

    await ctx.close()


# ---------- Phase 4 — Approve / Export / Handoff ----------
async def phase_4(browser: Browser, r: Runner):
    print("\n== Phase 4 — Approve / Export / Handoff ==", flush=True)
    if not (STORAGE_STATE and Path(STORAGE_STATE).exists()):
        for step in ["Export disabled when empty", "Cliff Pack downloads",
                     "Run brief clipboard is secret-free", "Sync manifest schema"]:
            r.record("Phase 4", step, "skip", notes="No auth storage state")
        return

    ctx = await new_context(browser, STORAGE_STATE)
    page = await ctx.new_page()

    # Capture PostgREST writes to asset_approval_events across the whole phase.
    approval_events: list[dict[str, Any]] = []

    def on_response(resp):
        try:
            url = resp.url
            method = resp.request.method
        except Exception:
            return
        if "asset_approval_events" in url and method in ("POST", "PATCH"):
            approval_events.append({"url": url, "status": resp.status, "method": method})

    page.on("response", on_response)

    await page.goto(URL, wait_until="domcontentloaded")
    await asyncio.sleep(4)

    # Export disabled?
    try:
        export = page.get_by_role("button", name=re.compile("export.*cliff", re.I)).first
        if await export.count() > 0:
            disabled = await export.is_disabled()
            shot = await r.shot(page, "p4_export_disabled")
            r.record("Phase 4", "Export Cliff Pack disabled when 0 approved",
                     "pass" if disabled else "fail", evidence=shot)
        else:
            r.record("Phase 4", "Export Cliff Pack disabled when 0 approved", "skip",
                     notes="Export button not visible on default view")
    except Exception as e:
        r.record("Phase 4", "Export Cliff Pack disabled when 0 approved", "fail", notes=str(e))

    # Active approve probe: navigate to sample review session, click first Approve, assert insert.
    sample_session = os.environ.get("CLIFF_QA_SAMPLE_SESSION")
    if not sample_session:
        try:
            sample_session = await page.evaluate(
                "localStorage.getItem('cliff.qa.sampleSessionId')"
            )
        except Exception:
            sample_session = None

    if sample_session:
        try:
            await page.goto(f"{URL}/#/review/{sample_session}", wait_until="domcontentloaded")
            await asyncio.sleep(4)
            shot_before = await r.shot(page, "p4_review_board")
            approve = page.get_by_role("button", name=re.compile(r"^approve", re.I)).first
            if await approve.count() > 0 and not await approve.is_disabled():
                approval_events.clear()
                await approve.click(timeout=5000)
                for _ in range(20):
                    if approval_events:
                        break
                    await asyncio.sleep(0.5)
                shot_after = await r.shot(page, "p4_approve_clicked")
                if not approval_events:
                    r.record("Phase 4", "Approve inserts audit event 2xx", "fail",
                             notes="No POST /asset_approval_events observed within 10s",
                             evidence=shot_after)
                else:
                    last = approval_events[-1]
                    ok = 200 <= last["status"] < 300
                    r.record("Phase 4", "Approve inserts audit event 2xx",
                             "pass" if ok else "fail",
                             notes=f"{last['method']} {last['status']}",
                             evidence=shot_after)
                r.record("Phase 4", "Open review board populated", "pass",
                         notes=f"session={sample_session}", evidence=shot_before)
            else:
                r.record("Phase 4", "Approve inserts audit event 2xx", "skip",
                         notes="No enabled Approve button on sample board",
                         evidence=shot_before)
                r.record("Phase 4", "Open review board populated", "fail",
                         notes="No approvable assets in sample session",
                         evidence=shot_before)
        except Exception as e:
            r.record("Phase 4", "Approve inserts audit event 2xx", "fail", notes=str(e))
            r.record("Phase 4", "Open review board populated", "fail", notes=str(e))
    else:
        r.record("Phase 4", "Approve inserts audit event 2xx", "skip",
                 notes="Set CLIFF_QA_SAMPLE_SESSION or seed sample id via /#/cliff-access")
        r.record("Phase 4", "Open review board populated", "skip",
                 notes="No sample session id available")

    for step in ["Sync manifest matches frank-create.sync.v1",
                 "Cliff Pack ZIP downloads and opens",
                 "Run brief clipboard is secret-free",
                 "Workflow JSON download is secret-free"]:
        r.record("Phase 4", step, "skip", notes="Manual — requires live approved assets")

    await ctx.close()


async def main():
    print(f"Cliff Access runbook → {URL}", flush=True)
    print(f"Output dir: {OUT_DIR.resolve()}", flush=True)
    r = Runner(OUT_DIR)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        try:
            await phase_1(browser, r)
            await phase_model(browser, r, "Phase 2 — Nano Banana Pro",
                              r"nano\s*banana\s*pro|gemini.*3.*pro.*image", "gemini-3-pro-image")
            await phase_model(browser, r, "Phase 3 — Nano Banana 2",
                              r"nano\s*banana\s*2|nb\s*2|gemini.*3\.1.*flash.*image",
                              "gemini-3.1-flash-image")
            await phase_4(browser, r)
        finally:
            await browser.close()

    summary = r.write_reports()
    print(f"\nStatus: {'READY' if summary['ready'] else 'BLOCKED'} "
          f"({summary['counts']['pass']} pass / {summary['counts']['fail']} fail / "
          f"{summary['counts']['skip']} skip)", flush=True)
    sys.exit(0 if summary["ready"] else 1)


if __name__ == "__main__":
    asyncio.run(main())
