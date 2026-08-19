import React from "react";

import { Icon } from "../ds";
import type { StudioSession } from "../types";

export interface SessionFoldersProps {
  sessions: StudioSession[];
  activeSessionId: string | null;
  onSelect: (session: StudioSession) => void;
  onRename: (session: StudioSession) => void;
  onArchive: (session: StudioSession) => void;
  onNew: () => void;
}

/**
 * Session organiser in the left nav. Reads as a folder list: one row per
 * session, rename and archive on the row itself, and a single "New session"
 * action that always starts a fresh run history.
 */
export function SessionFolders({
  sessions,
  activeSessionId,
  onSelect,
  onRename,
  onArchive,
  onNew,
}: SessionFoldersProps) {
  return (
    <div className="session-folders">
      <div className="session-folders__head">
        <span className="session-folders__title">Sessions</span>
        <button type="button" className="session-folders__new" onClick={onNew} title="New session">
          <Icon source="plus" size={14} tone="inherit" />
          New
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="session-folders__empty">No sessions yet.</p>
      ) : (
        <ul className="session-folders__list">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <li key={session.id}>
                <div className={["session-folder", isActive && "is-active"].filter(Boolean).join(" ")}>
                  <button
                    type="button"
                    className="session-folder__open"
                    onClick={() => onSelect(session)}
                    aria-current={isActive ? "true" : undefined}
                    title={session.name}
                  >
                    <Icon source="folder" size={16} tone="inherit" />
                    <span className="session-folder__name">{session.name}</span>
                  </button>
                  <span className="session-folder__actions">
                    <button
                      type="button"
                      onClick={() => onRename(session)}
                      title="Rename session"
                      aria-label={`Rename ${session.name}`}
                    >
                      <Icon source="pencil-square" size={14} tone="inherit" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onArchive(session)}
                      title="Archive session"
                      aria-label={`Archive ${session.name}`}
                    >
                      <Icon source="trash" size={14} tone="inherit" />
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
