import { useEffect, useMemo, useState } from "react";

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
  setUserAccessApproved,
  setRequireAccessApproval,
  getMyAccessState,
  isCurrentUserAdmin,
  type AdminUserRow,
  type AppRole,
} from "../lib/admin";

import { HUB_URL } from "autosolutions-os";
import { APP_KEY } from "../lib/coreConfig";
import { supabase } from "../lib/supabaseClient";
import { PromptAgentTab } from "./admin/PromptAgentTab";
import { WhatsNewButton } from "./WhatsNewButton";

const ROLES: AppRole[] = ["user", "manager", "admin"];
/* Feedback from every app lives in the Hub since autosolutions-os 0.4.0: the
   ? in the top bar sends it, and Admin > Feedback lists it. */
const HUB_FEEDBACK = `${HUB_URL}/admin?view=feedback&app=${APP_KEY}`;

type Tab = "users" | "prompt-agent";

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
    return t === "prompt-agent" ? t : "users";
  });
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [userCount, setUserCount] = useState<number | null>(null);

  /* An old link to the feedback board (/admin/feedback, the old Slack DMs)
     opens this app's feedback in the Hub. */
  useEffect(() => {
    if (adminTabFromUrl() === "feedback") window.location.replace(HUB_FEEDBACK);
  }, []);

  useEffect(() => {
    void isCurrentUserAdmin().then(setIsAdmin);
    void supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id ?? null));
  }, []);

  if (isAdmin === null) {
    return (
      <Shell screen="admin">
        <PageHeader title="Admin portal" subtitle="Checking your role." actions={<WhatsNewButton />} />
        <Card>
          <Spinner />
        </Card>
      </Shell>
    );
  }

  if (!isAdmin) {
    return (
      <Shell screen="admin" maxWidth="var(--content-max-width-one-column)">
        <PageHeader title="Admin portal" actions={<WhatsNewButton />} />
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
      searchLabel={tab === "users" ? "Search operators by email" : "Search"}
    >
      <PageHeader
        title="Admin portal"
        subtitle="Manage roles and edit the prompt generator agent. Feedback from every app is in the Hub, under Admin > Feedback."
        badge={<Badge tone="info">Admin only</Badge>}
        actions={
          <>
            <Button icon="arrow-left" onClick={() => navigate("studio")}>
              Back to studio
            </Button>
            <WhatsNewButton />
          </>
        }
      />

      <Tabs
        tabs={[
          { id: "users", label: "Users", count: userCount ?? undefined },
          { id: "prompt-agent", label: "Prompt agent" },
        ]}
        selected={tab}
        onSelect={(id) => setTab(id as Tab)}
      />

      {tab === "users" ? (
        <UsersTab meId={meId} search={search} onCount={setUserCount} />
      ) : (
        <PromptAgentTab />
      )}
    </Shell>
  );
}

const USER_COLUMNS: DataTableColumn[] = [
  { key: "email", title: "Email" },
  { key: "access", title: "Platform access", width: "170px" },
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
  const [requireApproval, setRequireApproval] = useState(false);
  const [gateBusy, setGateBusy] = useState(false);

  useEffect(() => {
    void getMyAccessState()
      .then((s) => setRequireApproval(s.require_approval))
      .catch(() => { /* leave the gate reported as off */ });
  }, []);

  const onToggleGate = async (next: boolean) => {
    setGateBusy(true);
    try {
      await setRequireAccessApproval(next);
      setRequireApproval(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change the approval requirement.");
    } finally {
      setGateBusy(false);
    }
  };


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
  const onChangeAccess = async (u: AdminUserRow, next: boolean) => {
    if (
      !next &&
      !window.confirm(
        `Put ${u.email} back on hold? They stay signed up but can't use the platform until you approve them again.`,
      )
    )
      return;
    setBusy(u.id);
    try {
      await setUserAccessApproved(u.id, next);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change platform access.");
    } finally {
      setBusy(null);
    }
  };

  const pending = (users ?? []).filter((u) => !u.access_approved).length;

  return (
    <>
      {error ? <Banner tone="critical" title="Something went wrong">{error}</Banner> : null}

      <Card
        title="Access approval"
        actions={
          <Switch
            label={requireApproval ? "Approval required" : "Open to allowed domains"}
            checked={requireApproval}
            disabled={gateBusy}
            onChange={(next) => void onToggleGate(next)}
          />
        }
      >
        <Text variant="bodySm" tone="secondary" as="p">
          {requireApproval
            ? `New people from an allowed work domain wait on a holding screen until you approve them here. ${pending} waiting.`
            : "Anyone with an allowed work domain can sign in straight away. Turn this on when you want to approve people one by one."}
        </Text>
      </Card>



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
            access: (
              <Switch
                size="small"
                label={u.access_approved ? "Approved" : "On hold"}
                checked={u.access_approved}
                disabled={busy === u.id}
                onChange={(next) => void onChangeAccess(u, next)}
              />
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
