import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Badge,
  Banner,
  Button,
  Card,
  DataTable,
  Icon,
  PageHeader,
  Select,
  Spinner,
  Text,
  TextField,
} from "../ds";
import type { DataTableColumn } from "../ds";
import { Shell } from "../Shell";
import { navigate } from "../nav";
import { assetStatusCopy } from "../lib/frankWorkflow";
import {
  assetDownloadUrl,
  createSessionHandoffStream,
  fetchSessionApprovalHistory,
  resumeSessionHandoffStream,
  sessionReviewBoardUrl,
  sessionSyncManifestUrl,
  updateAsset,
  HandoffError,
  type HandoffStage,
  type HandoffStreamStep,
} from "../lib/api";
import type { ApprovalStatus, Asset } from "../lib/types";
import { supabase } from "../lib/supabaseClient";


type Board = {
  session_id: string;
  generated_at: string;
  assets: Asset[];
  approved: Asset[];
};

type StepState = { key: string; label: string; status: "pending" | "active" | "done" };

type Toast = {
  id: number;
  kind: "info" | "error" | "success" | "progress";
  text: string;
  startedAt?: number;
  onCancel?: () => void;
  onRetry?: () => void;
  sticky?: boolean;
  steps?: StepState[];
  progress?: number;
};

type AuditEvent = {
  id: string;
  asset_id: string;
  prev_status: string | null;
  new_status: string;
  created_at: string;
  note?: string | null;
  user_id?: string | null;
};

async function authedFetch(url: string, signal?: AbortSignal) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

