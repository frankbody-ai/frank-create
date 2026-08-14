import React, { useCallback, useEffect, useState } from "react";

import { Badge, Button, Card, DataTable, PageHeader, Text } from "../ds";
import type { DataTableColumn } from "../ds";
import { Shell } from "../Shell";
import { fetchHealth, fetchModels } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

type CheckResult = {
  name: string;
  ok: boolean;
  latencyMs: number;
  detail?: string;
  error?: string;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; latencyMs: number; value?: T; error?: string }> {
  const start = performance.now();
  try {
    const value = await fn();
    return { ok: true, latencyMs: Math.round(performance.now() - start), value };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: err?.message || String(err),
    };
  }
}

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const health = await timed(() => fetchHealth());
  results.push({
    name: "Backend /health",
    ok: health.ok && (health.value as any)?.ok !== false,
    latencyMs: health.latencyMs,
    detail: health.value ? `product=${(health.value as any).product}` : undefined,
    error: health.error,
  });

  const models = await timed(() => fetchModels());
  results.push({
    name: "Backend /models",
    ok: models.ok,
    latencyMs: models.latencyMs,
    detail: models.value
      ? `${(models.value as any).models?.length ?? 0} models`
      : undefined,
    error: models.error,
  });

  const auth = await timed(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data;
  });
  results.push({
    name: "Auth session",
    ok: auth.ok,
    latencyMs: auth.latencyMs,
    detail: (auth.value as any)?.session?.user?.email
      ? `signed in as ${(auth.value as any).session.user.email}`
      : "no active session",
    error: auth.error,
  });

  results.push({
    name: "Browser online",
    ok: navigator.onLine,
    latencyMs: 0,
    detail: navigator.onLine ? "online" : "offline",
  });

  const storage = await timed(async () => {
    const k = "__frank_health__";
    localStorage.setItem(k, "1");
    const v = localStorage.getItem(k);
    localStorage.removeItem(k);
    if (v !== "1") throw new Error("read mismatch");
    return true;
  });
  results.push({
    name: "LocalStorage",
    ok: storage.ok,
    latencyMs: storage.latencyMs,
    error: storage.error,
  });

  return results;
}

const COLUMNS: DataTableColumn[] = [
  { key: "check", title: "Check" },
  { key: "result", title: "Result" },
  { key: "latency", title: "Latency", align: "end" },
  { key: "detail", title: "Detail" },
];

/**
 * Five checks, run on load. This is the one screen that renders without a
 * session, so an operator can reach it when sign-in is what is broken.
 */
export function HealthPage() {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");

  const run = useCallback(async () => {
    setRunning(true);
    setResults(await runChecks());
    setRunning(false);
  }, []);

  useEffect(() => { void run(); }, [run]);

  const failed = (results ?? []).filter((r) => !r.ok);
  const allOk = results != null && failed.length === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    url: location.href,
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    failed: failed.map((r) => r.name),
    results,
  };

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the report is on screen either way */
    }
  }

  const query = search.trim().toLowerCase();
  const visible = (results ?? []).filter(
    (r) => !query || `${r.name} ${r.detail ?? ""} ${r.error ?? ""}`.toLowerCase().includes(query)
  );

  const badge =
    results == null
      ? <Badge tone="neutral">Running checks</Badge>
      : allOk
        ? <Badge tone="success" icon="check-circle">All checks passed</Badge>
        : <Badge tone="critical" icon="exclamation-circle">
            {failed.length === 1 ? "One check failed" : `${failed.length} checks failed`}
          </Badge>;

  return (
    <Shell
      screen="health"
      maxWidth="var(--content-max-width-one-column)"
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search checks"
    >
      <PageHeader
        title="App health"
        subtitle="Five checks run on load. Copy the report into a bug before you escalate."
        badge={badge}
        actions={
          <>
            <Button icon="arrow-path" loading={running} onClick={() => void run()}>
              Re-run checks
            </Button>
            <Button icon="document-duplicate" disabled={!results} onClick={() => void copyReport()}>
              {copied ? "Copied" : "Copy report"}
            </Button>
          </>
        }
      />

      <Card padding="none">
        <DataTable
          columns={COLUMNS}
          rows={visible.map((r) => ({
            id: r.name,
            check: <Text fontWeight="medium">{r.name}</Text>,
            result: r.ok ? <Badge tone="success">Pass</Badge> : <Badge tone="critical">Fail</Badge>,
            latency: `${r.latencyMs} ms`,
            detail: (
              <Text tone={r.ok ? "secondary" : "critical"}>
                {r.error ? `error: ${r.error}` : r.detail ?? "—"}
              </Text>
            ),
          }))}
          emptyState={
            <Text as="p" tone="secondary">
              {results == null ? "Running checks." : `No check matches "${search.trim()}".`}
            </Text>
          }
        />
      </Card>

      <Card title="Report" subtitle="This is what Copy report puts on the clipboard.">
        <pre className="code-block">{JSON.stringify(report, null, 2)}</pre>
      </Card>
    </Shell>
  );
}
