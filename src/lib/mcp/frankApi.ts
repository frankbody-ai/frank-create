import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * The studio's own API — MCP tools drive the exact same endpoints as the app UI.
 *
 * Data lives in the AutoSolutions core, but this function is DEPLOYED on the
 * host that owns the AI gateway keys, so its base URL is not the core's host.
 * Keep it configurable: moving the function later is then a setting, not a
 * code change (the SPA uses VITE_FRANK_API_BASE for the same reason).
 */
const FRANK_API_FALLBACK = "https://amwfmlqvaranonhyvqbj.supabase.co/functions/v1/frank-api";

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env?: { get?: (key: string) => string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

const FRANK_BASE = runtimeEnv("FRANK_API_BASE")?.trim() || FRANK_API_FALLBACK;

export type FrankAsset = {
  id?: string;
  title?: string;
  media_type?: "image" | "video";
  model?: string;
  preview_url?: string;
  remote_url?: string;
  width?: number;
  height?: number;
  aspect_ratio?: string;
  prompt?: string;
  session_id?: string;
  turn_id?: string;
};

export type FrankTurnResponse = {
  turn?: { id?: string; status?: string } | null;
  status?: string;
  assets?: FrankAsset[];
  error?: { code?: string; message?: string } | null;
};

export function assetSummary(asset: FrankAsset) {
  return {
    id: asset.id,
    media_type: asset.media_type ?? "image",
    model: asset.model,
    width: asset.width ?? null,
    height: asset.height ?? null,
    aspect_ratio: asset.aspect_ratio ?? null,
    prompt: asset.prompt ?? null,
    session_id: asset.session_id ?? null,
    url: asset.preview_url || asset.remote_url || null,
  };
}

export async function frankFetch<T>(
  ctx: ToolContext | null,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = ctx?.getToken();
  const res = await fetch(`${FRANK_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      message = parsed.error?.message || text;
    } catch {
      // keep raw text
    }
    throw new Error(`Studio API ${res.status}: ${String(message).slice(0, 500)}`);
  }
  return JSON.parse(text || "{}") as T;
}

/**
 * Long provider runs answer "running" and finish out of band. Poll the run for
 * up to `maxMs`, then hand the turn id back so the caller can check again with
 * the `check_run` tool instead of hanging past the MCP client's timeout.
 */
export async function pollRun(
  ctx: ToolContext,
  first: FrankTurnResponse,
  maxMs = 110_000,
): Promise<FrankTurnResponse & { timed_out?: boolean }> {
  let latest = first;
  const turnId = latest.turn?.id;
  if (!turnId || latest.status !== "running") return latest;
  const started = Date.now();
  let delay = 4_000;
  while (Date.now() - started < maxMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 2_000, 10_000);
    try {
      latest = await frankFetch<FrankTurnResponse>(ctx, "/inference/status", {
        method: "POST",
        body: { turn_id: turnId },
      });
    } catch {
      continue; // transient poll failure — keep waiting
    }
    if (latest.status !== "running") return latest;
  }
  return { ...latest, timed_out: true };
}
