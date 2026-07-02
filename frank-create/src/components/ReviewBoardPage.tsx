import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, Download, Loader2, RefreshCw, RotateCw, X } from "lucide-react";
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
import type { Asset } from "../lib/types";
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

export function ReviewBoardPage({ sessionId }: { sessionId: string }) {
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
  const [sortBy, setSortBy] = useState<"time" | "asset" | "actor" | "transition">("time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  async function runHandoff() {
    const ctrl = new AbortController();
    handoffAbortRef.current = ctrl;
    setHandoffBusy(true);
    const startedAt = Date.now();
    const toastId = pushToast({
      kind: "progress",
      text: "Packaging handoff…",
      startedAt,
      steps: HANDOFF_STEPS.map((s) => ({ ...s })),
      progress: 0,
      onCancel: () => ctrl.abort(),
    });
    try {
      const result = await createSessionHandoffStream(sessionId, {
        signal: ctrl.signal,
        onStep: (evt: HandoffStreamStep) => {
          updateToast(toastId, {
            text: evt.message || "Packaging handoff…",
            progress: evt.progress,
            steps: advanceSteps(HANDOFF_STEPS.map((s) => ({ ...s })), evt.step),
          });
        },
      });
      const meta: any = result?.metadata || {};
      const serverIssues: string[] = meta.schema_issues || [];
      const clientIssues = validateManifestClient(meta.handoff_json);
      const allIssues = [...serverIssues, ...clientIssues];
      if (meta.handoff_json && meta.handoff_csv) {
        setHandoffData({ json: meta.handoff_json, csv: meta.handoff_csv, issues: allIssues });
      }
      dismissToast(toastId);
      if (allIssues.length) {
        pushToast({ kind: "error", text: `Manifest schema issues: ${allIssues.slice(0, 2).join("; ")}${allIssues.length > 2 ? "…" : ""}` });
      } else {
        pushToast({ kind: "success", text: `Handoff ready · ${meta.asset_count ?? 0} assets · ${meta.approved_count ?? 0} approved` });
      }
    } catch (e: any) {
      const canceled = ctrl.signal.aborted;
      dismissToast(toastId);
      if (canceled) {
        pushToast({ kind: "info", text: "Handoff canceled." });
      } else {
        const msg = e?.message || "Handoff failed.";
        pushToast({
          kind: "error",
          text: `Handoff failed: ${msg}`,
          sticky: true,
          onRetry: () => { void runHandoff(); },
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

  async function setStatus(asset: Asset, status: "approved" | "rejected" | "pending") {
    const prevStatus = asset.approval_status;
    setPendingAssetId(asset.id);
    setBoard((b) => b ? {
      ...b,
      assets: b.assets.map((a) => a.id === asset.id ? { ...a, approval_status: status } as Asset : a),
    } : b);
    try {
      await updateAsset(asset.id, { approval_status: status } as any);
      pushToast({ kind: "success", text: `Marked "${asset.title || "asset"}" as ${status}.` });
      void loadEvents();
    } catch (e: any) {
      setBoard((b) => b ? {
        ...b,
        assets: b.assets.map((a) => a.id === asset.id ? { ...a, approval_status: prevStatus } as Asset : a),
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
  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir(col === "time" ? "desc" : "asc"); }
  }

  const all = board?.assets ?? [];
  const approved = all.filter((a) => a.approval_status === "approved");
  const rejected = all.filter((a) => a.approval_status === "rejected");
  const pending = all.filter((a) => a.approval_status !== "approved" && a.approval_status !== "rejected");

  return (
    <div className="frank-review-page" style={{ maxWidth: 1100, margin: "0 auto", padding: 24, position: "relative" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none", marginBottom: 8 }}>
            <ArrowLeft size={16} /> Back to studio
          </a>
          <h1 style={{ margin: 0 }}>Review board</h1>
          <p style={{ margin: "4px 0 0", opacity: 0.7, fontSize: 13 }}>
            Session {sessionId} · generated {board?.generated_at ? new Date(board.generated_at).toLocaleString() : "—"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => void load()} disabled={loading} style={btn}>
            {loading ? <Loader2 size={14} className="frank-spin" /> : <RefreshCw size={14} />}
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button type="button" onClick={() => void runHandoff()} disabled={handoffBusy} style={btnPrimary}>
            {handoffBusy ? <Loader2 size={14} className="frank-spin" /> : <Download size={14} />}
            {handoffBusy ? "Packaging…" : "Generate handoff"}
          </button>
        </div>
      </header>

      {error ? <p style={{ color: "#c0392b" }}>Error: {error}</p> : null}

      {handoffData ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btn} onClick={() => void runDownload(`handoff-${sessionId}.json`, "application/json", () => JSON.stringify(handoffData.json, null, 2))}>
              <Download size={14} /> Download JSON
            </button>
            <button type="button" style={btn} onClick={() => void runDownload(`handoff-${sessionId}.csv`, "text/csv", () => handoffData.csv)}>
              <Download size={14} /> Download CSV
            </button>
            <button type="button" style={btn} onClick={() => void navigator.clipboard.writeText(JSON.stringify(handoffData.json, null, 2))}>
              Copy JSON
            </button>
          </div>
          {handoffData.issues.length ? (
            <details style={{ marginTop: 8, fontSize: 12, color: "#8a1e1e" }}>
              <summary>Schema issues ({handoffData.issues.length})</summary>
              <ul style={{ margin: "6px 0 0 18px" }}>
                {handoffData.issues.slice(0, 20).map((i, k) => <li key={k}>{i}</li>)}
              </ul>
            </details>
          ) : (
            <div style={{ marginTop: 6, fontSize: 12, color: "#1e6b34" }}>Schema v1 · validated</div>
          )}
        </div>
      ) : null}

      <section style={{ marginTop: 12 }}>
        <h2 style={sectionH}>Approved ({approved.length})</h2>
        <AssetGrid
          assets={approved} events={eventsByAsset} emptyText="No approved assets yet."
          pendingId={pendingAssetId} onApprove={null} onReject={(a) => void setStatus(a, "pending")} rejectLabel="Revert"
        />
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={sectionH}>Pending ({pending.length})</h2>
        <AssetGrid
          assets={pending} events={eventsByAsset} emptyText="No pending assets."
          pendingId={pendingAssetId} onApprove={(a) => void setStatus(a, "approved")} onReject={(a) => void setStatus(a, "rejected")}
        />
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={sectionH}>Rejected ({rejected.length})</h2>
        <AssetGrid
          assets={rejected} events={eventsByAsset} emptyText="No rejected assets."
          pendingId={pendingAssetId} onApprove={(a) => void setStatus(a, "approved")} onReject={null}
        />
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={sectionH}>Audit trail ({filteredEvents.length}/{events.length})</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
          {["approved", "rejected", "pending"].map((t) => {
            const on = fltTransitions.has(t);
            return (
              <button key={t} type="button" onClick={() => toggleTransition(t)} style={{
                ...chipBtn, background: on ? "#111" : "#fff", color: on ? "#fff" : "inherit", borderColor: on ? "#111" : "rgba(0,0,0,0.15)",
              }}>{t}</button>
            );
          })}
          <select value={fltAsset} onChange={(e) => setFltAsset(e.target.value)} style={selectStyle}>
            <option value="">All assets</option>
            {Object.entries(assetTitles).map(([id, t]) => <option key={id} value={id}>{t}</option>)}
          </select>
          <select value={fltActor} onChange={(e) => setFltActor(e.target.value)} style={selectStyle}>
            <option value="">All actors</option>
            {actors.map((a) => <option key={a} value={a}>{a.slice(0, 8)}…</option>)}
          </select>
          <input type="date" value={fltFrom} onChange={(e) => setFltFrom(e.target.value)} style={selectStyle} />
          <input type="date" value={fltTo} onChange={(e) => setFltTo(e.target.value)} style={selectStyle} />
          <input type="text" placeholder="Search title/note" value={fltQuery} onChange={(e) => setFltQuery(e.target.value)} style={{ ...selectStyle, minWidth: 160 }} />
          <button type="button" onClick={clearFilters} style={{ ...chipBtn, borderStyle: "dashed" }}>Clear</button>
        </div>
        {filteredEvents.length ? (
          <div style={{ overflowX: "auto", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ background: "rgba(0,0,0,0.03)" }}>
                <tr>
                  {(["time", "asset", "actor", "transition"] as const).map((col) => (
                    <th key={col} onClick={() => toggleSort(col)} style={thStyle}>
                      {col} {sortBy === col ? (sortDir === "asc" ? "▲" : "▼") : ""}
                    </th>
                  ))}
                  <th style={thStyle}>note</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <td style={tdStyle}>{new Date(e.created_at).toLocaleString()}</td>
                    <td style={tdStyle}>{assetTitles[e.asset_id] || e.asset_id.slice(0, 8)}</td>
                    <td style={tdStyle}>{e.user_id ? `${e.user_id.slice(0, 8)}…` : "—"}</td>
                    <td style={tdStyle}>{e.prev_status ?? "—"} → <strong>{e.new_status}</strong></td>
                    <td style={tdStyle}>{e.note || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ opacity: 0.6, fontSize: 13 }}>No audit events match the current filters.</p>
        )}
      </section>

      {manifest ? (
        <section style={{ marginTop: 32 }}>
          <h2 style={sectionH}>Sync manifest</h2>
          <pre style={{ background: "rgba(0,0,0,0.04)", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 12 }}>
            {JSON.stringify(manifest, null, 2)}
          </pre>
        </section>
      ) : null}

      {/* Toasts */}
      <div style={{ position: "fixed", bottom: 20, right: 20, display: "flex", flexDirection: "column", gap: 8, zIndex: 60, minWidth: 260 }}>
        {toasts.map((t) => {
          const bg = t.kind === "error" ? "#fdecec" : t.kind === "success" ? "#e6f7ec" : t.kind === "progress" ? "#f4f4f5" : "#eef2ff";
          const fg = t.kind === "error" ? "#8a1e1e" : t.kind === "success" ? "#1e6b34" : t.kind === "progress" ? "#333" : "#1e3a8a";
          const bd = t.kind === "error" ? "#e29a9a" : t.kind === "success" ? "#8fce9d" : t.kind === "progress" ? "#d4d4d8" : "#a5b4fc";
          const elapsed = t.startedAt ? Math.max(0, Math.floor((nowTick - t.startedAt) / 1000)) : 0;
          const pct = Math.round((t.progress ?? 0) * 100);
          return (
            <div key={t.id} style={{
              padding: "10px 12px", borderRadius: 8, fontSize: 13, maxWidth: 380,
              background: bg, color: fg, border: `1px solid ${bd}`,
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {t.kind === "progress" ? <Loader2 size={13} className="frank-spin" /> : null}
                  <span>{t.text}</span>
                </div>
                <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" style={dismissBtn}>×</button>
              </div>
              {t.kind === "progress" && typeof t.progress === "number" ? (
                <div style={{ height: 4, background: "rgba(0,0,0,0.08)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "#111", transition: "width 0.25s" }} />
                </div>
              ) : null}
              {t.steps ? (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, fontSize: 11 }}>
                  {t.steps.map((s) => (
                    <li key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 0", opacity: s.status === "pending" ? 0.5 : 1 }}>
                      {s.status === "done" ? <Check size={11} color="#1e6b34" /> :
                       s.status === "active" ? <Loader2 size={11} className="frank-spin" /> :
                       <span style={{ width: 11, height: 11, display: "inline-block", borderRadius: "50%", border: "1px solid currentColor", opacity: 0.4 }} />}
                      <span>{s.label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {t.kind === "progress" ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11, opacity: 0.75 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {elapsed}s elapsed</span>
                  {t.onCancel ? (
                    <button type="button" onClick={() => t.onCancel?.()} style={miniBtn}>Cancel</button>
                  ) : null}
                </div>
              ) : null}
              {t.onRetry ? (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => { dismissToast(t.id); t.onRetry?.(); }} style={miniBtn}>
                    <RotateCw size={11} /> Retry
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes frank-spin { to { transform: rotate(360deg); } }
        .frank-spin { animation: frank-spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}

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
  if (!assets.length) return <p style={{ opacity: 0.6, fontSize: 13 }}>{emptyText}</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {assets.map((a) => {
        const busy = pendingId === a.id;
        const audit = events[a.id] || [];
        return (
          <div key={a.id} style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, overflow: "hidden", background: "#fff", opacity: busy ? 0.6 : 1, transition: "opacity 0.15s" }}>
            <a href={assetDownloadUrl(a.id)} target="_blank" rel="noreferrer" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
              {a.preview_url ? (
                <img src={a.preview_url} alt={a.title} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", aspectRatio: "1 / 1", background: "rgba(0,0,0,0.05)" }} />
              )}
              <div style={{ padding: "10px 10px 6px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.title || "Untitled"}
                </div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{a.approval_status ?? "pending"}</div>
              </div>
            </a>
            {(onApprove || onReject) ? (
              <div style={{ display: "flex", gap: 6, padding: "0 10px 6px" }}>
                {onApprove ? (
                  <button type="button" disabled={busy} onClick={() => onApprove(a)} style={{ ...btnSmall, background: "#e6f7ec", borderColor: "#8fce9d", color: "#1e6b34" }}>
                    {busy ? <Loader2 size={12} className="frank-spin" /> : <Check size={12} />} Approve
                  </button>
                ) : null}
                {onReject ? (
                  <button type="button" disabled={busy} onClick={() => onReject(a)} style={{ ...btnSmall, background: "#fdecec", borderColor: "#e29a9a", color: "#8a1e1e" }}>
                    {busy ? <Loader2 size={12} className="frank-spin" /> : <X size={12} />} {rejectLabel ?? "Reject"}
                  </button>
                ) : null}
              </div>
            ) : null}
            {audit.length ? (
              <details style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "6px 10px 8px" }}>
                <summary style={{ fontSize: 11, opacity: 0.7, cursor: "pointer" }}>
                  Audit trail ({audit.length})
                </summary>
                <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", fontSize: 11, opacity: 0.8 }}>
                  {audit.slice(0, 6).map((e) => (
                    <li key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 6, padding: "2px 0" }}>
                      <span>{e.prev_status ?? "—"} → <strong>{e.new_status}</strong></span>
                      <span style={{ opacity: 0.6 }}>{new Date(e.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)",
  background: "#fff", cursor: "pointer", fontSize: 13,
};
const btnPrimary: React.CSSProperties = { ...btn, background: "#111", color: "#fff", borderColor: "#111" };
const btnSmall: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
  flex: 1, padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.15)",
  background: "#fff", cursor: "pointer", fontSize: 12,
};
const miniBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(0,0,0,0.2)",
  background: "#fff", cursor: "pointer", fontSize: 11, color: "inherit",
};
const dismissBtn: React.CSSProperties = {
  background: "transparent", border: "none", cursor: "pointer",
  color: "inherit", fontSize: 16, lineHeight: 1, opacity: 0.6,
};
const sectionH: React.CSSProperties = { fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7, margin: "0 0 12px" };
const chipBtn: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.15)",
  background: "#fff", cursor: "pointer", fontSize: 12, textTransform: "capitalize",
};
const selectStyle: React.CSSProperties = {
  padding: "5px 8px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.15)",
  background: "#fff", fontSize: 12,
};
const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "6px 10px", cursor: "pointer",
  fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.7,
  userSelect: "none",
};
const tdStyle: React.CSSProperties = { padding: "6px 10px", verticalAlign: "top" };
