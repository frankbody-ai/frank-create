import React, { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  DataTable,
  PageHeader,
  Select,
  Spinner,
  Switch,
  Tabs,
  Text,
} from "../ds";

import type { DataTableColumn } from "../ds";
import { Shell } from "../Shell";
import { adminTabFromUrl, navigate } from "../nav";
import {
  listUsersWithRoles,
  setUserRole,
  setUserVideoAccess,
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
const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "dismissed", label: "Dismiss" },
];

type Tab = "users" | "feedback" | "prompt-agent";

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AdminPortal() {
  const [tab, setTab] = useState<Tab>(() => {
    const t = adminTabFromUrl();
    return t === "feedback" || t === "prompt-agent" ? t : "users";
  });
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [feedbackCount, setFeedbackCount] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    void isCurrentUserAdmin().then(setIsAdmin);
    void supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id ?? null));
  }, []);

  if (isAdmin === null) {
    return (
      <Shell screen="admin">
        <PageHeader title="Admin portal" subtitle="Checking your role." />
        <Card>
          <Spinner />
        </Card>
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell screen="admin" maxWidth="var(--content-max-width-one-column)">
        <PageHeader title="Admin portal" />
        <Banner
          tone="critical"
          title="You don't have access to this portal"
          action={<Button onClick={() => navigate("studio")}>Back to studio</Button>}
        >
          <span>The admin role manages operator access. Ask an admin to grant it to you.</span>
        </Banner>
      </Shell>
    );
  }

  return (
    <Shell
      screen="admin"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={tab === "users" ? "Search operators by email" : "Search feedback"}
    >
      <PageHeader
        title="Admin portal"
        subtitle="Manage roles, triage feedback, and edit the prompt generator agent."
        badge={<Badge tone="info">Admin only</Badge>}
        actions={
          <Button icon="arrow-left" onClick={() => navigate("studio")}>
            Back to studio
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: "users", label: "Users", count: userCount ?? undefined },
          { id: "feedback", label: "Feedback tasks", count: feedbackCount ?? undefined },
          { id: "prompt-agent", label: "Prompt agent" },
        ]}
        selected={tab}
        onSelect={(id) => setTab(id as Tab)}
      />

      {tab === "users" ? (
        <UsersTab meId={meId} search={search} onCount={setUserCount} />
      ) : tab === "feedback" ? (
        <FeedbackBoard search={search} onCount={setFeedbackCount} />
      ) : (
        <PromptAgentTab />
      )}
    </Shell>
  );
}

const USER_COLUMNS: DataTableColumn[] = [
  { key: "email", title: "Email" },
  { key: "role", title: "Role", width: "180px" },
  { key: "video", title: "Video generator", width: "170px" },
  { key: "joined", title: "Joined" },
  { key: "seen", title: "Last sign-in" },
];


