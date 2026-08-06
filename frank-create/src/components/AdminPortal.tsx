import React, { useEffect, useMemo, useState } from "react";
import {
  listUsersWithRoles,
  setUserRole,
  isCurrentUserAdmin,
  type AdminUserRow,
  type AppRole,
} from "../lib/admin";
import {
  listFeedback,
  updateFeedbackStatus,
  getFeedbackScreenshotUrl,
  type FeedbackRow,
  type FeedbackStatus,
} from "../lib/feedback";
import { supabase } from "../lib/supabaseClient";
import { PromptAgentTab } from "./admin/PromptAgentTab";


const ROLES: AppRole[] = ["user", "manager", "admin"];
const BOARD_COLUMNS: { key: FeedbackStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

function fmt(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export function AdminPortal() {
  const initialTab = (() => {
    const h = window.location.hash;
    const q = h.includes("?") ? h.split("?")[1] : "";
    const t = new URLSearchParams(q).get("tab");
    if (t === "feedback") return "feedback" as const;
    if (t === "prompt-agent") return "prompt-agent" as const;
    return "users" as const;
  })();
  const [tab, setTab] = useState<"users" | "feedback" | "prompt-agent">(initialTab);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    isCurrentUserAdmin().then(setIsAdmin);
    supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id ?? null));
  }, []);

  if (isAdmin === null) {
    return <div className="admin-portal"><div className="admin-portal-loading">Loading…</div></div>;
  }
  if (!isAdmin) {
    return (
      <div className="admin-portal">
        <div className="admin-portal-denied">
          <h1>Not authorized</h1>
          <p>You need the admin role to view this page.</p>
          <a className="admin-portal-link" href="#/">Back to Frank Create</a>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-portal">
      <header className="admin-portal-header">
        <div>
          <h1>Admin portal</h1>
          <p>Manage roles, triage user feedback, and edit the Prompt Generator agent.</p>
        </div>
        <a className="admin-portal-link" href="#/">← Back to app</a>
      </header>
      <nav className="admin-portal-tabs">
        <button
          className={`admin-portal-tab ${tab === "users" ? "active" : ""}`}
          onClick={() => setTab("users")}
        >Users</button>
        <button
          className={`admin-portal-tab ${tab === "feedback" ? "active" : ""}`}
          onClick={() => setTab("feedback")}
        >Feedback tasks</button>
        <button
          className={`admin-portal-tab ${tab === "prompt-agent" ? "active" : ""}`}
          onClick={() => setTab("prompt-agent")}
        >Prompt agent</button>
      </nav>
      {tab === "users" ? <UsersTab meId={meId} /> : tab === "feedback" ? <FeedbackBoard /> : <PromptAgentTab />}

    </div>
  );
}

