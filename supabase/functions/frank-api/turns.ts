// How a round's settings_snapshot_json is written, and how a fan-out round
// (one worker per picture) closes.

// deno-lint-ignore no-explicit-any
type Snapshot = Record<string, any>;

export type ShardError = {
  index: number;
  code: string;
  message: string;
  retryable: boolean;
  status?: number | null;
};

/**
 * How long a fan-out round waits for a silent worker. It stays above the edge
 * function's own time limit: a worker can retry OpenRouter, then poll the
 * Replicate fallback for 180 s, so a shorter wait could close a round under a
 * healthy worker and offer a paid retry for a picture still on its way. Worker
 * errors no longer get lost, so a failed round closes at once without it.
 */
export const FANOUT_EXPIRY_MS = 8 * 60_000;

/** Recorded for each picture that never arrived and never reported an error. */
export const MISSING_PICTURE = {
  code: "worker_interrupted",
  message: "This picture never arrived. Retry it.",
  retryable: true,
} as const;

// The calls updateSnapshot makes, loose so tests can pass a fake.
// deno-lint-ignore no-explicit-any
export type SnapshotDb = { from(table: "messages"): any };

const MAX_TRIES = 8;

/**
 * Change a round's snapshot without losing a change made at the same moment.
 * The workers of one round finish together. Each used to read the snapshot
 * and write it back whole, so one worker's error could wipe another's: rounds
 * then closed "complete" one picture short with no reason, and a round whose
 * pictures all failed in a second waited out the timeout (4f9a37ba asked 2
 * and saved 1 error, f70bf7bf asked 5 and saved 4).
 *
 * Every write bumps `rev` and lands only if `rev` is still the one read;
 * otherwise the snapshot is read again and the change applied again. `change`
 * returns null to leave the snapshot as it is (for example, already closed).
 * Returns the snapshot as stored afterwards, or null when the round is gone.
 */
export async function updateSnapshot(
  db: SnapshotDb,
  turnId: string,
  change: (snap: Snapshot) => Snapshot | null,
): Promise<Snapshot | null> {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const { data, error } = await db.from("messages").select("settings_snapshot_json").eq("id", turnId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const snap: Snapshot = data.settings_snapshot_json ?? {};
    const next = change(snap);
    if (!next) return snap;
    const rev = Number(snap.rev) || 0;
    const stored = { ...next, rev: rev + 1 };
    let write = db.from("messages").update({ settings_snapshot_json: stored }).eq("id", turnId);
    write = rev
      ? write.eq("settings_snapshot_json->>rev", String(rev))
      : write.is("settings_snapshot_json->>rev", null);
    const { data: written, error: writeError } = await write.select("id");
    if (writeError) {
      // The guarded write itself was refused. Write as before rather than
      // leave the round unsaved: a rare lost error beats a stuck round.
      console.error("[frank-api] guarded snapshot write refused, writing plainly", turnId, writeError);
      const plain = await db.from("messages").update({ settings_snapshot_json: stored }).eq("id", turnId);
      if (plain.error) throw plain.error;
      return stored;
    }
    if (written?.length) return stored;
    // Someone wrote in between: wait a moment, read again, apply again.
    await new Promise((resolve) => setTimeout(resolve, 15 + Math.random() * 60 * (attempt + 1)));
  }
  throw new Error(`Round ${turnId} was busy; its update was not saved after ${MAX_TRIES} tries.`);
}

/**
 * A worker's own error that could not be saved. The shard route catches it and
 * tries once more with this error, instead of a generic one, so a picture
 * that cannot work is not offered as retryable.
 */
export class ShardErrorNotSaved extends Error {
  constructor(readonly shardError: ShardError, cause: unknown) {
    super(`Worker ${shardError.index} error not saved: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

/** The snapshot with one more worker error, keeping every error already there. */
export function withShardError(snap: Snapshot, error: ShardError): Snapshot {
  const errors: ShardError[] = Array.isArray(snap.shard_errors) ? snap.shard_errors : [];
  if (errors.some((e) => e.index === error.index)) return snap;
  return { ...snap, shard_errors: [...errors, error] };
}

/**
 * The snapshot that closes a running fan-out round, or null while it should
 * keep running. Every picture asked for is accounted for when it closes:
 * landed, failed with its own error, or, after the timeout, recorded as
 * missing. So a round never ends short without a reason, and the app offers
 * "Retry missing".
 */
export function closedFanout(
  snap: Snapshot,
  landedIds: string[],
  nowMs: number,
  createdAt?: string,
): Snapshot | null {
  if (snap.status !== "running" || !snap.fanout) return null;
  const requested = Math.max(Number(snap.requested_count) || 1, 1);
  const errors: ShardError[] = Array.isArray(snap.shard_errors) ? snap.shard_errors : [];
  const startedAt = new Date(snap.fanout_started_at || createdAt || "").getTime();
  const expired = Number.isFinite(startedAt) && nowMs - startedAt > FANOUT_EXPIRY_MS;
  const landed = landedIds.length;
  if (landed < requested && landed + errors.length < requested && !expired) return null;

  if (!landed) {
    const first = errors[0];
    return {
      ...snap,
      status: "failed",
      error: first?.message || "Every image in this round failed. Retry the run.",
      error_code: first?.code || MISSING_PICTURE.code,
      error_retryable: first?.retryable ?? true,
    };
  }
  const missing = Math.max(0, requested - landed - errors.length);
  const partial = [...errors, ...Array.from({ length: missing }, () => ({ ...MISSING_PICTURE }))];
  return {
    ...snap,
    status: "complete",
    output_asset_ids: landedIds,
    partial_errors: partial.length ? partial : undefined,
  };
}