function triggerDownload(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function validateManifestClient(m: any): string[] {
  const issues: string[] = [];
  if (!m || typeof m !== "object") { issues.push("manifest missing"); return issues; }
  if (m.schema !== "frank-create.handoff") issues.push("schema mismatch");
  if (m.schema_version !== 1) issues.push("schema_version mismatch");
  if (!Array.isArray(m.assets)) issues.push("assets not array");
  if (!Array.isArray(m.turns)) issues.push("turns not array");
  if (!Array.isArray(m.blueprints)) issues.push("blueprints not array");
  const req = ["id", "title", "media_type", "approval_status", "blueprint"];
  (m.assets || []).forEach((a: any, i: number) => {
    for (const f of req) if (!(f in a)) issues.push(`assets[${i}].${f} missing`);
  });
  return issues;
}

const HANDOFF_STEPS: StepState[] = [
  { key: "fetch", label: "Load session data", status: "pending" },
  { key: "build_manifest", label: "Build manifest", status: "pending" },
  { key: "generate_json", label: "Generate JSON", status: "pending" },
  { key: "generate_csv", label: "Generate CSV", status: "pending" },
  { key: "validate", label: "Validate schema", status: "pending" },
];

function advanceSteps(steps: StepState[], stepKey: string): StepState[] {
  if (stepKey === "done") return steps.map((s) => ({ ...s, status: "done" as const }));
  const idx = steps.findIndex((s) => s.key === stepKey);
  if (idx < 0) return steps;
  return steps.map((s, i) => ({
    ...s,
    status: i < idx ? "done" : i === idx ? "active" : "pending",
  }));
}

/** A review board belongs to one session; without one there is nothing to show. */
export function ReviewBoardPage({ sessionId }: { sessionId: string | null }) {
  if (!sessionId) {
    return (
      <Shell screen="review" maxWidth="var(--content-max-width-one-column)">
        <PageHeader title="Review board" subtitle="A review board belongs to one session." />
        <Card>
          <div className="empty-state">
            <Text as="p" tone="secondary">
              Open a session in the studio, then come back — the board shows that session's picks
              and its audit trail.
            </Text>
            <Button variant="primary" icon="bolt" onClick={() => navigate("studio")}>
              Go to studio
            </Button>
          </div>
        </Card>
      </Shell>
    );
  }
  return <ReviewBoard sessionId={sessionId} />;
}

function ReviewBoard({ sessionId }: { sessionId: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [manifest, setManifest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffData, setHandoffData] = useState<{ json: any; csv: string; issues: string[]; valid: boolean } | null>(null);
  const [resumeState, setResumeState] = useState<{ fromStage: HandoffStage; snapshot: Record<string, unknown>; issues: string[] } | null>(null);
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [nowTick, setNowTick] = useState(Date.now());
  const handoffAbortRef = useRef<AbortController | null>(null);


  // Audit-trail filter state
  const [fltTransitions, setFltTransitions] = useState<Set<string>>(new Set());
  const [fltAsset, setFltAsset] = useState<string>("");
  const [fltActor, setFltActor] = useState<string>("");
  const [fltFrom, setFltFrom] = useState<string>("");
  const [fltTo, setFltTo] = useState<string>("");
  const [fltQuery, setFltQuery] = useState<string>("");

  useEffect(() => {
    if (!toasts.some((t) => t.kind === "progress")) return;
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [toasts]);

  function pushToast(t: Omit<Toast, "id">): number {
    const id = Date.now() + Math.random();
    setToasts((cur) => [...cur, { id, ...t }]);
    if (!t.sticky && t.kind !== "progress") {
      setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 4500);
    }
    return id;
  }
  function dismissToast(id: number) {
    setToasts((cur) => cur.filter((x) => x.id !== id));
  }
  function updateToast(id: number, patch: Partial<Toast>) {
    setToasts((cur) => cur.map((x) => x.id === id ? { ...x, ...patch } : x));
  }

  async function loadEvents() {
    try {
      const res = await fetchSessionApprovalHistory(sessionId);
      setEvents((res.events || []) as AuditEvent[]);
    } catch { /* non-fatal */ }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [b, m] = await Promise.all([
        authedFetch(sessionReviewBoardUrl(sessionId)),
        authedFetch(sessionSyncManifestUrl(sessionId)).catch(() => null),
      ]);
      setBoard(b.board ?? b);
      setManifest(m?.manifest ?? m);
      void loadEvents();
    } catch (e: any) {
      setError(e?.message || "Failed to load review board.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function runHandoff(resume?: { fromStage: HandoffStage; snapshot: Record<string, unknown> }) {
    const ctrl = new AbortController();
    handoffAbortRef.current = ctrl;
    setHandoffBusy(true);
    const startedAt = Date.now();
    const toastId = pushToast({
      kind: "progress",
      text: resume ? `Resuming handoff from ${resume.fromStage}…` : "Packaging handoff…",
      startedAt,
      steps: HANDOFF_STEPS.map((s) => ({ ...s })),
      progress: 0,
      onCancel: () => ctrl.abort(),
    });
    const onStep = (evt: HandoffStreamStep) => {
      updateToast(toastId, {
        text: evt.message || "Packaging handoff…",
        progress: evt.progress,
        steps: advanceSteps(HANDOFF_STEPS.map((s) => ({ ...s })), evt.step),
      });
    };
    try {
      const result = resume
        ? await resumeSessionHandoffStream(sessionId, resume.fromStage, resume.snapshot, { signal: ctrl.signal, onStep })
        : await createSessionHandoffStream(sessionId, { signal: ctrl.signal, onStep });
      const meta: any = result?.metadata || {};
      const serverIssues: string[] = meta.schema_issues || [];
      const clientIssues = validateManifestClient(meta.handoff_json);
      const allIssues = [...serverIssues, ...clientIssues];
      const valid = allIssues.length === 0;
      if (meta.handoff_json && meta.handoff_csv) {
        setHandoffData({ json: meta.handoff_json, csv: meta.handoff_csv, issues: allIssues, valid });
      }
      dismissToast(toastId);
      if (!valid) {
        // Downloads are gated; give user the option to resume from build_manifest.
        setResumeState({ fromStage: "build_manifest", snapshot: { structured: meta.handoff_json, csv: meta.handoff_csv }, issues: allIssues });
        pushToast({
          kind: "error",
          text: `Handoff blocked · ${allIssues.length} schema issue${allIssues.length > 1 ? "s" : ""}. Downloads disabled.`,
          sticky: true,
          onRetry: () => { void runHandoff({ fromStage: "build_manifest", snapshot: { structured: meta.handoff_json, csv: meta.handoff_csv } }); },
        });
      } else {
        setResumeState(null);
        pushToast({ kind: "success", text: `Handoff ready · ${meta.asset_count ?? 0} assets · ${meta.approved_count ?? 0} approved` });
      }
    } catch (e: any) {
      const canceled = ctrl.signal.aborted;
      dismissToast(toastId);
      if (canceled) {
        pushToast({ kind: "info", text: "Handoff canceled." });
      } else if (e instanceof HandoffError) {
        const issues = e.issues || [];
        const from = e.resumableFrom || "build_manifest";
        const snap = (e.snapshot as any) || {};
        if (e.snapshot?.structured || snap.structured) {
          setHandoffData({
            json: snap.structured || null,
            csv: snap.csv || "",
            issues,
            valid: false,
          });
        }
        setResumeState({ fromStage: from, snapshot: snap, issues });
        const detail = issues.length ? `: ${issues.slice(0, 2).join("; ")}${issues.length > 2 ? "…" : ""}` : `: ${e.message}`;
        pushToast({
          kind: "error",
          text: `Handoff failed at ${e.stage || "?"}${detail}`,
          sticky: true,
          onRetry: () => { void runHandoff({ fromStage: from, snapshot: snap }); },
        });
      } else {
        const msg = e?.message || "Handoff failed.";
        pushToast({
          kind: "error",
          text: `Handoff failed: ${msg}`,
          sticky: true,
          onRetry: () => { void runHandoff(resume); },
        });
      }
    } finally {
      handoffAbortRef.current = null;
      setHandoffBusy(false);
    }
  }


  async function runDownload(filename: string, mime: string, produce: () => string) {
    let canceled = false;
    const startedAt = Date.now();
    const toastId = pushToast({
      kind: "progress",
      text: `Preparing ${filename}…`,
      startedAt,
      onCancel: () => { canceled = true; },
    });
    // Serialize in a microtask so the cancel check has a chance to fire on big payloads.
    await new Promise<void>((r) => queueMicrotask(() => r()));
    if (canceled) {
      dismissToast(toastId);
      pushToast({ kind: "info", text: "Download canceled." });
      return;
    }
    let content: string;
    try {
      content = produce();
    } catch (e: any) {
      dismissToast(toastId);
      pushToast({ kind: "error", text: `Download failed: ${e?.message || "unknown error"}` });
      return;
    }
    await new Promise<void>((r) => queueMicrotask(() => r()));
    if (canceled) {
      dismissToast(toastId);
      pushToast({ kind: "info", text: "Download canceled." });
      return;
    }
    triggerDownload(filename, mime, content);
    dismissToast(toastId);
    pushToast({ kind: "success", text: `Downloaded ${filename}` });
  }

  async function setStatus(asset: Asset, status: ApprovalStatus) {
    const prevStatus = asset.approval_status;
    setPendingAssetId(asset.id);
    setBoard((b) => b ? {
      ...b,
      assets: b.assets.map((a) => a.id === asset.id ? { ...a, approval_status: status } : a),
    } : b);
    try {
      await updateAsset(asset.id, { approval_status: status });
      pushToast({ kind: "success", text: `"${asset.title || "Untitled"}" is now ${assetStatusCopy(status).toLowerCase().replace(/\.$/, "")}.` });
      void loadEvents();
    } catch (e: any) {
      setBoard((b) => b ? {
        ...b,
        assets: b.assets.map((a) => a.id === asset.id ? { ...a, approval_status: prevStatus } : a),
      } : b);
      pushToast({ kind: "error", text: `Update failed: ${e?.message || "unknown error"}. Reverted.` });
      void load();
    } finally {
      setPendingAssetId(null);
    }
  }

  const eventsByAsset = useMemo(() => {
    const map: Record<string, AuditEvent[]> = {};
    for (const e of events) {
      (map[e.asset_id] = map[e.asset_id] || []).push(e);
    }
    return map;
  }, [events]);

  const assetTitles = useMemo(() => {
    const m: Record<string, string> = {};
    (board?.assets || []).forEach((a) => { m[a.id] = a.title || a.id.slice(0, 8); });
    return m;
  }, [board]);

  const actors = useMemo(() => {
    const s = new Set<string>();
    events.forEach((e) => { if (e.user_id) s.add(e.user_id); });
    return Array.from(s);
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = fltQuery.trim().toLowerCase();
    const from = fltFrom ? new Date(fltFrom).getTime() : null;
    const to = fltTo ? new Date(fltTo).getTime() + 86_400_000 : null;
    let out = events.filter((e) => {
      if (fltTransitions.size && !fltTransitions.has(e.new_status)) return false;
      if (fltAsset && e.asset_id !== fltAsset) return false;
      if (fltActor && e.user_id !== fltActor) return false;
      const ts = new Date(e.created_at).getTime();
      if (from !== null && ts < from) return false;
      if (to !== null && ts > to) return false;
      if (q) {
        const title = (assetTitles[e.asset_id] || "").toLowerCase();
        const note = (e.note || "").toLowerCase();
        if (!title.includes(q) && !note.includes(q)) return false;
      }
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      let av: string | number = "", bv: string | number = "";
      if (sortBy === "time") { av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime(); }
      else if (sortBy === "asset") { av = assetTitles[a.asset_id] || ""; bv = assetTitles[b.asset_id] || ""; }
      else if (sortBy === "actor") { av = a.user_id || ""; bv = b.user_id || ""; }
      else if (sortBy === "transition") { av = a.new_status; bv = b.new_status; }
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });
    return out;
  }, [events, fltTransitions, fltAsset, fltActor, fltFrom, fltTo, fltQuery, sortBy, sortDir, assetTitles]);

  function toggleTransition(t: string) {
    setFltTransitions((cur) => {
      const n = new Set(cur);
      if (n.has(t)) n.delete(t); else n.add(t);
      return n;
    });
  }
  function clearFilters() {
    setFltTransitions(new Set()); setFltAsset(""); setFltActor("");
    setFltFrom(""); setFltTo(""); setFltQuery("");
  }

  const all = board?.assets ?? [];
  const approved = all.filter((a) => a.approval_status === "approved");
  const rejected = all.filter((a) => a.approval_status === "rejected");
  const inReview = all.filter((a) => a.approval_status !== "approved" && a.approval_status !== "rejected");

  const sections: BoardSection[] = [
    {
      key: "approved",
      title: "Approved",
      subtitle: "Signed off. Revert one to send it back to review.",
      assets: approved,
      emptyText: "No approved assets yet.",
      onApprove: null,
      onReject: (a) => void setStatus(a, "review"),
      rejectLabel: "Revert",
    },
    {
      key: "review",
      title: "In review",
      subtitle: "Waiting on a decision.",
      assets: inReview,
      emptyText: "No assets in review.",
      onApprove: (a) => void setStatus(a, "approved"),
      onReject: (a) => void setStatus(a, "rejected"),
    },
    {
      key: "rejected",
      title: "Rejected",
      subtitle: "Kept for the audit trail, excluded from the handoff.",
      assets: rejected,
      emptyText: "No rejected assets.",
      onApprove: (a) => void setStatus(a, "approved"),
      onReject: null,
    },
  ];

  const downloadsBlocked = !handoffData?.valid;

  return (
    <Shell screen="review" sessionId={sessionId}>
      <PageHeader
        title="Review board"
        subtitle={`Session ${sessionId.slice(0, 8)} · generated ${
          board?.generated_at ? new Date(board.generated_at).toLocaleString() : "—"
        }`}
        backAction={() => navigate("studio")}
        actions={
          <>
            <Button icon="arrow-path" loading={loading} onClick={() => void load()}>
              Refresh board
            </Button>
            <Button
              variant="primary"
              icon="arrow-down-tray"
              loading={handoffBusy}
              onClick={() => void runHandoff()}
            >
              Generate handoff
            </Button>
          </>
        }
      />

      {error ? (
        <Banner
          tone="critical"
          title="The board didn't load"
          action={<Button onClick={() => void load()}>Try again</Button>}
        >
          <span>{error}</span>
        </Banner>
      ) : null}

      {handoffData ? (
        <Card
          title="Handoff package"
          subtitle="Schema frank-create.handoff, version 1. Downloads unlock once the manifest validates."
        >
          <div className="handoff-actions">
            <Button
              icon="arrow-down-tray"
              disabled={downloadsBlocked}
              onClick={() =>
                void runDownload(`handoff-${sessionId}.json`, "application/json", () =>
                  JSON.stringify(handoffData.json, null, 2)
                )
              }
            >
              Download JSON
            </Button>
            <Button
              icon="arrow-down-tray"
              disabled={downloadsBlocked}
              onClick={() => void runDownload(`handoff-${sessionId}.csv`, "text/csv", () => handoffData.csv)}
            >
              Download CSV
            </Button>
            <Button
              icon="document-duplicate"
              onClick={() =>
                handoffData.json && void navigator.clipboard.writeText(JSON.stringify(handoffData.json, null, 2))
              }
            >
              Copy JSON
            </Button>
            {resumeState ? (
              <Button
                icon="arrow-path"
                disabled={handoffBusy}
                onClick={() =>
                  void runHandoff({ fromStage: resumeState.fromStage, snapshot: resumeState.snapshot })
                }
              >
                Retry from {resumeState.fromStage}
              </Button>
            ) : null}
          </div>

          {handoffData.issues.length ? (
            <div className="schema-issues">
              <div className="schema-issues__head">
                <Icon source="exclamation-circle" size={16} tone="critical" />
                <Text fontWeight="medium">
                  Downloads blocked — {handoffData.issues.length} manifest schema issue
                  {handoffData.issues.length > 1 ? "s" : ""}
                </Text>
              </div>
              <ul>
                {handoffData.issues.slice(0, 25).map((issue, k) => (
                  <li key={k}>
                    <code>{issue}</code>
                  </li>
                ))}
                {handoffData.issues.length > 25 ? (
                  <li>and {handoffData.issues.length - 25} more</li>
                ) : null}
              </ul>
              <Text variant="bodySm" tone="secondary" as="p">
                Every asset needs id, title, media_type, approval_status and blueprint. Fix the source
                rows, then retry from build_manifest.
              </Text>
            </div>
          ) : (
            <div className="schema-issues__head">
              <Icon source="check-circle" size={16} tone="success" />
              <Text tone="success">
                Schema v1 validated · {all.length} assets · {approved.length} approved
              </Text>
            </div>
          )}
        </Card>
      ) : null}

      {sections.map((section) => (
        <Card
          key={section.key}
          title={`${section.title} (${section.assets.length})`}
          subtitle={section.subtitle}
        >
          <AssetGrid
            assets={section.assets}
            events={eventsByAsset}
            emptyText={section.emptyText}
            pendingId={pendingAssetId}
            onApprove={section.onApprove}
            onReject={section.onReject}
            rejectLabel={section.rejectLabel}
          />
        </Card>
      ))}

      <Card
        title="Audit trail"
        subtitle={`${filteredEvents.length} of ${events.length} events`}
        padding="none"
      >
        <div className="audit-filters">
          {(["approved", "rejected", "review"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`filter-chip ${fltTransitions.has(t) ? "is-selected" : ""}`}
              aria-pressed={fltTransitions.has(t)}
              onClick={() => toggleTransition(t)}
            >
              {t}
            </button>
          ))}
          <Select
            label="Asset"
            labelHidden
            maxWidth={180}
            value={fltAsset}
            onChange={(e) => setFltAsset(e.target.value)}
            options={[{ value: "", label: "All assets" }].concat(
              Object.entries(assetTitles).map(([id, t]) => ({ value: id, label: t }))
            )}
          />
          <Select
            label="Actor"
            labelHidden
            maxWidth={180}
            value={fltActor}
            onChange={(e) => setFltActor(e.target.value)}
            options={[{ value: "", label: "All actors" }].concat(
              actors.map((a) => ({ value: a, label: `${a.slice(0, 8)}…` }))
            )}
          />
          <TextField
            label="From"
            labelHidden
            type="date"
            maxWidth={150}
            value={fltFrom}
            onChange={(e) => setFltFrom(e.target.value)}
          />
          <TextField
            label="To"
            labelHidden
            type="date"
            maxWidth={150}
            value={fltTo}
            onChange={(e) => setFltTo(e.target.value)}
          />
          <TextField
            label="Search title or note"
            labelHidden
            icon="magnifying-glass"
            placeholder="Search title or note"
            maxWidth={190}
            value={fltQuery}
            onChange={(e) => setFltQuery(e.target.value)}
          />
          <Button variant="plain" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
        <DataTable
          columns={AUDIT_COLUMNS}
          rows={filteredEvents.map((e) => ({
            id: e.id,
            when: new Date(e.created_at).toLocaleString(),
            asset: assetTitles[e.asset_id] || e.asset_id.slice(0, 8),
            actor: e.user_id ? `${e.user_id.slice(0, 8)}…` : "—",
            transition: (
              <span>
                <Text tone="secondary">{e.prev_status ?? "null"} → </Text>
                <Text fontWeight="semibold">{e.new_status}</Text>
              </span>
            ),
            note: e.note || "—",
          }))}
          emptyState={
            <Text as="p" tone="secondary">
              {events.length
                ? "No audit event matches these filters."
                : "No approval decisions recorded for this session yet."}
            </Text>
          }
        />
      </Card>

      {manifest ? (
        <Card title="Sync manifest" subtitle="What the backend returns for this session.">
          <pre className="code-block">{JSON.stringify(manifest, null, 2)}</pre>
        </Card>
      ) : null}

      <div className="toast-stack">
        {toasts.map((t) => {
          const elapsed = t.startedAt ? Math.max(0, Math.floor((nowTick - t.startedAt) / 1000)) : 0;
          const pct = Math.round((t.progress ?? 0) * 100);
          return (
            <div key={t.id} className={`toast toast--${t.kind}`} role="status">
              <div className="toast__head">
                {t.kind === "progress" ? <Spinner size="small" /> : null}
                <span className="toast__text">{t.text}</span>
                <button type="button" className="toast__dismiss" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
                  <Icon source="x-mark" size={16} tone="inherit" />
                </button>
              </div>
              {t.kind === "progress" && typeof t.progress === "number" ? (
                <div className="toast__track">
                  <div className="toast__bar" style={{ width: `${pct}%` }} />
                </div>
              ) : null}
              {t.steps ? (
                <ul className="toast__steps">
                  {t.steps.map((step) => (
                    <li key={step.key} className={`toast__step is-${step.status}`}>
                      <span className="toast__dot" aria-hidden="true" />
                      <span>{step.label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {t.kind === "progress" ? (
                <div className="toast__foot">
                  <span className="as-tabular">{elapsed}s elapsed</span>
                  {t.onCancel ? (
                    <Button size="micro" onClick={() => t.onCancel?.()}>
                      Cancel
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {t.onRetry ? (
                <div className="toast__foot toast__foot--end">
                  <Button size="micro" icon="arrow-path" onClick={() => { dismissToast(t.id); t.onRetry?.(); }}>
                    Retry
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

interface BoardSection {
  key: string;
  title: string;
  subtitle: string;
  assets: Asset[];
  emptyText: string;
  onApprove: ((a: Asset) => void) | null;
  onReject: ((a: Asset) => void) | null;
  rejectLabel?: string;
}

const AUDIT_COLUMNS: DataTableColumn[] = [
  { key: "when", title: "Time" },
  { key: "asset", title: "Asset" },
  { key: "actor", title: "Actor" },
  { key: "transition", title: "Transition" },
  { key: "note", title: "Note" },
];

const STATUS_TONE: Record<ApprovalStatus, "success" | "critical" | "neutral"> = {
  approved: "success",
  rejected: "critical",
  review: "neutral",
};

function AssetGrid({
  assets, emptyText, pendingId, onApprove, onReject, rejectLabel, events,
}: {
  assets: Asset[];
  emptyText: string;
  pendingId: string | null;
  onApprove: ((a: Asset) => void) | null;
  onReject: ((a: Asset) => void) | null;
  rejectLabel?: string;
  events: Record<string, AuditEvent[]>;
}) {
  if (!assets.length) {
    return (
      <Text as="p" tone="secondary">
        {emptyText}
      </Text>
    );
  }
  return (
    <div className="board-grid">
      {assets.map((a) => {
        const busy = pendingId === a.id;
        const audit = events[a.id] || [];
        const status = a.approval_status;
        return (
          <article key={a.id} className={`board-card ${busy ? "is-busy" : ""}`}>
            <a
              className="board-card__media"
              href={assetDownloadUrl(a.id)}
              target="_blank"
              rel="noreferrer"
            >
              {a.preview_url ? (
                <img src={a.preview_url} alt={a.title || "Untitled pick"} />
              ) : (
                <span className="board-card__placeholder" aria-hidden="true" />
              )}
            </a>
            <div className="board-card__body">
              <Text fontWeight="medium" truncate>
                {a.title || "Untitled"}
              </Text>
              <div className="board-card__meta">
                <Badge tone={STATUS_TONE[status] ?? "neutral"}>{assetStatusCopy(status)}</Badge>
                {a.favorite ? <Icon source="star" size={16} tone="caution" label="Favourite" /> : null}
              </div>
              {onApprove || onReject ? (
                <div className="board-card__actions">
                  {onApprove ? (
                    <Button size="micro" icon="check" disabled={busy} onClick={() => onApprove(a)}>
                      Approve
                    </Button>
                  ) : null}
                  {onReject ? (
                    <Button size="micro" tone="critical" icon="x-mark" disabled={busy} onClick={() => onReject(a)}>
                      {rejectLabel ?? "Reject"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {audit.length ? (
                <details className="board-card__audit">
                  <summary>Audit trail ({audit.length})</summary>
                  <ul>
                    {audit.slice(0, 6).map((e) => (
                      <li key={e.id}>
                        <span>
                          {e.prev_status ?? "null"} → <strong>{e.new_status}</strong>
                        </span>
                        <span className="as-tabular">{new Date(e.created_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
