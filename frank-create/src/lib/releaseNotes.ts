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
    id: "2026-08-19-image-cost",
    date: "19 August 2026",
    title: "Image cost estimates",
    items: [
      "Image runs now show an estimated price based on model, size and number of copies.",
    ],
  },
  {
    id: "2026-08-19-preview-fix",
    date: "19 August 2026",
    title: "Preview and layout fixes",
    items: [
      "Clicking an image opens the full-screen preview again.",
      "On narrow screens the model settings now sit under the composer, above the rounds.",
    ],
  },


  {
    id: "2026-08-19-leaner-app",
    date: "19 August 2026",
    title: "Leaner, snappier studio",
    items: [
      "Trimmed unused code front and back, so pages render and respond faster.",
    ],
  },
  {
    id: "2026-08-19-speed-cleanup",
    date: "19 August 2026",
    title: "Faster start-up",
    items: [
      "Cut old demo-era code and extra start-up calls, so the studio loads quicker.",
    ],
  },

  {

    id: "2026-08-19-access-approval",
    date: "19 August 2026",
    title: "Approval-based access",
    items: [
      "Admins can hold or approve each person from Admin portal \u2192 Users.",
      "Approval is currently off, so allowed work domains still sign in straight away.",
    ],
  },
  {

    id: "2026-08-19-video-access-switch",
    date: "19 August 2026",
    title: "Video generation is now permission-based",
    items: [
      "Video mode is off by default and only an admin can switch it on.",
      "Admins toggle it per person in Admin portal \u2192 Users.",
    ],
  },
  {

    id: "2026-08-19-sessions-in-sidebar",
    date: "19 August 2026",
    title: "Sessions live in the sidebar",
    items: [
      "Switch, rename and archive sessions from the left menu.",
      "\u201cNew session\u201d starts with a clean run history.",
    ],
  },
  {
    id: "2026-08-19-inline-edit-upscaler",
    date: "19 August 2026",
    title: "Edit from the preview",
    items: [
      "Open an image full screen and edit it with the composer underneath.",
      "The prompt box clears after every Generate.",
      "Prompt Generator sends its reference images to Studio.",
      "Upscaler is back to one simple drop card.",
      "Brief Mix retired.",
    ],
  },
  {
    id: "2026-08-18-seedream-5",
    date: "18 August 2026",
    title: "Seedream 5.0 Pro",
    items: [
      "Seedream 4.5 replaced by Seedream 5.0 Pro.",
      "Tidier round cards and reference picker.",
      "This What\u2019s new banner \u2014 now cumulative, so nothing gets missed.",
    ],
  },
];

/** How many entries to replay when the stored marker no longer matches a release. */
const UNKNOWN_REPLAY_LIMIT = 5;

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
    // Unknown id (release removed or renamed): replay a short recent window so
    // nothing is silently skipped, without dumping the whole history.
    return index === -1 ? RELEASES.slice(0, UNKNOWN_REPLAY_LIMIT) : RELEASES.slice(0, index);
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
