import { assertEquals } from "jsr:@std/assert@1";
import { type FilesDb, removeUnusedFiles, unusedPaths } from "./files.ts";

// A fake with the asset rows left after a delete, recording what storage removes.
function fakeDb(remainingPaths: string[], opts: { failCheck?: boolean } = {}) {
  const removed: string[][] = [];
  const db: FilesDb = {
    from: () => ({
      select: () => ({
        in: (_column, values) =>
          Promise.resolve(
            opts.failCheck
              ? { data: null, error: new Error("network") }
              : { data: remainingPaths.filter((p) => values.includes(p)).map((storage_path) => ({ storage_path })), error: null },
          ),
      }),
    }),
    storage: { from: () => ({ remove: (paths: string[]) => (removed.push(paths), Promise.resolve({})) }) },
  };
  return { db, removed };
}

Deno.test("a file another row still uses stays; an unused one goes", async () => {
  // The pick still points at pick.png after its reference row was deleted.
  const { db, removed } = fakeDb(["u/s/pick.png"]);
  await removeUnusedFiles(db, ["u/s/pick.png", "u/s/upload.png"]);
  assertEquals(removed, [["u/s/upload.png"]]);
});

Deno.test("when the check fails, nothing is removed", async () => {
  const { db, removed } = fakeDb([], { failCheck: true });
  await removeUnusedFiles(db, ["u/s/a.png"]);
  assertEquals(removed, []);
});

Deno.test("empty and repeated paths are handled once", async () => {
  const { db } = fakeDb([]);
  assertEquals(await unusedPaths(db, ["", "u/s/a.png", "u/s/a.png"]), ["u/s/a.png"]);
  assertEquals(await unusedPaths(db, ["", ""]), []);
});
