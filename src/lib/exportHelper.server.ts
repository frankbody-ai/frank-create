// TEMPORARY migration helper. Delete this file and the two routes under
// src/routes/api/public/export-helper/ once the Studio -> core migration is done.
//
// Security notes:
// - Every request must present x-export-secret matching EXPORT_SHARED_SECRET.
// - The comparison is length-checked and constant-time.
// - No credential of any kind is ever returned; only row data, object metadata
//   and short-lived signed URLs.

export type TableConfig = {
  /** Ordering key (primary key) so paging is stable. */
  pk: string;
  /** Columns used for the `since` filter. */
  timeCols: string[];
  /** Column holding the owning user id, if any. */
  userCol?: string;
};

export const ALLOWED_TABLES: Record<string, TableConfig> = {
  sessions: { pk: "id", timeCols: ["created_at", "updated_at"], userCol: "user_id" },
  messages: { pk: "seq", timeCols: ["created_at"], userCol: "user_id" },
  assets: { pk: "id", timeCols: ["created_at"], userCol: "user_id" },
  prompt_chats: { pk: "id", timeCols: ["created_at", "updated_at"], userCol: "user_id" },
  prompt_chat_messages: { pk: "id", timeCols: ["created_at"], userCol: "user_id" },
  feedback_items: { pk: "id", timeCols: ["created_at", "updated_at"], userCol: "user_id" },
  presets: { pk: "id", timeCols: ["created_at"] },
  brand_kits: { pk: "id", timeCols: ["created_at", "updated_at"], userCol: "user_id" },
  user_features: { pk: "user_id", timeCols: ["updated_at"], userCol: "user_id" },
  app_settings: { pk: "id", timeCols: ["updated_at"] },
  prompt_agent_config: { pk: "id", timeCols: ["created_at", "updated_at"] },
  prompt_agent_skills: { pk: "key", timeCols: ["created_at", "updated_at"] },
  model_capabilities: { pk: "model_key", timeCols: ["created_at"] },
  generation_errors: { pk: "id", timeCols: ["created_at"], userCol: "user_id" },
  asset_approval_events: { pk: "id", timeCols: ["created_at"], userCol: "user_id" },
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns a Response to send back when the caller is not authorised, else null. */
export function checkSecret(request: Request): Response | null {
  const expected = process.env["EXPORT_SHARED_SECRET"];
  if (!expected) {
    return json({ error: "Export helper is not configured" }, 503);
  }
  const provided = request.headers.get("x-export-secret") ?? "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    return json({ error: "Forbidden" }, 403);
  }
  return null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

/** id -> email map for every auth user (the destination maps people by email). */
export async function buildEmailMap(admin: AdminClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) if (u.email) map.set(u.id, u.email);
    if (users.length < 200) break;
  }
  return map;
}

/** Recursively lists every object path in a bucket, sorted for stable paging. */
export async function listAllObjects(
  admin: AdminClient,
  bucket: string,
): Promise<{ path: string; size: number | null; updated_at: string | null }[]> {
  const out: { path: string; size: number | null; updated_at: string | null }[] = [];
  const queue: string[] = [""];
  while (queue.length) {
    const prefix = queue.shift()!;
    let offset = 0;
    for (;;) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      const entries = data ?? [];
      for (const entry of entries) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        // Folders come back without an id / metadata.
        if (!entry.id) queue.push(path);
        else
          out.push({
            path,
            size: (entry.metadata as { size?: number } | null)?.size ?? null,
            updated_at: entry.updated_at ?? null,
          });
      }
      if (entries.length < 1000) break;
      offset += entries.length;
    }
  }
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return out;
}
