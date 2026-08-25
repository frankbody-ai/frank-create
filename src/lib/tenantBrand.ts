// Runtime company branding.
//
// One codebase, one deploy — the brand comes from configuration held in the
// AutoSolutions OS core, never from a fork of this app.
//
// How the company is resolved, in order:
//  1. ?tenant=<slug> — the hint the OS launcher puts on the link it opens.
//  2. the last resolved company, remembered in localStorage.
//  3. nothing: the app keeps its built-in Frank Body marks, exactly as before.
//
// The logo itself is read from the core with brand_for(slug), which exposes
// only public brand fields. This is presentation only: what a person may SEE
// or DO is decided by the core's RLS and entitlements, never by this hint.
//
// When Create Studio moves onto core auth, swap resolveSlug() for the core's
// my_brand() RPC — nothing else here changes.

const CORE_URL = "https://allzlfxbemhhhihdpxfv.supabase.co";
const CORE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsbHpsZnhiZW1oaGhpaGRweGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODE0ODksImV4cCI6MjEwMjY1NzQ4OX0.uGWNGg9onAFF88OZ6A_N3bacv805VLea1H_uKSH2LAI";

const STORAGE_KEY = "autosolutions.brand";

/** Mirrors the design system's CompanyId union (kept local so lib does not
    depend on ds; identical string unions stay assignable both ways). */
export type BrandCompanyId =
  | "alive"
  | "coreiq"
  | "enxgy"
  | "frankbody"
  | "ledgify"
  | "seniorsnouts"
  | "strengthlab";

/** Core tenant slug -> the design system's company id. */
const COMPANY_BY_SLUG: Record<string, BrandCompanyId> = {
  alive: "alive",
  coreiq: "coreiq",
  enxgy: "enxgy",
  "frank-body": "frankbody",
  frankbody: "frankbody",
  ledgify: "ledgify",
  "senior-snouts": "seniorsnouts",
  "strength-labs": "strengthlab",
};

export type TenantBrand = {
  slug: string;
  name: string;
  logoUrl: string | null;
  logoPlainUrl: string | null;
};

function readCache(): TenantBrand | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TenantBrand) : null;
  } catch {
    return null;
  }
}

function writeCache(brand: TenantBrand): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
  } catch {
    // Private browsing: branding just won't persist between visits.
  }
}

/** The company id the marks should use ('frankbody' when nothing is set). */
export function brandCompanyId(): BrandCompanyId {
  const brand = typeof window === "undefined" ? null : readCache();
  return (brand && COMPANY_BY_SLUG[brand.slug]) || "frankbody";
}

export function brandName(): string | null {
  const brand = typeof window === "undefined" ? null : readCache();
  return brand?.name ?? null;
}

function resolveSlug(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get("tenant");
  if (fromUrl) return fromUrl.trim().toLowerCase();
  return readCache()?.slug ?? null;
}

function apply(brand: TenantBrand): void {
  const root = document.documentElement;
  root.dataset["brand"] = brand.slug;
  if (brand.logoUrl) root.style.setProperty("--brand-company-logo", `url("${brand.logoUrl}")`);
  if (brand.logoPlainUrl) {
    root.style.setProperty("--brand-company-logo-plain", `url("${brand.logoPlainUrl}")`);
  }
}

async function fetchBrand(slug: string): Promise<TenantBrand | null> {
  const response = await fetch(`${CORE_URL}/rest/v1/rpc/brand_for`, {
    method: "POST",
    headers: {
      apikey: CORE_ANON_KEY,
      Authorization: `Bearer ${CORE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tenant_slug: slug }),
  });
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{
    slug: string;
    name: string;
    logo_url: string | null;
    logo_plain_url: string | null;
  }>;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return {
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    logoPlainUrl: row.logo_plain_url,
  };
}

/**
 * The signed-in person's acting company, straight from the core. This is the
 * authoritative source now that the studio runs on core auth — the ?tenant
 * hint is only used before a session exists (or if the call fails).
 */
async function fetchMyBrand(): Promise<TenantBrand | null> {
  const { os } = await import("./supabaseClient");
  const { data, error } = await os.rpc("my_brand");
  if (error) return null;
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) return null;
  return {
    slug: String(row["slug"] ?? ""),
    name: String(row["name"] ?? ""),
    logoUrl: (row["logo_url"] as string | null) ?? null,
    logoPlainUrl: (row["logo_plain_url"] as string | null) ?? null,
  };
}

/**
 * Paint the remembered brand immediately (no flash of the wrong logo), then
 * refresh it from the core in the background. Safe to call at module scope:
 * it no-ops on the server and never throws into the app.
 */
export function initTenantBrand(): void {
  if (typeof window === "undefined") return;

  const cached = readCache();
  if (cached) apply(cached);

  const settle = (brand: TenantBrand | null) => {
    if (!brand || !brand.slug) return;
    writeCache(brand);
    apply(brand);
  };

  // Once signed in, the company follows the person (the hub's workspace
  // switcher writes it), so ask the core rather than reading the URL.
  void (async () => {
    try {
      const { supabase } = await import("./supabaseClient");
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const mine = await fetchMyBrand();
        if (mine) return settle(mine);
      }
      const slug = resolveSlug();
      if (!slug) return;
      if (cached && cached.slug === slug && cached.logoUrl) return;
      settle(await fetchBrand(slug));
    } catch {
      // Offline or core unreachable: keep whatever is already painted.
    }
  })();
}
