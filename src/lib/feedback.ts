import { supabase, os } from "./supabaseClient";
import { APP_KEY } from "./coreConfig";

export type FeedbackStatus = "open" | "in_progress" | "done" | "dismissed";

export type FeedbackRow = {
  id: string;
  tenant_id?: string | null;
  user_id: string | null;
  message: string;
  page_path: string | null;
  route_name: string | null;
  viewport: string | null;
  user_agent: string | null;
  screenshot_path: string | null;
  status: FeedbackStatus;
  task_id: string | null;
  created_at: string;
  updated_at: string;
};

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;
const MAX_BASE64_LEN = Math.ceil((4.5 * 1024 * 1024) * 4 / 3);

export type SubmitFeedbackInput = {
  message: string;
  pagePath?: string | null;
  routeName?: string | null;
  viewport?: string | null;
  userAgent?: string | null;
  screenshotBase64?: string | null;
  screenshotMime?: string | null;
};

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "bin";
}

/**
 * Client-side feedback submission. Auth + access rules are enforced by
 * Supabase RLS (INSERT requires `auth.uid() IS NOT NULL`) and by the
 * feedback-screenshots storage policies (user can only write to a folder
 * matching their auth uid). No service-role key is used.
 */
export async function submitFeedback(input: SubmitFeedbackInput): Promise<{
  ok: true;
  feedbackId: string;
  taskId: string | null;
  warning?: string;
}> {
  const message = (input.message ?? "").trim();
  if (message.length < 3 || message.length > 4000) {
    throw new Error("Message must be between 3 and 4000 characters.");
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) throw new Error("You must be signed in to submit feedback.");
  const userId = userData.user.id;

  let screenshotPath: string | null = null;

  if (input.screenshotBase64 && input.screenshotMime) {
    if (!ALLOWED_MIME.has(input.screenshotMime)) {
      throw new Error("Screenshot must be PNG, JPEG, or WEBP.");
    }
    if (input.screenshotBase64.length > MAX_BASE64_LEN) {
      throw new Error("Screenshot payload too large.");
    }
    const bytes = decodeBase64(input.screenshotBase64);
    if (bytes.byteLength > MAX_SCREENSHOT_BYTES) {
      throw new Error("Screenshot must be 3 MB or smaller.");
    }
    const ext = extForMime(input.screenshotMime);
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${userId}/${Date.now()}-${rand}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("feedback-screenshots")
      .upload(path, bytes, { contentType: input.screenshotMime, upsert: false });
    if (upErr) throw new Error(`Screenshot upload failed: ${upErr.message}`);
    screenshotPath = path;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("feedback_items")
    .insert({
      user_id: userId,
      message,
      page_path: input.pagePath ?? null,
      route_name: input.routeName ?? null,
      viewport: input.viewport ?? null,
      user_agent: input.userAgent ? input.userAgent.slice(0, 500) : null,
      screenshot_path: screenshotPath,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    // eslint-disable-next-line no-console
    console.error("[feedback] submission failed", insErr);
    throw new Error(insErr?.message || "Failed to record feedback.");
  }


  // Task auto-creation: this project has no `tasks` table, so skip.
  const taskId: string | null = null;

  return { ok: true, feedbackId: inserted.id, taskId };
}

export async function listFeedback(): Promise<FeedbackRow[]> {
  const { data, error } = await supabase
    .from("feedback_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as FeedbackRow[];
}

export async function updateFeedbackStatus(input: { id: string; status: FeedbackStatus }) {
  const allowed: FeedbackStatus[] = ["open", "in_progress", "done", "dismissed"];
  if (!allowed.includes(input.status)) throw new Error("Invalid status.");
  const { error } = await supabase
    .from("feedback_items")
    .update({ status: input.status })
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function getFeedbackScreenshotUrl(input: { path: string }): Promise<{ url: string }> {
  const { data, error } = await supabase.storage
    .from("feedback-screenshots")
    .createSignedUrl(input.path, 600);
  if (error || !data) throw new Error(error?.message || "Failed to sign URL");
  return { url: data.signedUrl };
}

export async function isCurrentUserStaff(): Promise<boolean> {
  // Same source of truth as the rest of the OS: the app role this person
  // holds for Create Studio in the company they are acting in.
  const { data, error } = await os.rpc("app_role", { app_key: APP_KEY });
  if (error) return false;
  const role = (data as string | null)?.toLowerCase() ?? null;
  return role === "admin" || role === "manager";
}

/**
 * A platform admin is an admin across every company, not just the one they are
 * acting in. The OS decides this (`is_platform_admin()`), so triage stays a single
 * place: an admin sees their own company, a platform admin sees all of them.
 */
export async function isCurrentUserPlatformAdmin(): Promise<boolean> {
  const { data, error } = await os.rpc("is_platform_admin");
  if (error) return false;
  return Boolean(data);
}

/** Company id -> display name, for labelling feedback that spans companies. */
export async function listVisibleCompanies(): Promise<Record<string, string>> {
  const { data, error } = await os.rpc("my_viewable_tenants");
  if (error || !Array.isArray(data)) return {};
  const out: Record<string, string> = {};
  for (const row of data as Array<{ id?: string; name?: string; slug?: string }>) {
    if (row?.id) out[row.id] = row.name ?? row.slug ?? row.id;
  }
  return out;
}