function UsersTab({ meId }: { meId: string | null }) {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const refresh = async () => {
    try { setUsers(await listUsersWithRoles()); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load users."); }
  };
  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    if (!users) return null;
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.email ?? "").toLowerCase().includes(q));
  }, [users, query]);

  const onChangeRole = async (u: AdminUserRow, next: AppRole) => {
    if (next === u.role) return;
    const changingSelf = u.id === meId;
    const grantingAdmin = next === "admin" && u.role !== "admin";
    const removingAdmin = u.role === "admin" && next !== "admin";
    let msg: string | null = null;
    if (grantingAdmin) msg = `Grant ADMIN access to ${u.email}? They will be able to change roles for anyone, including you.`;
    else if (removingAdmin) msg = changingSelf
      ? `Remove YOUR OWN admin role? You will lose access to this portal.`
      : `Remove admin from ${u.email}?`;
    if (msg && !window.confirm(msg)) return;
    setBusy(u.id);
    try {
      await setUserRole(u.id, next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="admin-users">
      <div className="admin-users-toolbar">
        <input
          className="admin-users-search"
          type="search"
          placeholder="Search by email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="admin-portal-refresh" type="button" onClick={refresh}>Refresh</button>
      </div>
      {error && <div className="admin-portal-error">{error}</div>}
      {filtered === null ? (
        <div className="admin-portal-loading">Loading users…</div>
      ) : filtered.length === 0 ? (
        <div className="admin-portal-empty">No users found.</div>
      ) : (
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className={u.id === meId ? "is-self" : ""}>
                  <td>
                    <div className="admin-users-email">{u.email ?? "—"}</div>
                    {u.id === meId && <div className="admin-users-you">you</div>}
                  </td>
                  <td>
                    <select
                      value={u.role}
                      disabled={busy === u.id}
                      onChange={(e) => onChangeRole(u, e.target.value as AppRole)}
                      className={`admin-role-select role-${u.role}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>{fmt(u.created_at)}</td>
                  <td>{fmt(u.last_sign_in_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FeedbackBoard() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shots, setShots] = useState<Record<string, string>>({});
  const [showDismissed, setShowDismissed] = useState(false);

  const refresh = async () => {
    try { setRows(await listFeedback()); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load feedback."); }
  };
  useEffect(() => { refresh(); }, []);

  const onStatus = async (id: string, status: FeedbackStatus) => {
    try { await updateFeedbackStatus({ id, status }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
  };

  const loadShot = async (id: string, path: string) => {
    if (shots[id]) return;
    try {
      const { url } = await getFeedbackScreenshotUrl({ path });
      setShots((s) => ({ ...s, [id]: url }));
    } catch {/* ignore */}
  };

  const grouped = useMemo(() => {
    const map: Record<FeedbackStatus, FeedbackRow[]> = {
      open: [], in_progress: [], done: [], dismissed: [],
    };
    (rows ?? []).forEach((r) => map[r.status].push(r));
    return map;
  }, [rows]);

  return (
    <section className="admin-board">
      <div className="admin-board-toolbar">
        <button className="admin-portal-refresh" type="button" onClick={refresh}>Refresh</button>
        <label className="admin-board-toggle">
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={(e) => setShowDismissed(e.target.checked)}
          />
          Show dismissed ({grouped.dismissed.length})
        </label>
      </div>
      {error && <div className="admin-portal-error">{error}</div>}
      {rows === null ? (
        <div className="admin-portal-loading">Loading feedback…</div>
      ) : (
        <div className="admin-board-columns">
          {BOARD_COLUMNS.map((col) => (
            <div key={col.key} className="admin-board-column">
              <div className="admin-board-column-header">
                <span>{col.label}</span>
                <span className="admin-board-count">{grouped[col.key].length}</span>
              </div>
              <div className="admin-board-cards">
                {grouped[col.key].length === 0 && (
                  <div className="admin-board-empty">Nothing here.</div>
                )}
                {grouped[col.key].map((r) => (
                  <FeedbackCard
                    key={r.id}
                    row={r}
                    onStatus={onStatus}
                    onLoadShot={loadShot}
                    shotUrl={shots[r.id] ?? null}
                  />
                ))}
              </div>
            </div>
          ))}
          {showDismissed && (
            <div className="admin-board-column">
              <div className="admin-board-column-header">
                <span>Dismissed</span>
                <span className="admin-board-count">{grouped.dismissed.length}</span>
              </div>
              <div className="admin-board-cards">
                {grouped.dismissed.map((r) => (
                  <FeedbackCard
                    key={r.id}
                    row={r}
                    onStatus={onStatus}
                    onLoadShot={loadShot}
                    shotUrl={shots[r.id] ?? null}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FeedbackCard({
  row, onStatus, onLoadShot, shotUrl,
}: {
  row: FeedbackRow;
  onStatus: (id: string, s: FeedbackStatus) => void;
  onLoadShot: (id: string, path: string) => void;
  shotUrl: string | null;
}) {
  useEffect(() => {
    if (row.screenshot_path && !shotUrl) onLoadShot(row.id, row.screenshot_path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, row.screenshot_path]);

  return (
    <article className="admin-board-card">
      <div className="admin-board-card-meta">
        <span>{fmt(row.created_at)}</span>
        {row.page_path && <span title={row.page_path}>· {row.page_path.slice(0, 40)}</span>}
      </div>
      <p className="admin-board-card-msg">{row.message}</p>
      {shotUrl && (
        <a href={shotUrl} target="_blank" rel="noreferrer">
          <img className="admin-board-card-shot" src={shotUrl} alt="screenshot" />
        </a>
      )}
      <div className="admin-board-card-actions">
        <select
          value={row.status}
          onChange={(e) => onStatus(row.id, e.target.value as FeedbackStatus)}
        >
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
          <option value="dismissed">Dismiss</option>
        </select>
      </div>
    </article>
  );
}
