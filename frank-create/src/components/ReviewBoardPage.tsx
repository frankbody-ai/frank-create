import { useEffect, useState } from "react";
import { ArrowLeft, Check, Download, Loader2, RefreshCw, X } from "lucide-react";
import {
  assetDownloadUrl,
  createSessionHandoff,
  sessionReviewBoardUrl,
  sessionSyncManifestUrl,
  updateAsset,
} from "../lib/api";
import type { Asset } from "../lib/types";
import { supabase } from "../lib/supabaseClient";

type Board = {
  session_id: string;
  generated_at: string;
  assets: Asset[];
  approved: Asset[];
};

type Toast = { id: number; kind: "info" | "error" | "success"; text: string };

async function authedFetch(url: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

function downloadBlob(filename: string, mime: string, content: string) {
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

// Client-side schema check — matches the server's manifest v1 shape.
function validateManifest(m: any): string[] {
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
    if (a.blueprint && typeof a.blueprint !== "object") issues.push(`assets[${i}].blueprint wrong type`);
  });
  return issues;
}

export function ReviewBoardPage({ sessionId }: { sessionId: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [manifest, setManifest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffMsg, setHandoffMsg] = useState<string | null>(null);
  const [handoffData, setHandoffData] = useState<{ json: any; csv: string; issues: string[] } | null>(null);
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function pushToast(kind: Toast["kind"], text: string) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
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

  async function handleHandoff() {
    setHandoffBusy(true);
    setHandoffMsg("Packaging handoff…");
    try {
      const res = await createSessionHandoff(sessionId);
      const meta: any = res.metadata || {};
      const serverIssues: string[] = meta.schema_issues || [];
      const clientIssues = validateManifest(meta.handoff_json);
      const allIssues = [...serverIssues, ...clientIssues];
      setHandoffMsg(
        `Handoff ready · ${meta.asset_count ?? 0} assets · ${meta.approved_count ?? 0} approved · ${meta.blueprint_count ?? 0} blueprints`
      );
      if (meta.handoff_json && meta.handoff_csv) {
        setHandoffData({ json: meta.handoff_json, csv: meta.handoff_csv, issues: allIssues });
      }
      if (allIssues.length) {
        pushToast("error", `Manifest schema issues: ${allIssues.slice(0, 2).join("; ")}${allIssues.length > 2 ? "…" : ""}`);
      } else {
        pushToast("success", "Handoff manifest validated.");
      }
    } catch (e: any) {
      setHandoffMsg(null);
      pushToast("error", e?.message || "Handoff failed.");
    } finally {
      setHandoffBusy(false);
    }
  }

  async function setStatus(asset: Asset, status: "approved" | "rejected" | "pending") {
    const prevStatus = asset.approval_status;
    setPendingAssetId(asset.id);
    // Optimistic: patch local board immediately.
    setBoard((b) => b ? {
      ...b,
      assets: b.assets.map((a) => a.id === asset.id ? { ...a, approval_status: status } as Asset : a),
    } : b);
    try {
      await updateAsset(asset.id, { approval_status: status } as any);
      pushToast("success", `Marked "${asset.title || "asset"}" as ${status}.`);
    } catch (e: any) {
      // Rollback local state and refresh from server for truth.
      setBoard((b) => b ? {
        ...b,
        assets: b.assets.map((a) => a.id === asset.id ? { ...a, approval_status: prevStatus } as Asset : a),
      } : b);
      pushToast("error", `Update failed: ${e?.message || "unknown error"}. Reverted.`);
      void load();
    } finally {
      setPendingAssetId(null);
    }
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
          <button type="button" onClick={() => void handleHandoff()} disabled={handoffBusy} style={btnPrimary}>
            {handoffBusy ? <Loader2 size={14} className="frank-spin" /> : <Download size={14} />}
            {handoffBusy ? "Packaging…" : "Generate handoff"}
          </button>
        </div>
      </header>

      {handoffBusy ? (
        <div style={{ height: 3, background: "rgba(0,0,0,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
          <div className="frank-progress-bar" />
        </div>
      ) : null}

      {error ? <p style={{ color: "#c0392b" }}>Error: {error}</p> : null}
      {handoffMsg ? <p style={{ opacity: 0.8 }}>{handoffMsg}</p> : null}
      {handoffData ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={btn} onClick={() => downloadBlob(`handoff-${sessionId}.json`, "application/json", JSON.stringify(handoffData.json, null, 2))}>
              <Download size={14} /> Download JSON
            </button>
            <button type="button" style={btn} onClick={() => downloadBlob(`handoff-${sessionId}.csv`, "text/csv", handoffData.csv)}>
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
          assets={approved}
          emptyText="No approved assets yet."
          pendingId={pendingAssetId}
          onApprove={null}
          onReject={(a) => void setStatus(a, "pending")}
          rejectLabel="Revert"
        />
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={sectionH}>Pending ({pending.length})</h2>
        <AssetGrid
          assets={pending}
          emptyText="No pending assets."
          pendingId={pendingAssetId}
          onApprove={(a) => void setStatus(a, "approved")}
          onReject={(a) => void setStatus(a, "rejected")}
        />
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={sectionH}>Rejected ({rejected.length})</h2>
        <AssetGrid
          assets={rejected}
          emptyText="No rejected assets."
          pendingId={pendingAssetId}
          onApprove={(a) => void setStatus(a, "approved")}
          onReject={null}
        />
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
      <div style={{ position: "fixed", bottom: 20, right: 20, display: "flex", flexDirection: "column", gap: 8, zIndex: 60 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: "10px 14px", borderRadius: 8, fontSize: 13, minWidth: 240, maxWidth: 380,
            background: t.kind === "error" ? "#fdecec" : t.kind === "success" ? "#e6f7ec" : "#eef2ff",
            color: t.kind === "error" ? "#8a1e1e" : t.kind === "success" ? "#1e6b34" : "#1e3a8a",
            border: `1px solid ${t.kind === "error" ? "#e29a9a" : t.kind === "success" ? "#8fce9d" : "#a5b4fc"}`,
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}>{t.text}</div>
        ))}
      </div>

      <style>{`
        @keyframes frank-spin { to { transform: rotate(360deg); } }
        .frank-spin { animation: frank-spin 0.9s linear infinite; }
        @keyframes frank-progress { 0% { transform: translateX(-40%); } 100% { transform: translateX(140%); } }
        .frank-progress-bar { width: 40%; height: 100%; background: #111; animation: frank-progress 1.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function AssetGrid({
  assets, emptyText, pendingId, onApprove, onReject, rejectLabel,
}: {
  assets: Asset[];
  emptyText: string;
  pendingId: string | null;
  onApprove: ((a: Asset) => void) | null;
  onReject: ((a: Asset) => void) | null;
  rejectLabel?: string;
}) {
  if (!assets.length) {
    return <p style={{ opacity: 0.6, fontSize: 13 }}>{emptyText}</p>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {assets.map((a) => {
        const busy = pendingId === a.id;
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
              <div style={{ display: "flex", gap: 6, padding: "0 10px 10px" }}>
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
const btnPrimary: React.CSSProperties = {
  ...btn, background: "#111", color: "#fff", borderColor: "#111",
};
const btnSmall: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
  flex: 1, padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.15)",
  background: "#fff", cursor: "pointer", fontSize: 12,
};
const sectionH: React.CSSProperties = { fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.7, margin: "0 0 12px" };
