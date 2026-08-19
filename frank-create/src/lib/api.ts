import type {
  ActivationChecklist,
  Asset,
  BrandContextReceiptResult,
  BrandKit,
  Brief,
  DemoCallBriefResult,
  EnhanceSettings,
  DemoEvidenceResult,
  DemoDoctorStatus,
  DemoReadinessPackResult,
  ExportRecord,
  FrankConfig,
  ProviderAdapterAudit,
  ProviderEnvStatus,
  ProviderReadiness,
  ProviderReadinessReceiptResult,
  ProviderPreflight,
  Project,
  Run,
  StudioSession,
  StudioTurn,
  TurnRequest,
  VideoRequest
} from "./types";

// The SPA talks to the `frank-api` Lovable Cloud function for everything.
const frankBase = "https://amwfmlqvaranonhyvqbj.supabase.co/functions/v1/frank-api";

export async function fetchHealth() {
  return fetchJson<{ ok: boolean; product: string; store: string }>("/health");
}

export async function fetchConfig() {
  return fetchJson<FrankConfig>("/config");
}

export async function fetchModels() {
  return fetchJson<Pick<FrankConfig, "models" | "backlogModels" | "promptPresets">>("/models");
}














export async function promptAgentChat(payload: {
  messages: { role: "user" | "assistant"; content: string; images?: string[] }[];
  skill?: string;
}) {
  return fetchJson<{ reply: string; model: string; skill: string }>("/prompt-agent", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}


















export async function listSessions() {
  return fetchJson<{ sessions: StudioSession[] }>("/sessions");
}

export async function createSession(payload: Partial<StudioSession> & { name: string }) {
  return fetchJson<{ session: StudioSession }>("/sessions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateSession(sessionId: string, payload: Partial<StudioSession>) {
  return fetchJson<{ session: StudioSession }>(`/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}


export type HandoffStage = "fetch" | "build_manifest" | "generate_json" | "generate_csv" | "validate";

export type HandoffStreamStep = {
  step: HandoffStage | "done" | "error";
  progress: number;
  message: string;
  payload?: {
    handoff?: ExportRecord;
    download_url?: string | null;
    metadata?: Record<string, unknown>;
    issues?: string[];
    resumable_from?: HandoffStage;
    snapshot?: Record<string, unknown>;
    stage?: HandoffStage;
  };
};

export class HandoffError extends Error {
  stage?: HandoffStage;
  issues?: string[];
  resumableFrom?: HandoffStage;
  snapshot?: Record<string, unknown>;
  constructor(message: string, opts: { stage?: HandoffStage; issues?: string[]; resumableFrom?: HandoffStage; snapshot?: Record<string, unknown> } = {}) {
    super(message);
    this.name = "HandoffError";
    this.stage = opts.stage;
    this.issues = opts.issues;
    this.resumableFrom = opts.resumableFrom;
    this.snapshot = opts.snapshot;
  }
}

async function consumeHandoffStream(
  res: Response,
  opts: { signal?: AbortSignal; onStep?: (s: HandoffStreamStep) => void },
) {
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(apiErrorMessage(text, res.status));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload: HandoffStreamStep["payload"] | undefined;
  let errorEvent: HandoffStreamStep | null = null;
  const onAbort = () => { try { reader.cancel(); } catch { /* noop */ } };
  opts.signal?.addEventListener("abort", onAbort);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const chunk of parts) {
        const line = chunk.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const evt = JSON.parse(line.slice(5).trim()) as HandoffStreamStep;
        opts.onStep?.(evt);
        if (evt.step === "done" && evt.payload) finalPayload = evt.payload;
        if (evt.step === "error") errorEvent = evt;
      }
    }
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
  }
  if (errorEvent) {
    const p = errorEvent.payload || {};
    throw new HandoffError(errorEvent.message || "Handoff failed", {
      stage: p.stage,
      issues: p.issues,
      resumableFrom: p.resumable_from,
      snapshot: p.snapshot,
    });
  }
  if (!finalPayload) throw new Error("Handoff stream ended without final payload");
  return finalPayload;
}

export async function createSessionHandoffStream(
  sessionId: string,
  opts: { signal?: AbortSignal; onStep?: (s: HandoffStreamStep) => void } = {}
) {
  const res = await fetch(`${frankBase}/sessions/${encodeURIComponent(sessionId)}/handoff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      ...(await authHeader()),
    },
    body: JSON.stringify({ summary: "Approved Frank Create handoff for review." }),
    signal: opts.signal,
  });
  return consumeHandoffStream(res, opts);
}

