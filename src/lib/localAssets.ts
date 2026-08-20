import type { Asset } from "./types";

const KEY = "frank-create:local-assets:v1";
const MAX = 24;

export function loadLocalAssets(): Asset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Asset[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalAssets(assets: Asset[]): void {
  try {
    // Only persist assets that aren't synced to a backend yet, and only
    // those with an inline dataURL so they survive a refresh.
    const persistable = assets
      .filter((a) => a.sync_status === "local")
      .filter((a) => typeof a.preview_url === "string" && a.preview_url.startsWith("data:"))
      .slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(persistable));
  } catch {
    // Quota exceeded or storage disabled — best effort.
  }
}

export function clearLocalAssets(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
