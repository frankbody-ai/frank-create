import React, { useEffect, useState } from "react";
import {
  listFeedback,
  updateFeedbackStatus,
  getFeedbackScreenshotUrl,
  isCurrentUserStaff,
  type FeedbackRow,
  type FeedbackStatus,
} from "../lib/feedback";

const STATUSES: FeedbackStatus[] = ["open", "in_progress", "done", "dismissed"];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AdminFeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<boolean | null>(null);
  const [shots, setShots] = useState<Record<string, string>>({});

  const refresh = async () => {
    try {
      const data = await listFeedback();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feedback.");
    }
  };

  useEffect(() => {
    isCurrentUserStaff().then(setStaff);
    refresh();
  }, []);

  const onStatus = async (id: string, status: FeedbackStatus) => {
    try {
      await updateFeedbackStatus({ id, status });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const loadShot = async (id: string, path: string) => {
    try {
      const { url } = await getFeedbackScreenshotUrl({ path });
      setShots((s) => ({ ...s, [id]: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign URL.");
    }
  };

  return (
    <div className="admin-feedback-page">
      <header className="admin-feedback-header">
        <h1>Feedback triage</h1>
        <a href="#/" className="admin-feedback-back">← Back to app</a>
      </header>

      {staff === false && (
        <div className="admin-feedback-warn">
          You’re signed in but not an admin or manager, so you can only see your own feedback rows.
        </div>
      )}

      {error && <div className="admin-feedback-error">{error}</div>}

      {rows === null && <p className="admin-feedback-muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="admin-feedback-muted">No feedback yet.</p>}

      <div className="admin-feedback-list">
        {rows?.map((row) => (
          <article key={row.id} className="admin-feedback-card">
            <div className="admin-feedback-card-top">
              <span className={`admin-feedback-badge admin-feedback-badge-${row.status}`}>
                {row.status.replace("_", " ")}
              </span>
              <span className="admin-feedback-time">{fmtDate(row.created_at)}</span>
              {row.page_path && <code className="admin-feedback-chip">{row.page_path}</code>}
            </div>
            <p className="admin-feedback-message">{row.message}</p>
            <div className="admin-feedback-meta">
              {row.route_name && <span>route: {row.route_name}</span>}
              {row.viewport && <span>viewport: {row.viewport}</span>}
            </div>
            <div className="admin-feedback-actions">
              <label>
                Status:{" "}
                <select
                  value={row.status}
                  onChange={(e) => onStatus(row.id, e.target.value as FeedbackStatus)}
                  disabled={staff !== true}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </label>
              {row.screenshot_path && !shots[row.id] && (
                <button type="button" onClick={() => loadShot(row.id, row.screenshot_path!)}>
                  Load screenshot
                </button>
              )}
              {row.task_id && (
                <a href="#/" className="admin-feedback-task-link">Task created</a>
              )}
            </div>
            {shots[row.id] && (
              <img src={shots[row.id]} alt="Feedback screenshot" className="admin-feedback-shot" />
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
