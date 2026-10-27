import { assertEquals } from "jsr:@std/assert@1";
import { closedFanout, FANOUT_EXPIRY_MS, MISSING_PICTURE, type SnapshotDb, updateSnapshot, withShardError } from "./turns.ts";

// One messages row, with the filters updateSnapshot uses. Every call yields
// first, so concurrent updates read the same snapshot, as workers do.
function fakeRow(initial: Record<string, unknown>, opts: { refuseGuard?: boolean } = {}) {
  const row = { snap: structuredClone(initial) };
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const db: SnapshotDb = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => (await tick(), { data: { settings_snapshot_json: structuredClone(row.snap) }, error: null }) }),
      }),
      update: (value: { settings_snapshot_json: Record<string, unknown> }) => {
        const filters: Array<(snap: Record<string, unknown>) => boolean> = [];
        const write = {
          eq: (column: string, expected: string) => {
            if (column === "settings_snapshot_json->>rev") filters.push((snap) => String(snap.rev) === expected);
            return write;
          },
          is: (_column: string, _value: null) => (filters.push((snap) => snap.rev === undefined || snap.rev === null), write),
          then: (resolve: (value: { error: null }) => void) => {
            // A plain, unguarded write (the fallback).
            row.snap = structuredClone(value.settings_snapshot_json);
            resolve({ error: null });
          },
          select: async () => {
            if (opts.refuseGuard) return { data: null, error: new Error("guard refused") };
            await tick();
            if (!filters.every((ok) => ok(row.snap))) return { data: [], error: null };
            row.snap = structuredClone(value.settings_snapshot_json);
            return { data: [{ id: "t" }], error: null };
          },
        };
        return write;
      },
    }),
  };
  return { db, row };
}

const shardError = (index: number) => ({ index, code: "invalid_params", message: "bad", retryable: false });

Deno.test("4 workers failing at once all keep their error", async () => {
  const { db, row } = fakeRow({ status: "running", fanout: true, requested_count: 4 });
  await Promise.all([0, 1, 2, 3].map((i) => updateSnapshot(db, "t", (snap) => withShardError(snap, shardError(i)))));
  assertEquals((row.snap.shard_errors as unknown[]).length, 4);
  assertEquals(row.snap.rev, 4);
});

Deno.test("a success written at the same time does not wipe an error", async () => {
  const { db, row } = fakeRow({ status: "running", fanout: true, requested_count: 2, rev: 3 });
  await Promise.all([
    updateSnapshot(db, "t", (snap) => withShardError(snap, shardError(0))),
    updateSnapshot(db, "t", (snap) => ({ ...snap, last_shard_at: "now" })),
  ]);
  assertEquals((row.snap.shard_errors as unknown[]).length, 1);
  assertEquals(row.snap.last_shard_at, "now");
});

Deno.test("if the guarded write is refused, the change is still saved", async () => {
  const { db, row } = fakeRow({ status: "running", rev: 1 }, { refuseGuard: true });
  await updateSnapshot(db, "t", (snap) => ({ ...snap, status: "complete" }));
  assertEquals(row.snap.status, "complete");
  assertEquals(row.snap.rev, 2);
});

Deno.test("a change that returns null writes nothing", async () => {
  const { db, row } = fakeRow({ status: "complete", rev: 2 });
  const after = await updateSnapshot(db, "t", () => null);
  assertEquals(after?.status, "complete");
  assertEquals(row.snap.rev, 2);
});

const start = "2026-10-27T00:00:00.000Z";
const t0 = new Date(start).getTime();
const running = (extra: Record<string, unknown> = {}) => ({ status: "running", fanout: true, requested_count: 4, fanout_started_at: start, ...extra });

Deno.test("a round keeps running while pictures are still due", () => {
  assertEquals(closedFanout(running(), ["a", "b", "c"], t0 + 60_000), null);
});

Deno.test("3 landed and 1 error: complete, with that error", () => {
  const closed = closedFanout(running({ shard_errors: [shardError(3)] }), ["a", "b", "c"], t0 + 60_000);
  assertEquals(closed?.status, "complete");
  assertEquals(closed?.partial_errors, [shardError(3)]);
});

Deno.test("after the timeout, a silent picture is recorded as missing and retryable", () => {
  const closed = closedFanout(running(), ["a", "b", "c"], t0 + FANOUT_EXPIRY_MS + 1);
  assertEquals(closed?.status, "complete");
  assertEquals(closed?.output_asset_ids, ["a", "b", "c"]);
  assertEquals(closed?.partial_errors, [MISSING_PICTURE]);
});

Deno.test("every picture failed: the round fails at once with the first error", () => {
  const closed = closedFanout(running({ shard_errors: [0, 1, 2, 3].map(shardError) }), [], t0 + 5_000);
  assertEquals(closed?.status, "failed");
  assertEquals(closed?.error, "bad");
});

Deno.test("an already closed round is left alone", () => {
  assertEquals(closedFanout({ ...running(), status: "complete" }, ["a"], t0 + FANOUT_EXPIRY_MS * 2), null);
});

Deno.test("the same worker's error is kept once", () => {
  const snap = withShardError(withShardError({}, shardError(1)), shardError(1));
  assertEquals((snap.shard_errors as unknown[]).length, 1);
});
