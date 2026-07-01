import { useEffect, useState } from "react";
import { ArrowLeft, Check, Download, RefreshCw, X } from "lucide-react";
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

export function ReviewBoardPage({ sessionId }: { sessionId: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [manifest, setManifest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffMsg, setHandoffMsg] = useState<string | null>(null);
  const [handoffData, setHandoffData] = useState<{ json: any; csv: string } | null>(null);
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);

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
    setHandoffMsg(null);
    try {
      const res = await createSessionHandoff(sessionId);
      const meta: any = res.metadata || {};
      const count = meta.asset_count ?? "";
      setHandoffMsg(`Handoff ready${count !== "" ? ` (${count} assets, ${meta.approved_count ?? 0} approved)` : ""}.`);
      if (meta.handoff_json && meta.handoff_csv) {
        setHandoffData({ json: meta.handoff_json, csv: meta.handoff_csv });
      }
    } catch (e: any) {
      setHandoffMsg(e?.message || "Handoff failed.");
    } finally {
      setHandoffBusy(false);
    }
  }

  async function setStatus(asset: Asset, status: "approved" | "rejected" | "pending") {
    setPendingAssetId(asset.id);
    try {
      await updateAsset(asset.id, { approval_status: status } as any);
      await load();
    } catch (e: any) {
      setError(e?.message || "Update failed.");
    } finally {
      setPendingAssetId(null);
    }
  }

  const all = board?.assets ?? [];
  const approved = all.filter((a) => a.approval_status === "approved");
  const rejected = all.filter((a) => a.approval_status === "rejected");
  const pending = all.filter((a) => a.approval_status !== "approved" && a.approval_status !== "rejected");

  return (
    <div className="frank-review-page" style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
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
            <RefreshCw size={14} /> {loading ? "Loading…" : "Refresh"}
          </button>
          <button type="button" onClick={() => void handleHandoff()} disabled={handoffBusy} style={btnPrimary}>
            <Download size={14} /> {handoffBusy ? "Packaging…" : "Generate handoff"}
          </button>
        </div>
      </header>

      {error ? <p style={{ color: "#c0392b" }}>Error: {error}</p> : null}
      {handoffMsg ? <p style={{ opacity: 0.8 }}>{handoffMsg}</p> : null}
      {handoffData ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
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
          <div key={a.id} style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
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
                    <Check size={12} /> Approve
                  </button>
                ) : null}
                {onReject ? (
                  <button type="button" disabled={busy} onClick={() => onReject(a)} style={{ ...btnSmall, background: "#fdecec", borderColor: "#e29a9a", color: "#8a1e1e" }}>
                    <X size={12} /> {rejectLabel ?? "Reject"}
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
