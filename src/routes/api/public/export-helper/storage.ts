// TEMPORARY migration endpoint — delete once the Studio -> core migration is done.
import { createFileRoute } from "@tanstack/react-router";
import { checkSecret, clampInt, json, listAllObjects } from "@/lib/exportHelper.server";

const ALLOWED_BUCKETS = ["studio-images", "feedback-screenshots"];
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 2;

export const Route = createFileRoute("/api/public/export-helper/storage")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = checkSecret(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const bucket = url.searchParams.get("bucket") ?? "studio-images";
        if (!ALLOWED_BUCKETS.includes(bucket)) {
          return json({ error: "Unknown bucket", allowed_buckets: ALLOWED_BUCKETS }, 400);
        }
        const limit = clampInt(url.searchParams.get("limit"), 200, 1, 500);
        const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          const all = await listAllObjects(supabaseAdmin, bucket);
          const page = all.slice(offset, offset + limit);

          const signed = page.length
            ? await supabaseAdmin.storage
                .from(bucket)
                .createSignedUrls(page.map((o) => o.path), SIGNED_URL_TTL_SECONDS)
            : { data: [], error: null };
          if (signed.error) throw signed.error;
          const urlByPath = new Map<string, string | null>(
            (signed.data ?? []).map((s) => [s.path ?? "", s.signedUrl ?? null]),
          );

          return json({
            bucket,
            limit,
            offset,
            count: page.length,
            total: all.length,
            hasMore: offset + page.length < all.length,
            signed_url_expires_in: SIGNED_URL_TTL_SECONDS,
            objects: page.map((o) => ({
              path: o.path,
              size: o.size,
              updated_at: o.updated_at,
              signed_url: urlByPath.get(o.path) ?? null,
            })),
          });
        } catch (err) {
          console.error("[export-helper/storage]", err);
          return json({ error: "Storage listing failed" }, 500);
        }
      },
    },
  },
});
