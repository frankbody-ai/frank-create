import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchHealth, fetchModels } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

type RowStatus = "pending" | "pass" | "fail";

type Row = {
  id: string;
  label: string;
  auto?: boolean; // if true, live probe drives status
};

type Phase = {
  id: string;
  label: string;
  rows: Row[];
};

const PHASES: Phase[] = [
  {
    id: "phase1",
    label: "Phase 1 — Access & routing",
    rows: [
      { id: "p1-signin", label: "Google sign-in works for whitelisted domain" },
      { id: "p1-deny", label: "Non-whitelisted account is denied + can switch account" },
      { id: "p1-health", label: "/#/health renders all green", auto: true },
      { id: "p1-review-404", label: "/#/review/<unknown-id> renders empty state (no crash)" },
      { id: "p1-signout", label: "Sign out clears sb-* localStorage keys and returns to auth gate" },
    ],
  },
  {
    id: "phase2",
    label: "Phase 2 — Nano Banana Pro loop",
    rows: [
      { id: "p2-select", label: "Select model: Nano Banana Pro (gemini-3-pro-image)" },
      { id: "p2-empty", label: "Empty prompt → Generate button disabled" },
      { id: "p2-gen", label: "Prompt + Frank Body Mode + Product Shot Lab preset → 4K output" },
      { id: "p2-refs", label: "Upload 1–2 reference images → generate uses them" },
      { id: "p2-edit", label: "Run an edit round on returned output" },
      { id: "p2-mask", label: "Paint mask → save → masked-edit Generate returns output" },
    ],
  },
  {
    id: "phase3",
    label: "Phase 3 — Nano Banana 2 loop",
    rows: [
      { id: "p3-switch", label: "Switch to Nano Banana 2 (gemini-3.1-flash-image)" },
      { id: "p3-prompt", label: "Prompt-only round succeeds" },
      { id: "p3-refs", label: "Reference-guided round succeeds" },
    ],
  },
  {
    id: "phase4",
    label: "Phase 4 — Approve / Export / Handoff",
    rows: [
      { id: "p4-export-disabled", label: "Export Cliff Pack disabled with 0 approved" },
      { id: "p4-approve", label: "Approve 2 outputs (audit event inserts 2xx)" },
      { id: "p4-approve-err", label: "Approve while offline surfaces ErrorToast" },
      { id: "p4-board-open", label: "Open review board → populated contact sheet" },
      { id: "p4-sync", label: "Open sync manifest → JSON with frank-create.sync.v1 schema" },
      { id: "p4-zip", label: "Export Cliff Pack → ZIP downloads and opens" },
      { id: "p4-brief", label: "Copy run brief → no secrets in clipboard" },
      { id: "p4-workflow", label: "Download workflow JSON → no secrets in file" },
    ],
  },
];

const STORAGE_KEY = "frank-create.cliff-checklist.v1";

type StateMap = Record<string, RowStatus>;

