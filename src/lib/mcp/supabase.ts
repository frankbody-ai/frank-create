import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

// The AutoSolutions OS core. The project ref is public (like the publishable
// key) and is the only value that survives publish unchanged. MCP tools read
// the same rows the app does, so they must point at the same project.
export const PROJECT_REF = "allzlfxbemhhhihdpxfv";
export const DIRECT_SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

/** Public anon key of the core — the same value the app bundles. */
const CORE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsbHpsZnhiZW1oaGhpaGRweGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODE0ODksImV4cCI6MjEwMjY1NzQ4OX0.uGWNGg9onAFF88OZ6A_N3bacv805VLea1H_uKSH2LAI";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

/**
 * The core, always.
 *
 * This used to prefer SUPABASE_URL, but the host injects its own project
 * into that name — so every MCP generation wrote to the old database while
 * the app read the core. Only an explicit CORE_* override wins now.
 */
function supabaseProjectUrl(): string {
  return configuredEnv(["CORE_SUPABASE_URL"]) ?? DIRECT_SUPABASE_URL;
}

/**
 * Key for the core. Host-injected key names are deliberately ignored: they
 * belong to a different project and would be rejected there ("Invalid API
 * key"), or worse, silently read the wrong database.
 */
function supabasePublishableKey(): string {
  return configuredEnv(["CORE_SUPABASE_ANON_KEY"]) ?? CORE_PUBLISHABLE_KEY;
}

/** Client bound to the verified caller's token, so RLS runs as that user. */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
    // Studio tables live in the core's `studio` schema.
    db: { schema: "studio" },
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const notAuthenticated = {
  content: [{ type: "text" as const, text: "Not authenticated." }],
  isError: true as const,
};

export function textResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

export const STUDIO_BUCKET = "studio-images";

/** Best-effort signed URL for a stored asset; returns null when unavailable. */
export async function signedAssetUrl(
  supabase: ReturnType<typeof supabaseForUser>,
  storagePath: string | null | undefined,
): Promise<string | null> {
  if (!storagePath) return null;
  try {
    const { data } = await supabase.storage
      .from(STUDIO_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
