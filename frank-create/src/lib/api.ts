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
  PromptRemixVariant,
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


export async function fetchProviderStatus() {
  return fetchJson<ProviderReadiness>("/provider-status");
}

export async function fetchProviderAudit() {
  return fetchJson<ProviderAdapterAudit>("/provider-audit");
}

export async function fetchActivationChecklist() {
  return fetchJson<ActivationChecklist>("/activation-checklist");
}

export async function preflightProvider(payload: Record<string, unknown>) {
  return fetchJson<ProviderPreflight>("/provider-preflight", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchDemoDoctor() {
  return fetchJson<DemoDoctorStatus>("/demo-doctor");
}

export async function resetDemo(payload: { create_assets: boolean }) {
  return fetchJson<{
    project: Project;
    brief: Brief;
    session: StudioSession;
    turn: StudioTurn;
    reference: Asset | null;
    assets: Asset[];
    doctor: DemoDoctorStatus;
  }>("/demo/reset", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createDemoEvidence(payload: { base_url?: string } = {}) {
  return fetchJson<DemoEvidenceResult>("/demo/evidence", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createDemoCallBrief(payload: { base_url?: string } = {}) {
  return fetchJson<DemoCallBriefResult>("/demo/call-brief", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createDemoReadinessPack(payload: { base_url?: string } = {}) {
  return fetchJson<DemoReadinessPackResult>("/demo/readiness-pack", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createProviderReadinessReceipt() {
  return fetchJson<ProviderReadinessReceiptResult>("/demo/provider-readiness", { method: "POST" });
}

export async function remixPrompt(payload: { prompt: string; preset_key: string; frank_body_mode: boolean }) {
  return fetchJson<{ variants: PromptRemixVariant[] }>("/prompt-remix", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function improvePresetPrompt(payload: { prompt: string; label?: string; description?: string }) {
  return fetchJson<{ prompt: string }>("/improve-preset", {
    method: "POST",
    body: JSON.stringify(payload)
  });
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


export async function fetchBrandKit() {
  return fetchJson<{ brandKit: BrandKit; filePath: string }>("/brand-kit");
}

export async function updateBrandKit(payload: BrandKit) {
  return fetchJson<{ brandKit: BrandKit; filePath: string }>("/brand-kit", {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function createBrandContextReceipt(payload: { session_id?: string } = {}) {
  return fetchJson<BrandContextReceiptResult>("/demo/brand-context", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchProviderEnvStatus() {
  return fetchJson<ProviderEnvStatus>("/provider-env");
}

export async function createProviderEnvTemplate() {
  return fetchJson<ProviderEnvStatus>("/provider-env/template", { method: "POST" });
}

export async function reloadProviderEnv() {
  return fetchJson<ProviderEnvStatus>("/provider-env/reload", { method: "POST" });
}

export async function saveProviderEnvKeys(keys: Record<string, string>) {
  return fetchJson<ProviderEnvStatus>("/provider-env/save", {
    method: "POST",
    body: JSON.stringify({ keys })
  });
}

export async function listProjects() {
  return fetchJson<{ projects: Project[] }>("/projects");
}

export async function createProject(payload: Partial<Project> & { name: string }) {
  return fetchJson<{ project: Project }>("/projects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateProject(projectId: string, payload: Partial<Project>) {
  return fetchJson<{ project: Project }>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function listBriefs(projectId?: string) {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  return fetchJson<{ briefs: Brief[] }>(`/briefs${query}`);
}

export async function createBrief(payload: Record<string, unknown>) {
  return fetchJson<{ brief: Brief }>("/briefs", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateBrief(briefId: string, payload: Record<string, unknown>) {
  return fetchJson<{ brief: Brief }>(`/briefs/${briefId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function createRun(payload: Record<string, unknown>) {
  return fetchJson<{ run: Run }>("/runs", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateRun(runId: string, payload: Partial<Run>) {
  return fetchJson<{ run: Run }>(`/runs/${runId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function listRuns(briefId?: string) {
  const query = briefId ? `?brief_id=${encodeURIComponent(briefId)}` : "";
  return fetchJson<{ runs: Run[] }>(`/runs${query}`);
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

export async function createSessionHandoff(sessionId: string, opts: { signal?: AbortSignal } = {}) {
  return fetchJson<{ handoff: ExportRecord; download_url: string; metadata: Record<string, unknown> }>(
    `/sessions/${encodeURIComponent(sessionId)}/handoff`,
    {
      method: "POST",
      body: JSON.stringify({ summary: "Approved Frank Create handoff for review." }),
      signal: opts.signal,
    }
  );
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

export async function createTurn(payload: Partial<StudioTurn> & { session_id: string; model: string; prompt: string }) {
  return fetchJson<{ turn: StudioTurn }>("/turns", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateTurn(turnId: string, payload: Partial<StudioTurn>) {
  return fetchJson<{ turn: StudioTurn }>(`/turns/${turnId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
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



export async function createAsset(payload: Record<string, unknown>) {
  return fetchJson<{ asset: Asset }>("/assets", {
    method: "POST",
    body: JSON.stringify(payload)
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


export async function createExport(payload: Record<string, unknown>) {
  return fetchJson<{ export: ExportRecord; download_url?: string; metadata?: Record<string, unknown> }>("/exports", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function createAssetChannelSet(
  assetId: string,
  payload: { presets: string[]; metadata?: Record<string, unknown> }
) {
  return fetchJson<{ export: ExportRecord; download_url: string; metadata: Record<string, unknown> }>(
    `/assets/${encodeURIComponent(assetId)}/export-set`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function listExports(assetId?: string) {
  const query = assetId ? `?asset_id=${encodeURIComponent(assetId)}` : "";
  return fetchJson<{ exports: ExportRecord[] }>(`/exports${query}`);
}

export function exportDownloadUrl(exportId: string) {
  return `${frankBase}/exports/${encodeURIComponent(exportId)}/download`;
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

export function assetWorkflowReceiptUrl(assetId: string) {
  return `${frankBase}/assets/${encodeURIComponent(assetId)}/workflow`;
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
  const response = await fetch(`${frankBase}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(await authHeader()),
      ...init.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(apiErrorMessage(text, response.status));
  }

  return (await response.json()) as T;
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
