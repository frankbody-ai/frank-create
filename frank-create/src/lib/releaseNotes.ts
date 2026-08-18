import { supabase } from "./supabaseClient";

export interface ReleaseNote {
  /** Stable, sortable id. Newest entry goes first in RELEASES. */
  id: string;
  date: string;
  title: string;
  items: string[];
}

/**
 * Curated release log. Add a new entry at the TOP whenever a substantial change
 * ships (model swaps, new tabs, reworked views). Everyone who has not seen the
 * newest entry gets a "What's new" modal on their next sign-in.
 */
export const RELEASES: ReleaseNote[] = [
  {
    id: "2026-08-18-seedream-5",
    date: "18 August 2026",
    title: "Seedream 5.0 Pro + a tidier studio",
    items: [
      "Seedream 4.5 is replaced by Seedream 5.0 Pro (ByteDance) — sharper editing control, more lifelike commercial scenes, same native multi-image batches. Older rounds keep their original model label.",
      "The central studio view is cleaned up: prompts on round cards are clamped to 25 words with an expand toggle, and the info column no longer crowds the imagery.",
      "Reference picker shows a full 10 tiles per page with no trailing gaps, and quick actions no longer flash in while a session loads.",
      "New: this What's new banner. Substantial changes will show up here the next time you sign in.",
    ],
  },
];

export const LATEST_RELEASE_ID = RELEASES[0]?.id ?? "";

/**
 * Releases the signed-in user has not acknowledged yet, newest first. Returns an
 * empty list when there is no session, when they are up to date, or when the
 * lookup fails — the banner is never worth blocking or spamming the studio for.
 */
export async function unseenReleases(): Promise<ReleaseNote[]> {
  if (!RELEASES.length) return [];
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return [];
    const { data, error } = await supabase
      .from("release_seen")
      .select("last_seen_release_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return [];
    const lastSeen = (data as { last_seen_release_id?: string } | null)?.last_seen_release_id ?? null;
    if (!lastSeen) return RELEASES;
    if (lastSeen === LATEST_RELEASE_ID) return [];
    const index = RELEASES.findIndex((release) => release.id === lastSeen);
    // Unknown id (release removed or renamed): only surface the newest entry
    // rather than replaying the whole history.
    return index === -1 ? RELEASES.slice(0, 1) : RELEASES.slice(0, index);
  } catch {
    return [];
  }
}

/** Marks every release up to and including the newest as read for this user. */
export async function markReleasesSeen(): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId || !LATEST_RELEASE_ID) return;
    await supabase
      .from("release_seen")
      .upsert({ user_id: userId, last_seen_release_id: LATEST_RELEASE_ID }, { onConflict: "user_id" });
  } catch {
    /* non-critical */
  }
}
