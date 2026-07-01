import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { buildManifest, HANDOFF_SCHEMA, HANDOFF_SCHEMA_VERSION, manifestToCsv, normaliseAsset, validateManifest } from "./handoff.ts";

const SID = "session-1";

const rawAssets = [
  {
    id: "a1", title: "Hero", media_type: "image", approval_status: "approved",
    model_key: "nano-banana-pro", prompt_snapshot: "a hero shot", message_id: "m1",
    session_id: SID, created_at: "2026-01-01T00:00:00Z", preview_url: "https://x/a1.png",
    storage_path: "u/a1.png",
    metadata_json: { blueprint: { id: "bp-1", name: "Studio", version: "1.0", preset_key: "studio", provider: "lovable" } },
  },
  {
    id: "a2", title: "Alt", media_type: "image", approval_status: "pending",
    prompt_snapshot: "alt", session_id: SID,
    metadata_json: { preset_key: "studio", provider: "lovable" },
  },
];

const rawTurns = [
  { id: "t1", seq: 1, role: "assistant", message_type: "generation", prompt_text: "Make hero", settings_snapshot_json: { seed: 1 }, created_at: "2026-01-01T00:00:00Z" },
];

Deno.test("normaliseAsset fills blueprint defaults", () => {
  const a = normaliseAsset(rawAssets[1] as any, SID);
  assertEquals(a.blueprint.id, null);
  assertEquals(a.blueprint.preset_key, "studio");
  assertEquals(a.blueprint.provider, "lovable");
  assertEquals(a.session_id, SID);
  assertEquals(a.approval_status, "pending");
});

Deno.test("buildManifest yields v1 schema envelope and correct counts", () => {
  const m = buildManifest(SID, { id: SID, title: "S" }, rawTurns as any, rawAssets as any, "test", "2026-01-01T00:00:00Z");
  assertEquals(m.schema, HANDOFF_SCHEMA);
  assertEquals(m.schema_version, HANDOFF_SCHEMA_VERSION);
  assertEquals(m.counts.assets, 2);
  assertEquals(m.counts.turns, 1);
  assertEquals(m.counts.approved, 1);
  // Both assets share preset_key "studio" — dedup produces 1 blueprint keyed by bp-1, plus one via preset_key.
  assert(m.counts.blueprints >= 1);
  assertEquals(m.assets.length, 2);
  assertEquals(m.approved[0].id, "a1");
});

Deno.test("validateManifest passes for a well-formed manifest", () => {
  const m = buildManifest(SID, null, rawTurns as any, rawAssets as any);
  assertEquals(validateManifest(m), []);
});

Deno.test("validateManifest reports missing required asset fields", () => {
  const m = buildManifest(SID, null, rawTurns as any, rawAssets as any);
  // Corrupt: remove blueprint on first asset.
  delete (m.assets[0] as any).blueprint;
  const issues = validateManifest(m);
  assert(issues.some((i) => i.includes("assets[0].blueprint missing")), `got: ${JSON.stringify(issues)}`);
});

Deno.test("validateManifest flags wrong schema/version", () => {
  const m = buildManifest(SID, null, rawTurns as any, rawAssets as any) as any;
  m.schema = "other";
  m.schema_version = 99;
  const issues = validateManifest(m);
  assert(issues.includes("schema mismatch"));
  assert(issues.includes("schema_version mismatch"));
});

Deno.test("manifestToCsv includes header and one row per asset", () => {
  const m = buildManifest(SID, null, rawTurns as any, rawAssets as any);
  const csv = manifestToCsv(m);
  const lines = csv.split("\n");
  assertEquals(lines.length, 1 + rawAssets.length);
  assertStringIncludes(lines[0], "asset_id");
  assertStringIncludes(lines[0], "blueprint_provider");
  assertStringIncludes(lines[1], "a1");
  assertStringIncludes(lines[1], "Hero");
});

Deno.test("manifestToCsv escapes quotes and newlines", () => {
  const assets = [{ ...rawAssets[0], title: 'Weird "quoted"\nline' }];
  const m = buildManifest(SID, null, [], assets as any);
  const csv = manifestToCsv(m);
  // The escaped title should collapse newline to space and double the quotes.
  assertStringIncludes(csv, '"Weird ""quoted"" line"');
});