function loadState(): StateMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function saveState(state: StateMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

type Probe = {
  name: string;
  ok: boolean | null; // null = pending
  detail?: string;
  error?: string;
};

async function runProbes(): Promise<Probe[]> {
  const probes: Probe[] = [];

  try {
    const h = await fetchHealth();
    probes.push({ name: "Backend /health", ok: !!h && (h as any).ok !== false, detail: (h as any)?.product });
  } catch (e: any) {
    probes.push({ name: "Backend /health", ok: false, error: e?.message ?? String(e) });
  }

  try {
    const m: any = await fetchModels();
    const count = m?.models?.length ?? 0;
    probes.push({ name: "AI models available", ok: count > 0, detail: `${count} models` });
  } catch (e: any) {
    probes.push({ name: "AI models available", ok: false, error: e?.message ?? String(e) });
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const email = data.session?.user?.email;
    probes.push({
      name: "Auth session",
      ok: !!email,
      detail: email ? `signed in as ${email}` : "no session",
    });
  } catch (e: any) {
    probes.push({ name: "Auth session", ok: false, error: e?.message ?? String(e) });
  }

  // Verify RLS lets the signed-in user read their own approval events.
  try {
    const { error, count } = await supabase
      .from("asset_approval_events")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    probes.push({
      name: "asset_approval_events RLS (select)",
      ok: true,
      detail: `own rows visible: ${count ?? 0}`,
    });
  } catch (e: any) {
    probes.push({
      name: "asset_approval_events RLS (select)",
      ok: false,
      error: e?.message ?? String(e),
    });
  }

  probes.push({
    name: "Browser online",
    ok: navigator.onLine,
    detail: navigator.onLine ? "online" : "offline",
  });

  return probes;
}

const SAMPLE_SESSION_KEY = "frank-create.cliff-sample-session-id";


export function CliffAccessPage() {
  const [state, setState] = useState<StateMap>(() => loadState());
  const [probes, setProbes] = useState<Probe[] | null>(null);
  const [running, setRunning] = useState(false);
  const [sampleSessionId, setSampleSessionId] = useState<string>(() => {
    try {
      return localStorage.getItem(SAMPLE_SESSION_KEY) ?? "sample-session";
    } catch {
      return "sample-session";
    }
  });

  const persistSampleSessionId = (val: string) => {
    setSampleSessionId(val);
    try { localStorage.setItem(SAMPLE_SESSION_KEY, val); } catch { /* ignore */ }
  };




  const runAllProbes = useCallback(async () => {
    setRunning(true);
    const p = await runProbes();
    setProbes(p);
    setRunning(false);
    // Auto-mark the /#/health row from probe result
    const healthOk = p.every((x) => x.ok);
    setState((prev) => {
      const next = { ...prev, "p1-health": (healthOk ? "pass" : "fail") as RowStatus };
      saveState(next);
      return next;
    });
  }, []);

  useEffect(() => {
    runAllProbes();
  }, [runAllProbes]);

  const setRow = (id: string, status: RowStatus) => {
    setState((prev) => {
      const next = { ...prev, [id]: status };
      saveState(next);
      return next;
    });
  };

  const totals = useMemo(() => {
    let pass = 0;
    let total = 0;
    for (const ph of PHASES) {
      for (const r of ph.rows) {
        total++;
        if (state[r.id] === "pass") pass++;
      }
    }
    return { pass, total };
  }, [state]);

  const probesAllOk = (probes ?? []).length > 0 && (probes ?? []).every((p) => p.ok === true);
  const ready = totals.pass === totals.total && probesAllOk;

  const publishedUrl = "https://frank-create.lovable.app";

  const copyPublished = async () => {
    try {
      await navigator.clipboard.writeText(publishedUrl);
    } catch {
      /* ignore */
    }
  };

  const resetChecklist = () => {
    if (!confirm("Reset all checklist rows to pending?")) return;
    setState({});
    saveState({});
  };

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      publishedUrl,
      ready,
      totals,
      phases: PHASES.map((ph) => ({
        id: ph.id,
        label: ph.label,
        rows: ph.rows.map((r) => ({ id: r.id, label: r.label, status: state[r.id] ?? "pending" })),
      })),
      probes,
      user: navigator.userAgent,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `cliff-access-report-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="frank-health-page" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <header className="frank-health-header">
        <h1>Cliff Access Checklist</h1>
        <p className={`frank-health-overall ${ready ? "ok" : "bad"}`}>
          {ready ? "READY to grant Cliff access" : `BLOCKED — ${totals.pass}/${totals.total} rows passing`}
        </p>
        <div className="frank-health-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="#/health" target="_blank" rel="noreferrer">Open /health ↗</a>
          <a href={`#/review/${encodeURIComponent(sampleSessionId)}`} target="_blank" rel="noreferrer">
            Open sample review board ↗
          </a>

          <button type="button" onClick={copyPublished}>Copy published URL</button>
          <button type="button" onClick={runAllProbes} disabled={running}>
            {running ? "Probing…" : "Re-run probes"}
          </button>
          <button type="button" onClick={exportReport}>Export JSON report</button>
          <button type="button" onClick={resetChecklist}>Reset</button>
          <a href="/">← Back to app</a>
        </div>
      </header>

      <section style={{ marginTop: 24, padding: 16, border: "1px solid #333", borderRadius: 8 }}>
        <h2 style={{ fontSize: 16, marginTop: 0 }}>README for Cliff (read first)</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>
            <strong>Default model:</strong> Nano Banana Pro (<code>gemini-3-pro-image</code>) — best quality
            + 4K + optional Frank Body Mode.
          </li>
          <li>
            <strong>Fast iteration:</strong> switch to Nano Banana 2 (<code>gemini-3.1-flash-image</code>)
            for quick prompt/reference rounds.
          </li>
          <li>
            <strong>Retouch path:</strong> Mask painter → Save mask → Generate runs a masked edit on the
            active output.
          </li>
          <li>
            <strong>Handoff:</strong> Approve at least one output, then <em>Export Cliff Pack</em> for the
            ZIP; <em>Copy run brief</em> and <em>Download workflow JSON</em> are safe to share (no secrets).
          </li>
          <li>
            <strong>Cloud build parity note:</strong> This deployment uses the Lovable AI Gateway, so the
            Provider Setup screen does not show key input fields. Gemini / OpenAI / Replicate keys are only
            required when running the local Studio via <code>CLIFF_START_HERE.cmd</code>.
          </li>
          <li>
            <strong>Deep links:</strong>{" "}
            <a href="#/health" target="_blank" rel="noreferrer">/#/health</a> for backend status,{" "}
            <a href={`#/review/${encodeURIComponent(sampleSessionId)}`} target="_blank" rel="noreferrer">
              /#/review/{sampleSessionId}
            </a>{" "}
            for the shared review board.
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16, padding: 12, border: "1px solid #333", borderRadius: 8 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <span style={{ minWidth: 160 }}>Sample review session id:</span>
          <input
            type="text"
            value={sampleSessionId}
            onChange={(e) => persistSampleSessionId(e.target.value)}
            style={{ flex: 1, padding: "4px 8px" }}
            placeholder="paste a pre-approved session id"
          />
        </label>
        <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0 0" }}>
          Persisted locally. Use the id of a session that already has approved assets so Cliff&apos;s first
          click on “Open sample review board” lands on a populated contact sheet, not an empty state.
        </p>
      </section>


      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Live probes</h2>
        <ul className="frank-health-list">
          {(probes ?? []).map((p) => (
            <li key={p.name} className={`frank-health-row ${p.ok ? "ok" : "bad"}`}>
              <span className="frank-health-icon">{p.ok ? "✓" : "✗"}</span>
              <span className="frank-health-name">{p.name}</span>
              <span className="frank-health-detail">{p.error ? `error: ${p.error}` : p.detail ?? ""}</span>
            </li>
          ))}
          {!probes && <li className="frank-health-row">Running…</li>}
        </ul>
      </section>

      {PHASES.map((ph) => {
        const phasePass = ph.rows.filter((r) => state[r.id] === "pass").length;
        return (
          <section key={ph.id} style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>
              {ph.label} — {phasePass}/{ph.rows.length}
            </h2>
            <ul className="frank-health-list">
              {ph.rows.map((r) => {
                const status: RowStatus = state[r.id] ?? "pending";
                return (
                  <li
                    key={r.id}
                    className={`frank-health-row ${status === "pass" ? "ok" : status === "fail" ? "bad" : ""}`}
                  >
                    <span className="frank-health-icon">
                      {status === "pass" ? "✓" : status === "fail" ? "✗" : "·"}
                    </span>
                    <span className="frank-health-name" style={{ flex: 1 }}>{r.label}</span>
                    <span style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => setRow(r.id, "pass")} disabled={status === "pass"}>
                        Pass
                      </button>
                      <button type="button" onClick={() => setRow(r.id, "fail")} disabled={status === "fail"}>
                        Fail
                      </button>
                      <button type="button" onClick={() => setRow(r.id, "pending")} disabled={status === "pending"}>
                        Reset
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <footer style={{ marginTop: 32, fontSize: 12, opacity: 0.7 }}>
        Definition of done: every row passing + all live probes green. Then export the JSON report
        and attach it to the Cliff handover.
      </footer>
    </div>
  );
}
