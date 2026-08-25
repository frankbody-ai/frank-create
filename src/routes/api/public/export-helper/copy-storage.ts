// TEMPORARY migration endpoint — delete once the Studio -> core migration is done.
// Pushes storage objects from this project into the destination (core) project,
// preserving bucket name and object path. Never logs or returns any credential.
import { createFileRoute } from "@tanstack/react-router";
import { checkSecret, clampInt, json, listAllObjects } from "@/lib/exportHelper.server";

const ALLOWED_BUCKETS = ["studio-images", "feedback-screenshots"];

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export const Route = createFileRoute("/api/public/export-helper/copy-storage")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = checkSecret(request);
        if (denied) return denied;

        const srcUrl = process.env["SUPABASE_URL"];
        const srcKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        const dstUrl = process.env["CORE_SUPABASE_URL"];
        const dstKey = process.env["CORE_SUPABASE_SERVICE_ROLE_KEY"];
        if (!srcUrl || !srcKey || !dstUrl || !dstKey) {
          return json({ error: "Copy helper is not configured" }, 503);
        }

        const url = new URL(request.url);
        const bucket = url.searchParams.get("bucket") ?? "studio-images";
        if (!ALLOWED_BUCKETS.includes(bucket)) {
          return json({ error: "Unknown bucket", allowed_buckets: ALLOWED_BUCKETS }, 400);
        }
        const limit = clampInt(url.searchParams.get("limit"), 100, 1, 500);
        const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

        const srcHeaders = { Authorization: `Bearer ${srcKey}`, apikey: srcKey };
        const dstHeaders = { Authorization: `Bearer ${dstKey}`, apikey: dstKey };

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const all = await listAllObjects(supabaseAdmin, bucket);
          const page = all.slice(offset, offset + limit);

          // Make sure the destination bucket exists (ignore "already exists").
          const created = await fetch(`${dstUrl.replace(/\/$/, "")}/storage/v1/bucket`, {
            method: "POST",
            headers: { ...dstHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ id: bucket, name: bucket, public: false }),
          });
          if (!created.ok && created.status !== 400 && created.status !== 409) {
            return json({ error: `Destination bucket check failed (${created.status})` }, 502);
          }

          let copied = 0;
          let skipped = 0;
          const failures: { path: string; status: number; stage: string }[] = [];

          for (const obj of page) {
            const encoded = encodePath(obj.path);
            try {
              // Skip when the destination already has it at the same size.
              const info = await fetch(
                `${dstUrl.replace(/\/$/, "")}/storage/v1/object/info/authenticated/${bucket}/${encoded}`,
                { headers: dstHeaders },
              );
              if (info.ok) {
                const meta = (await info.json()) as { size?: number };
                if (obj.size != null && meta.size === obj.size) {
                  skipped += 1;
                  continue;
                }
              }

              const download = await fetch(
                `${srcUrl.replace(/\/$/, "")}/storage/v1/object/authenticated/${bucket}/${encoded}`,
                { headers: srcHeaders },
              );
              if (!download.ok || !download.body) {
                failures.push({ path: obj.path, status: download.status, stage: "download" });
                continue;
              }

              const contentType =
                download.headers.get("content-type") ?? "application/octet-stream";
              const length = download.headers.get("content-length");
              const uploadHeaders: Record<string, string> = {
                ...dstHeaders,
                "Content-Type": contentType,
                "x-upsert": "true",
              };
              if (length) uploadHeaders["Content-Length"] = length;

              const upload = await fetch(
                `${dstUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${encoded}`,
                {
                  method: "POST",
                  headers: uploadHeaders,
                  body: download.body,
                  // @ts-expect-error duplex is required for streaming request bodies
                  duplex: "half",
                },
              );
              if (!upload.ok) {
                failures.push({ path: obj.path, status: upload.status, stage: "upload" });
                continue;
              }
              copied += 1;
            } catch {
              failures.push({ path: obj.path, status: 0, stage: "exception" });
            }
          }

          const nextOffset = offset + page.length;
          return json({
            bucket,
            copied,
            skipped,
            failed: failures.length,
            failures: failures.slice(0, 20),
            nextOffset,
            total: all.length,
            hasMore: nextOffset < all.length,
          });
        } catch (err) {
          console.error("[export-helper/copy-storage]", err);
          return json({ error: "Storage copy failed" }, 500);
        }
      },
    },
  },
});
