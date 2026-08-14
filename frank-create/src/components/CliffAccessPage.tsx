import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Banner, Button, ButtonGroup, Card, DataTable, PageHeader, Text, TextField } from "../ds";
import { Shell } from "../Shell";
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
    <Shell screen="health" maxWidth="var(--content-max-width-one-column)">
      <PageHeader
        title="Cliff access checklist"
        subtitle="Every row passing plus every live probe green is the definition of done. Export the report and attach it to the handover."
        badge={
          ready ? (
            <Badge tone="success" icon="check-circle">Ready to grant access</Badge>
          ) : (
            <Badge tone="critical" icon="exclamation-circle">
              {`${totals.pass} of ${totals.total} rows passing`}
            </Badge>
          )
        }
        actions={
          <>
            <Button icon="arrow-path" loading={running} onClick={runAllProbes}>
              Re-run probes
            </Button>
            <Button icon="document-duplicate" onClick={copyPublished}>
              Copy published URL
            </Button>
            <Button variant="primary" icon="arrow-down-tray" onClick={exportReport}>
              Export JSON report
            </Button>
          </>
        }
      />

      <Card title="Read this first" subtitle="What Cliff needs to know before the first run.">
        <ul className="prose-list">
          <li>
            <strong>Default model.</strong> Nano Banana Pro (<code>gemini-3-pro-image</code>) — best
            quality, 4K, optional Frank Body Mode.
          </li>
          <li>
            <strong>Fast iteration.</strong> Switch to Nano Banana 2 (<code>gemini-3.1-flash-image</code>)
            for quick prompt and reference rounds.
          </li>
          <li>
            <strong>Retouch path.</strong> Paint a mask, save it, then generate — that runs a masked
            edit on the active output.
          </li>
          <li>
            <strong>Handoff.</strong> Approve at least one output, then export the pack. Copy run brief
            and download workflow JSON are safe to share; neither carries a secret.
          </li>
          <li>
            <strong>Cloud build parity.</strong> This deployment runs through the Lovable AI Gateway, so
            no key fields appear. Provider keys are only needed for the local studio via{" "}
            <code>CLIFF_START_HERE.cmd</code>.
          </li>
        </ul>
        <div className="cliff-links">
          <Button url="#/health" target="_blank" icon="signal">
            Open app health
          </Button>
          <Button
            url={`#/review/${encodeURIComponent(sampleSessionId)}`}
            target="_blank"
            icon="users"
          >
            Open sample review board
          </Button>
        </div>
      </Card>

      <Card
        title="Sample session"
        subtitle="Use a session that already has approved assets, so the first click lands on a populated board."
      >
        <TextField
          label="Sample review session id"
          value={sampleSessionId}
          onChange={(e) => persistSampleSessionId(e.target.value)}
          placeholder="Paste a session id that already has approved picks"
          helpText="Stored in this browser only."
          maxWidth={420}
        />
      </Card>

      <Card title="Live probes" subtitle="Run against the deployment you are handing over." padding="none">
        <DataTable
          columns={[
            { key: "check", title: "Probe" },
            { key: "result", title: "Result" },
            { key: "detail", title: "Detail" },
          ]}
          rows={(probes ?? []).map((p) => ({
            id: p.name,
            check: <Text fontWeight="medium">{p.name}</Text>,
            result: p.ok ? <Badge tone="success">Pass</Badge> : <Badge tone="critical">Fail</Badge>,
            detail: (
              <Text tone={p.ok ? "secondary" : "critical"}>
                {p.error ? `error: ${p.error}` : p.detail ?? "—"}
              </Text>
            ),
          }))}
          emptyState={<Text as="p" tone="secondary">Running probes.</Text>}
        />
      </Card>

      {PHASES.map((ph) => {
        const phasePass = ph.rows.filter((r) => state[r.id] === "pass").length;
        return (
          <Card
            key={ph.id}
            title={ph.label}
            subtitle={`${phasePass} of ${ph.rows.length} passing`}
            padding="none"
            actions={
              <Button size="micro" icon="arrow-path" onClick={resetChecklist}>
                Reset checklist
              </Button>
            }
          >
            <ul className="checklist">
              {ph.rows.map((r) => {
                const status: RowStatus = state[r.id] ?? "pending";
                return (
                  <li key={r.id} className={`checklist__row is-${status}`}>
                    <Badge tone={status === "pass" ? "success" : status === "fail" ? "critical" : "neutral"}>
                      {status === "pass" ? "Pass" : status === "fail" ? "Fail" : "Not run"}
                    </Badge>
                    <span className="checklist__label">{r.label}</span>
                    <ButtonGroup variant="segmented">
                      <Button size="micro" pressed={status === "pass"} onClick={() => setRow(r.id, "pass")}>
                        Pass
                      </Button>
                      <Button size="micro" pressed={status === "fail"} onClick={() => setRow(r.id, "fail")}>
                        Fail
                      </Button>
                      <Button size="micro" pressed={status === "pending"} onClick={() => setRow(r.id, "pending")}>
                        Clear
                      </Button>
                    </ButtonGroup>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      {!ready ? (
        <Banner tone="info" title="Not ready to hand over yet">
          <span>
            {totals.total - totals.pass} row{totals.total - totals.pass === 1 ? "" : "s"} still need a
            pass, and every live probe has to be green.
          </span>
        </Banner>
      ) : null}
    </Shell>
  );
}
