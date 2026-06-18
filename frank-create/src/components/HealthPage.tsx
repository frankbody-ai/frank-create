import { useCallback, useEffect, useState } from "react";
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

export function HealthPage() {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    const r = await runChecks();
    setResults(r);
    setRunning(false);
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const allOk = results?.every((r) => r.ok) ?? false;

  async function copyReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      url: location.href,
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      results,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="frank-health-page">
      <header className="frank-health-header">
        <h1>App Health</h1>
        <p className={`frank-health-overall ${allOk ? "ok" : "bad"}`}>
          {results == null
            ? "Running checks…"
            : allOk
            ? "All systems operational"
            : "One or more checks failed"}
        </p>
        <div className="frank-health-actions">
          <button type="button" onClick={run} disabled={running}>
            {running ? "Running…" : "Re-run checks"}
          </button>
          <button type="button" onClick={copyReport} disabled={!results}>
            Copy report
          </button>
          <a href="/">← Back to app</a>
        </div>
      </header>

      <ul className="frank-health-list">
        {(results ?? []).map((r) => (
          <li key={r.name} className={`frank-health-row ${r.ok ? "ok" : "bad"}`}>
            <span className="frank-health-icon">{r.ok ? "✓" : "✗"}</span>
            <span className="frank-health-name">{r.name}</span>
            <span className="frank-health-latency">{r.latencyMs}ms</span>
            <span className="frank-health-detail">
              {r.error ? `error: ${r.error}` : r.detail ?? ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