export async function resumeSessionHandoffStream(
  sessionId: string,
  fromStage: HandoffStage,
  snapshot: Record<string, unknown>,
  opts: { signal?: AbortSignal; onStep?: (s: HandoffStreamStep) => void } = {}
) {
  const res = await fetch(`${frankBase}/sessions/${encodeURIComponent(sessionId)}/handoff/resume`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      ...(await authHeader()),
    },
    body: JSON.stringify({ from_stage: fromStage, snapshot, summary: "Approved Frank Create handoff for review." }),
    signal: opts.signal,
  });
  return consumeHandoffStream(res, opts);
}


export async function fetchSessionApprovalHistory(sessionId: string) {
  return fetchJson<{ events: Array<{ id: string; asset_id: string; prev_status: string | null; new_status: string; created_at: string; note?: string | null }> }>(
    `/sessions/${encodeURIComponent(sessionId)}/approval-history`
  );
}

export async function listTurns(sessionId?: string) {
  const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  return fetchJson<{ turns: StudioTurn[] }>(`/turns${query}`);
}



export async function createInferenceTurn(payload: TurnRequest) {
  return fetchJson<{
    turn: StudioTurn;
    status: "queued" | "running" | "blocked" | "failed" | "complete";
    assets?: Asset[];
    providerPayload?: Record<string, unknown>;
    localEngine?: "fallback" | "frank_renderer";
    fallbackReason?: string;
    error?: { code: string; env_vars?: string[]; message?: string; retryable?: boolean; status?: number; raw?: string; request_id?: string };
  }>("/inference/turn", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

// Long provider runs (4K upscales, agentic image models) outlive a single HTTP
// request, so /inference/turn can answer "running" with prediction ids. This
// polls the turn until the backend closes it out.
export async function fetchTurnStatus(turnId: string) {
  return fetchJson<{
    turn: StudioTurn;
    status: "running" | "failed" | "complete";
    assets?: Asset[];
    error?: { code?: string; message?: string; retryable?: boolean; request_id?: string };
  }>("/inference/status", {
    method: "POST",
    body: JSON.stringify({ turn_id: turnId })
  });
}


export async function createVideoStoryboard(payload: VideoRequest, opts: { signal?: AbortSignal } = {}) {
  return fetchJson<{
    turn: StudioTurn;
    status: "complete" | "failed" | "blocked";
    assets?: Asset[];
    providerPayload?: Record<string, unknown>;
    localEngine?: "storyboard" | string;
    error?: { code: string; env_vars?: string[]; message?: string };
  }>("/videos", {
    method: "POST",
    body: JSON.stringify(payload),
    signal: opts.signal,
  });
}

export async function createEnhancement(
  payload: {
    session_id?: string;
    model: string;
    source_asset_id?: string;
    source_url?: string;
    settings: EnhanceSettings & { media: "image" | "video" };
  },
  opts: { signal?: AbortSignal } = {}
) {
  return fetchJson<{
    turn: StudioTurn | null;
    status: "complete" | "failed" | "blocked";
    assets?: Asset[];
    providerPayload?: Record<string, unknown>;
    error?: { code: string; env_vars?: string[]; message?: string };
  }>("/enhance", {
    method: "POST",
    body: JSON.stringify(payload),
    signal: opts.signal,
  });
}




export async function createReference(payload: Record<string, unknown>) {
  return fetchJson<{ asset: Asset }>("/references", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function listAssets(filters: { sessionId?: string; turnId?: string; approvalStatus?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.sessionId) {
    params.set("session_id", filters.sessionId);
  }
  if (filters.turnId) {
    params.set("turn_id", filters.turnId);
  }
  if (filters.approvalStatus) {
    params.set("approval_status", filters.approvalStatus);
  }
  const query = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ assets: Asset[] }>(`/assets${query}`);
}

export async function updateAsset(assetId: string, payload: Partial<Asset>) {
  return fetchJson<{ asset: Asset }>(`/assets/${assetId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function deleteAsset(assetId: string) {
  return fetchJson<{ asset: Asset }>(`/assets/${assetId}`, {
    method: "DELETE"
  });
}

export async function deleteTurn(turnId: string) {
  return fetchJson<{ ok: boolean }>(`/turns/${encodeURIComponent(turnId)}`, {
    method: "DELETE"
  });
}






export function sessionReviewBoardUrl(sessionId: string) {
  return `${frankBase}/sessions/${encodeURIComponent(sessionId)}/review-board`;
}

export function sessionSyncManifestUrl(sessionId: string) {
  return `${frankBase}/sessions/${encodeURIComponent(sessionId)}/sync-manifest`;
}

export function assetDownloadUrl(assetId: string) {
  return `${frankBase}/assets/${encodeURIComponent(assetId)}/download`;
}





async function authHeader(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import("./supabaseClient");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}




/**
 * Upload a reference image to the private `studio-images` bucket and return a
 * long-lived signed URL. The URL is publicly fetchable (until expiry) so the
 * frank-generate edge function and downstream providers (Replicate, etc.) can
 * read the image directly.
 */
export async function uploadReferenceToStorage(
  file: File,
  sessionId: string
): Promise<{ url: string; path: string }> {
  const { supabase } = await import("./supabaseClient");
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) {
    throw new Error("Sign in required to upload references.");
  }
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = `${userId}/${sessionId}/references/${uniqueName}`;

  const { error: upErr } = await supabase.storage
    .from("studio-images")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
  if (upErr) {
    throw new Error(`Upload failed: ${upErr.message}`);
  }

  // 7-day signed URL is plenty for a single generation round.
  const { data: signed, error: signErr } = await supabase.storage
    .from("studio-images")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr || !signed?.signedUrl) {
    throw new Error(`Could not sign reference URL: ${signErr?.message || "unknown"}`);
  }
  return { url: signed.signedUrl, path };
}


async function fetchJson<T>(path: string, init: RequestInit = {}) {
  // The edge runtime occasionally answers 503 SUPABASE_EDGE_RUNTIME_SERVICE_DEGRADED
  // while a container is cycling — that cycle can last several seconds, so retry
  // with exponential backoff + jitter instead of giving up after ~1s.
  const maxAttempts = 5;
  const backoff = (attempt: number) =>
    Math.min(500 * 2 ** (attempt - 1), 4000) + Math.floor(Math.random() * 250);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${frankBase}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader()),
          ...init.headers
        }
      });
    } catch (err: any) {
      // A user-cancelled run must never be retried.
      if (err?.name === "AbortError" || (init.signal as AbortSignal | undefined)?.aborted) throw err;
      lastError = new Error(err?.message || "Network request failed");
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, backoff(attempt)));
        continue;
      }
      throw lastError;
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    const text = await response.text();
    const transient =
      response.status === 503 ||
      response.status === 502 ||
      response.status === 504 ||
      text.includes("SERVICE_DEGRADED");

    lastError = new Error(apiErrorMessage(text, response.status));
    if (transient && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, backoff(attempt)));
      continue;
    }
    throw lastError;
  }

  throw lastError ?? new Error("Frank Create API failed");
}



function apiErrorMessage(text: string, status: number) {
  if (!text) {
    return `Frank Create API failed (${status})`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message || text;
  } catch {
    return text;
  }
}


// ---- Prompt Generator agent config (admin editable) ----
export type PromptAgentSkillConfig = {
  key: string;
  label: string;
  hint: string;
  instruction: string;
  sort_order: number;
  is_active: boolean;
};

export type PromptAgentConfig = {
  persona: string;
  craftMethod: string;
  conversationProtocol: string;
  blueprint: string;
  rules: string;
  skills: PromptAgentSkillConfig[];
  updatedAt: string | null;
};


export async function fetchPromptAgentConfig() {
  return fetchJson<{ config: PromptAgentConfig; defaults: Omit<PromptAgentConfig, "updatedAt"> }>(
    "/prompt-agent/config"
  );
}

export async function savePromptAgentConfig(payload: Omit<PromptAgentConfig, "updatedAt">) {
  return fetchJson<{ config: PromptAgentConfig }>("/prompt-agent/config", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}
