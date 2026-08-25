// TEMPORARY migration endpoint — delete once the Studio -> core migration is done.
import { createFileRoute } from "@tanstack/react-router";
import {
  ALLOWED_TABLES,
  buildEmailMap,
  checkSecret,
  clampInt,
  json,
} from "@/lib/exportHelper.server";

export const Route = createFileRoute("/api/public/export-helper/tables")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = checkSecret(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const table = url.searchParams.get("table") ?? "";
        const config = Object.prototype.hasOwnProperty.call(ALLOWED_TABLES, table)
          ? ALLOWED_TABLES[table]
          : undefined;
        if (!config) {
          return json(
            { error: "Unknown table", allowed_tables: Object.keys(ALLOWED_TABLES) },
            400,
          );
        }

        const since = url.searchParams.get("since");
        if (since && Number.isNaN(Date.parse(since))) {
          return json({ error: "since must be an ISO timestamp" }, 400);
        }
        const limit = clampInt(url.searchParams.get("limit"), 500, 1, 1000);
        const offset = clampInt(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          let query = supabaseAdmin
            .from(table as never)
            .select("*", { count: "exact" })
            .order(config.pk, { ascending: true })
            .range(offset, offset + limit - 1);

          if (since) {
            query = query.or(config.timeCols.map((c) => `${c}.gte.${since}`).join(","));
          }

          const { data, error, count } = await query;
          if (error) throw error;

          let rows = (data ?? []) as Record<string, unknown>[];
          if (config.userCol) {
            const emails = await buildEmailMap(supabaseAdmin);
            rows = rows.map((row) => ({
              ...row,
              user_email: emails.get(String(row[config.userCol!] ?? "")) ?? null,
            }));
          }

          const total = count ?? offset + rows.length;
          return json({
            table,
            since: since ?? null,
            limit,
            offset,
            count: rows.length,
            total,
            hasMore: offset + rows.length < total,
            rows,
          });
        } catch (err) {
          console.error("[export-helper/tables]", err);
          return json({ error: "Export query failed" }, 500);
        }
      },
    },
  },
});
