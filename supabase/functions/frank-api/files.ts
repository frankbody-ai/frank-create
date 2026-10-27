// Picture files can be shared between asset rows. A reference made from a pick
// points at the pick's own file (POST /references copies the path, not the
// bytes), so removing either row must leave the file for the other. Removing a
// reference from the dock used to delete the file and blank the original pick
// for good. On 27 Oct 2026, 40 references shared a pick's file and 12 picks
// had no file left.

export const PICTURE_BUCKET = "studio-images";

// The two calls this module makes, so tests can pass a fake.
export type FilesDb = {
  from(table: "assets"): {
    select(columns: "storage_path"): {
      in(column: "storage_path", values: string[]): PromiseLike<{ data: { storage_path: string }[] | null; error: unknown }>;
    };
  };
  storage: { from(bucket: string): { remove(paths: string[]): PromiseLike<unknown> } };
};

/** The paths that no asset row uses any more. When the check fails: none, so the files stay. */
export async function unusedPaths(sb: FilesDb, paths: string[]): Promise<string[]> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return [];
  const { data, error } = await sb.from("assets").select("storage_path").in("storage_path", unique);
  if (error) return [];
  const used = new Set((data ?? []).map((row) => row.storage_path));
  return unique.filter((path) => !used.has(path));
}

/**
 * Call after the rows are deleted: removes only the files nothing points at.
 * Best effort; a file left behind costs a little storage, a wrong removal
 * loses a picture.
 */
export async function removeUnusedFiles(sb: FilesDb, paths: string[]): Promise<void> {
  const unused = await unusedPaths(sb, paths);
  if (!unused.length) return;
  try {
    await sb.storage.from(PICTURE_BUCKET).remove(unused);
  } catch (_) {
    /* a leftover file is harmless */
  }
}
