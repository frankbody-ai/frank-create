import type { Asset, StudioTurn } from "./types";

/**
 * Merging a session's history into what is already on screen.
 *
 * History now loads after the composer is ready, so a run started during that
 * wait can land before the old rounds do. Replacing the list would drop it;
 * merging by id keeps both. The server copy wins for an id it knows, because it
 * carries the latest status.
 */

function createdMs(value: string | undefined | null) {
  const ms = value ? new Date(value).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

/** Rounds by id, oldest first (the thread reverses them for display). */
export function mergeTurns(current: StudioTurn[], incoming: StudioTurn[]): StudioTurn[] {
  const byId = new Map(current.map((turn) => [turn.id, turn]));
  for (const turn of incoming) byId.set(turn.id, turn);
  return Array.from(byId.values()).sort((a, b) => createdMs(a.created_at) - createdMs(b.created_at));
}

/** Assets by id, newest first. */
export function mergeAssetList(current: Asset[], incoming: Asset[]): Asset[] {
  const byId = new Map(current.map((asset) => [asset.id, asset]));
  for (const asset of incoming) byId.set(asset.id, asset);
  return Array.from(byId.values()).sort((a, b) => createdMs(b.created_at) - createdMs(a.created_at));
}

/**
 * What a press of Generate should do, given what the studio knows so far.
 *
 * - "empty": there is no prompt to send.
 * - "wait": the prompt is fine but the studio has not finished connecting yet,
 *   so the run waits and starts by itself when it can.
 * - "run": send it now.
 *
 * Before this existed, a press during start-up said "give the studio a prompt
 * first" although the prompt was there: the real gap was the missing session.
 */
export type GenerateGate = "empty" | "wait" | "run";

export function generateGate(input: {
  prompt: string;
  connection: "checking" | "online" | "offline";
  hasSession: boolean;
}): GenerateGate {
  if (!input.prompt.trim()) return "empty";
  if (input.connection === "checking" || !input.hasSession) return "wait";
  return "run";
}

/** Outputs a finished round should show once its assets arrive, for the loading skeletons. */
export function expectedOutputCount(turn: StudioTurn, fallback: number): number {
  if (turn.status === "failed" || turn.status === "blocked") return 0;
  let ids: unknown = [];
  try {
    ids = JSON.parse(turn.output_asset_ids_json || "[]");
  } catch {
    ids = [];
  }
  const listed = Array.isArray(ids) ? ids.length : 0;
  return Math.min(24, listed || fallback);
}

// The session the studio opened on last time. Its history can start loading
// while the session list is still on its way, instead of after it.
const LAST_LAUNCH_SESSION_KEY = "frank.lastLaunchSessionId";

export function readLastLaunchSessionId(): string | null {
  try {
    return window.localStorage.getItem(LAST_LAUNCH_SESSION_KEY);
  } catch {
    return null;
  }
}

export function writeLastLaunchSessionId(sessionId: string) {
  try {
    window.localStorage.setItem(LAST_LAUNCH_SESSION_KEY, sessionId);
  } catch {
    /* private mode: the next launch just loads in order */
  }
}
