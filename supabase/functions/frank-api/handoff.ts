// Handoff manifest builder + schema validator + CSV serializer.
// Pure functions so they can be unit-tested with Deno.test.

export type ManifestAssetInput = {
  id: string | null;
  title?: string | null;
  media_type?: string | null;
  approval_status?: string | null;
  model_key?: string | null;
  prompt_snapshot?: string | null;
  message_id?: string | null;
  session_id?: string | null;
  created_at?: string | null;
  preview_url?: string | null;
  storage_path?: string | null;
  metadata_json?: Record<string, unknown> | null;
};

export type ManifestTurnInput = {
  id: string;
  seq?: number | null;
  role?: string | null;
  message_type?: string | null;
  prompt_text?: string | null;
  settings_snapshot_json?: Record<string, unknown> | null;
  created_at?: string | null;
};

export const HANDOFF_SCHEMA = "frank-create.handoff";
export const HANDOFF_SCHEMA_VERSION = 1;

export function normaliseAsset(a: ManifestAssetInput, fallbackSessionId: string) {
  const meta = (a.metadata_json && typeof a.metadata_json === "object") ? a.metadata_json as Record<string, any> : {};
  const blueprint = (meta.blueprint || meta.workflow || {}) as Record<string, any>;
  return {
    id: a.id ?? null,
    title: a.title ?? "",
    media_type: a.media_type ?? "image",
    approval_status: a.approval_status ?? "pending",
    model_key: a.model_key ?? null,
    prompt: a.prompt_snapshot ?? "",
    message_id: a.message_id ?? null,
    session_id: a.session_id ?? fallbackSessionId,
    created_at: a.created_at ?? null,
    download_url: a.preview_url ?? null,
    storage_path: a.storage_path ?? null,
    blueprint: {
      id: blueprint.id ?? blueprint.blueprint_id ?? null,
      name: blueprint.name ?? blueprint.label ?? null,
      version: blueprint.version ?? null,
      workflow_id: blueprint.workflow_id ?? null,
      preset_key: blueprint.preset_key ?? meta.preset_key ?? null,
      provider: blueprint.provider ?? meta.provider ?? null,
      settings: blueprint.settings ?? meta.settings ?? {},
    },
    metadata: meta,
  };
}

export function buildManifest(
  sid: string,
  sessionRow: Record<string, unknown> | null,
  turnRows: ManifestTurnInput[],
  assetRows: ManifestAssetInput[],
  summary = "",
  generatedAt = new Date().toISOString(),
) {
  const assets = assetRows.map((a) => normaliseAsset(a, sid));
  const turns = turnRows.map((t) => ({
    id: t.id,
    seq: t.seq ?? null,
    role: t.role ?? null,
    message_type: t.message_type ?? null,
    prompt: t.prompt_text ?? "",
    settings: t.settings_snapshot_json ?? {},
    created_at: t.created_at ?? null,
  }));

  const blueprintIndex: Record<string, any> = {};
  for (const a of assets) {
    const bp = a.blueprint;
    const key = bp.id || bp.workflow_id || bp.preset_key || bp.name;
    if (key && !blueprintIndex[key]) blueprintIndex[key] = bp;
  }
  const blueprints = Object.values(blueprintIndex);
  const approved = assets.filter((a) => a.approval_status === "approved");

  return {
    schema: HANDOFF_SCHEMA,
    schema_version: HANDOFF_SCHEMA_VERSION,
    generated_at: generatedAt,
    session: sessionRow || { id: sid },
    summary,
    counts: {
      turns: turns.length,
      assets: assets.length,
      approved: approved.length,
      blueprints: blueprints.length,
    },
    turns,
    assets,
    approved,
    blueprints,
  };
}

export function validateManifest(m: any): string[] {
  const issues: string[] = [];
  if (!m || typeof m !== "object") { issues.push("manifest missing"); return issues; }
  if (m.schema !== HANDOFF_SCHEMA) issues.push("schema mismatch");
  if (m.schema_version !== HANDOFF_SCHEMA_VERSION) issues.push("schema_version mismatch");
  if (!Array.isArray(m.assets)) issues.push("assets not array");
  if (!Array.isArray(m.turns)) issues.push("turns not array");
  if (!Array.isArray(m.blueprints)) issues.push("blueprints not array");
  if (!m.counts || typeof m.counts !== "object") issues.push("counts missing");
  const req = ["id", "title", "media_type", "approval_status", "blueprint"];
  (m.assets || []).forEach((a: any, i: number) => {
    for (const f of req) if (!(f in a)) issues.push(`assets[${i}].${f} missing`);
    if (a.blueprint && typeof a.blueprint !== "object") issues.push(`assets[${i}].blueprint wrong type`);
    if (a.blueprint) {
      for (const bf of ["id", "name", "version", "preset_key", "provider"]) {
        if (!(bf in a.blueprint)) issues.push(`assets[${i}].blueprint.${bf} missing`);
      }
    }
  });
  (m.turns || []).forEach((t: any, i: number) => {
    if (!("id" in t) || !("prompt" in t)) issues.push(`turns[${i}] missing id/prompt`);
  });
  return issues;
}

const CSV_HEADER = [
  "asset_id", "title", "media_type", "approval_status", "model", "prompt",
  "message_id", "session_id", "created_at", "download_url",
  "blueprint_id", "blueprint_name", "blueprint_version", "blueprint_preset", "blueprint_provider",
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export function manifestToCsv(m: ReturnType<typeof buildManifest>): string {
  return [
    CSV_HEADER.join(","),
    ...m.assets.map((a) => [
      a.id, a.title, a.media_type, a.approval_status, a.model_key, a.prompt,
      a.message_id, a.session_id, a.created_at, a.download_url,
      a.blueprint.id, a.blueprint.name, a.blueprint.version, a.blueprint.preset_key, a.blueprint.provider,
    ].map(csvEscape).join(",")),
  ].join("\n");
}
