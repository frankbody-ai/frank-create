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
    id: "2026-08-20-4k-batches",
    date: "20 August 2026",
    title: "4K batches, four at a time",
    items: [
      "Multi-image rounds now render each image in its own worker — 4 × 4K finishes in about 45 seconds instead of hanging.",
      "Large 4K files are saved permanently instead of falling back to a temporary link.",
      "A round that loses one image still delivers the rest rather than failing outright.",
    ],
  },
  {

    id: "2026-08-20-studio-speaks-up",
    date: "20 August 2026",
    title: "The studio tells you what happened",
    items: [
      "Errors and status messages are back on screen — no more clicking Generate and getting silence.",
      "Image runs have a Stop button again, and Generate is disabled while a round is running.",
      "When the backend is offline the studio says so and pauses runs, instead of quietly generating on a different model.",
      "Faster: the timeline no longer redraws while you type, and screens you aren't using no longer load up front.",
    ],
  },
  {
    id: "2026-08-20-claude-runtime",
    date: "20 August 2026",
    title: "Claude connection restored",
    items: ["Claude can now register and connect to the studio reliably."],
  },
  {
    id: "2026-08-20-claude-connector",
    date: "20 August 2026",
    title: "Claude connector fixed",
    items: ["Claude now connects through the studio’s supported MCP and sign-in routes."],
  },
  {
    id: "2026-08-19-generation-reliability",
    date: "19 August 2026",
    title: "More reliable generations",
    items: [
      "Studio and Prompt Generator now recover cleanly from provider interruptions without duplicate runs.",
    ],
  },
  {
    id: "2026-08-19-preview-arrows",
    date: "19 August 2026",
    title: "Preview arrows work again",
    items: [
      "You can step left/right through all picks from the same run in the full-screen preview.",
    ],
  },
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

/** Local mirror of the dismissal, so a failed backend write can't spam the modal. */
const LOCAL_SEEN_KEY = "frank-create:last-seen-release";

function readLocalSeen(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(LOCAL_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeLocalSeen(id: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(LOCAL_SEEN_KEY, id);
  } catch {
    /* private mode: the backend marker still carries it */
  }
}

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
    // The marker table is keyed by company + person in the core, so a person can
    // legitimately have more than one row: take the freshest instead of erroring.
    const { data, error } = await supabase
      .from("release_seen")
      .select("last_seen_release_id, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[releases] could not read the seen marker", error.message);
    }
    const remoteSeen =
      (data?.[0] as { last_seen_release_id?: string } | undefined)?.last_seen_release_id ?? null;
    const lastSeen = remoteSeen ?? readLocalSeen();
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

/**
 * Marks every release up to and including the newest as read for this user.
 * Writes the device mirror first so the modal stays dismissed even if the
 * backend write fails, then updates the person's existing marker row (the core
 * keys it by company + person, so a blind upsert on `user_id` alone is rejected).
 */
export async function markReleasesSeen(): Promise<void> {
  if (!LATEST_RELEASE_ID) return;
  writeLocalSeen(LATEST_RELEASE_ID);
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    const { data: updated, error: updateError } = await supabase
      .from("release_seen")
      .update({ last_seen_release_id: LATEST_RELEASE_ID, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select("user_id");
    if (updateError) {
      // eslint-disable-next-line no-console
      console.warn("[releases] could not save the seen marker", updateError.message);
      return;
    }
    if (updated && updated.length) return;
    const { error: insertError } = await supabase
      .from("release_seen")
      .insert({ user_id: userId, last_seen_release_id: LATEST_RELEASE_ID });
    if (insertError) {
      // eslint-disable-next-line no-console
      console.warn("[releases] could not create the seen marker", insertError.message);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[releases] marker write failed", err);
  }
}