function UsersTab({
  meId,
  search,
  onCount,
}: {
  meId: string | null;
  search: string;
  onCount: (n: number) => void;
}) {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await listUsersWithRoles();
      setUsers(next);
      onCount(next.length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load operators. Refresh to try again.");
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!users) return null;
    const q = search.trim().toLowerCase();
    return q ? users.filter((u) => (u.email ?? "").toLowerCase().includes(q)) : users;
  }, [users, search]);

  const onChangeRole = async (u: AdminUserRow, next: AppRole) => {
    if (next === u.role) return;
    const changingSelf = u.id === meId;
    const grantingAdmin = next === "admin" && u.role !== "admin";
    const removingAdmin = u.role === "admin" && next !== "admin";
    // Confirmations name the consequence rather than asking "are you sure".
    let msg: string | null = null;
    if (grantingAdmin) {
      msg = `Give ${u.email} the admin role? They will be able to change roles for anyone, including you.`;
    } else if (removingAdmin) {
      msg = changingSelf
        ? "Remove your own admin role? Your access to this portal ends immediately and you can't restore it yourself."
        : `Remove admin from ${u.email}? They keep their account and lose access to this portal.`;
    }
    if (msg && !window.confirm(msg)) return;
    setBusy(u.id);
    try {
      await setUserRole(u.id, next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update the role.");
    } finally {
      setBusy(null);
    }
  };

  const onChangeVideo = async (u: AdminUserRow, next: boolean) => {
    setBusy(u.id);
    try {
      await setUserVideoAccess(u.id, next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change video access.");
    } finally {
      setBusy(null);
    }
  };


  return (
    <>
      {error ? <Banner tone="critical" title="Something went wrong">{error}</Banner> : null}

      <Card padding="none">
        <div className="admin-toolbar">
          <Text variant="bodySm" tone="secondary">
            {filtered ? `${filtered.length.toLocaleString()} operators` : "Loading operators"}
          </Text>
          <span className="admin-toolbar__spacer" />
          <Button icon="arrow-path" loading={refreshing} onClick={() => void refresh()}>
            Refresh list
          </Button>
        </div>
        <DataTable
          columns={USER_COLUMNS}
          rows={(filtered ?? []).map((u) => ({
            id: u.id,
            email: (
              <div className="admin-user-email">
                <Text fontWeight="medium">{u.email ?? "—"}</Text>
                {u.id === meId ? <Badge tone="neutral">you</Badge> : null}
              </div>
            ),
            role: (
              <Select
                label="Role"
                labelHidden
                options={ROLES.map((r) => ({ value: r, label: r }))}
                value={u.role}
                disabled={busy === u.id}
                onChange={(e) => void onChangeRole(u, e.target.value as AppRole)}
              />
            ),
            video: (
              <Switch
                size="small"
                label={u.video_enabled ? "On" : "Off"}
                checked={u.video_enabled}
                disabled={busy === u.id}
                onChange={(next) => void onChangeVideo(u, next)}
              />
            ),
            joined: fmt(u.created_at),
            seen: fmt(u.last_sign_in_at),

          }))}
          emptyState={
            <Text as="p" tone="secondary">
              {filtered === null
                ? "Loading operators."
                : search.trim()
                  ? `No operator matches "${search.trim()}".`
                  : "No operators yet."}
            </Text>
          }
        />
      </Card>

      <Text variant="bodySm" tone="secondary" as="p">
        Granting admin lets that person change roles for anyone, including you. Removing your own
        admin role ends your access to this portal.
      </Text>
    </>
  );
}

function FeedbackBoard({ search, onCount }: { search: string; onCount: (n: number) => void }) {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shots, setShots] = useState<Record<string, string>>({});
  const [showDismissed, setShowDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await listFeedback();
      setRows(next);
      onCount(next.filter((r) => r.status !== "dismissed").length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load feedback. Refresh to try again.");
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStatus = async (id: string, status: FeedbackStatus) => {
    try {
      await updateFeedbackStatus({ id, status });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't move that task.");
    }
  };

  const loadShot = async (id: string, path: string) => {
    if (shots[id]) return;
    try {
      const { url } = await getFeedbackScreenshotUrl({ path });
      setShots((s) => ({ ...s, [id]: url }));
    } catch {
      /* a missing screenshot is not worth an error banner */
    }
  };

  const grouped = useMemo(() => {
    const map: Record<FeedbackStatus, FeedbackRow[]> = {
      open: [],
      in_progress: [],
      done: [],
      dismissed: [],
    };
    const q = search.trim().toLowerCase();
    (rows ?? [])
      .filter((r) => !q || `${r.message} ${r.page_path ?? ""}`.toLowerCase().includes(q))
      .forEach((r) => map[r.status].push(r));
    return map;
  }, [rows, search]);

  const columns = showDismissed
    ? [...BOARD_COLUMNS, { key: "dismissed" as FeedbackStatus, label: "Dismissed" }]
    : BOARD_COLUMNS;

  return (
    <>
      {error ? <Banner tone="critical" title="Something went wrong">{error}</Banner> : null}

      <div className="admin-toolbar admin-toolbar--bare">
        <Button icon="arrow-path" loading={refreshing} onClick={() => void refresh()}>
          Refresh board
        </Button>
        <Checkbox
          label={`Show dismissed (${grouped.dismissed.length})`}
          checked={showDismissed}
          onChange={(e) => setShowDismissed(e.target.checked)}
        />
      </div>

      {rows === null ? (
        <Card>
          <Spinner />
        </Card>
      ) : (
        <div className="feedback-board">
          {columns.map((col) => (
            <Card
              key={col.key}
              title={col.label}
              actions={<Badge tone="neutral">{String(grouped[col.key].length)}</Badge>}
            >
              <div className="feedback-board__stack">
                {grouped[col.key].length === 0 ? (
                  <Text variant="bodySm" tone="secondary" as="p">
                    Nothing in this column.
                  </Text>
                ) : null}
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
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function FeedbackCard({
  row,
  onStatus,
  onLoadShot,
  shotUrl,
}: {
  row: FeedbackRow;
  onStatus: (id: string, s: FeedbackStatus) => void;
  onLoadShot: (id: string, path: string) => void;
  shotUrl: string | null;
}) {
  useEffect(() => {
    if (row.screenshot_path && !shotUrl) void onLoadShot(row.id, row.screenshot_path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id, row.screenshot_path]);

  return (
    <article className="feedback-card">
      <div className="feedback-card__meta">
        <span>{fmt(row.created_at)}</span>
        {row.page_path ? (
          <>
            <span aria-hidden="true">·</span>
            <code title={row.page_path}>{row.page_path}</code>
          </>
        ) : null}
      </div>
      <p className="feedback-card__message">{row.message}</p>
      {shotUrl ? (
        <a href={shotUrl} target="_blank" rel="noreferrer" className="feedback-card__shot">
          <img src={shotUrl} alt={`Screenshot attached to feedback from ${fmt(row.created_at)}`} />
        </a>
      ) : null}
      {row.viewport ? <div className="feedback-card__meta">Viewport {row.viewport}</div> : null}
      <Select
        label="Status"
        labelHidden
        options={STATUS_OPTIONS}
        value={row.status}
        onChange={(e) => onStatus(row.id, e.target.value as FeedbackStatus)}
      />
    </article>
  );
}
