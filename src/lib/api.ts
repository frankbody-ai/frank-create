import type {
  Asset,
  EnhanceSettings,
  FrankConfig,
  StudioSession,
  StudioTurn,
  TurnRequest,
  VideoRequest
} from "./types";


// The SPA talks to the `frank-api` edge function for generation and assets.
//
// Identity and data now live in the AutoSolutions OS core, but the function
// itself still runs on Lovable Cloud because that is where the AI gateway
// keys live. Its home is configuration, not a constant, so moving it to the
// core later is an environment change rather than a code change.
const FRANK_API_FALLBACK = "https://amwfmlqvaranonhyvqbj.supabase.co/functions/v1/frank-api";
const frankBase =
  (import.meta.env as Record<string, string | undefined>)["VITE_FRANK_API_BASE"] ?? FRANK_API_FALLBACK;

export type HealthStatus = {
  ok: boolean;
  product: string;
  store: string;
  degraded?: boolean;
  error?: string;
};

export async function fetchHealth(): Promise<HealthStatus> {
  try {
    return await fetchJson<HealthStatus>("/health", {}, { attempts: 6 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isTransientBackendError(message)) {
      return {
        ok: false,
        product: "frank-create",
        store: "degraded",
        degraded: true,
        error: "The studio backend is temporarily unavailable.",
      };
    }
    throw err;
  }
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

export async function listTurns(sessionId?: string) {
  const query = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  return fetchJson<{ turns: StudioTurn[] }>(`/turns${query}`);
}


export async function createInferenceTurn(payload: TurnRequest, opts: { signal?: AbortSignal } = {}) {
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
    body: JSON.stringify(payload),
    signal: opts.signal
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
    // Video renders outlive one request: the backend answers "running" with a
    // job handle and the client polls /inference/status until it closes out.
    status: "complete" | "failed" | "blocked" | "running";
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

export async function listAssets(filters: { sessionId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.sessionId) {
    params.set("session_id", filters.sessionId);
  }
  const query = params.size ? `?${params.toString()}` : "";
  return fetchJson<{ assets: Asset[] }>(`/assets${query}`);
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


async function authHeader(forceRefresh = false): Promise<Record<string, string>> {
  try {
    const { supabase } = await import("./supabaseClient");
    if (forceRefresh) {
      // A 401 means the token we just sent was stale (long-lived tab, laptop
      // sleep, a refresh that failed while offline). Mint a fresh one.
      await supabase.auth.refreshSession();
    }
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.access_token) return {};
    // Proactively refresh anything about to expire mid-request: long POSTs
    // (video submits) otherwise arrive with an already-dead token.
    const expiresAt = (session.expires_at ?? 0) * 1000;
    if (!forceRefresh && expiresAt && expiresAt - Date.now() < 60_000) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      const token = refreshed.session?.access_token;
      if (token) return { Authorization: `Bearer ${token}` };
    }
    return { Authorization: `Bearer ${session.access_token}` };
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


async function fetchJson<T>(path: string, init: RequestInit = {}, options: { attempts?: number } = {}) {
  // The edge runtime occasionally answers 503 SUPABASE_EDGE_RUNTIME_SERVICE_DEGRADED
  // while a container is cycling — that cycle can last several seconds, so retry
  // with exponential backoff + jitter instead of giving up after ~1s.
  const method = String(init.method || "GET").toUpperCase();
  // Never replay expensive AI mutations after a gateway timeout: the original
  // job may still be running and a replay creates duplicate billed work.
  const replaySafe = method === "GET" || path === "/inference/status";
  const maxAttempts = replaySafe ? options.attempts ?? 3 : 1;
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
      isTransientBackendError(text);

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
    const parsed = JSON.parse(text) as { code?: string; message?: string; error?: { message?: string } };
    return parsed.error?.message || parsed.message || parsed.code || text;
  } catch {
    return text;
  }
}

function isTransientBackendError(message: string) {
  return /SUPABASE_EDGE_RUNTIME_SERVICE_DEGRADED|SERVICE_DEGRADED|Service is temporarily unavailable|\b50[234]\b/i.test(message);
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
