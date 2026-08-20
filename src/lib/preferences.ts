/**
 * Workspace preferences that belong to this browser rather than to a session.
 *
 * Run defaults are what the composer starts from before a model narrows them;
 * `normalizeStudioSettingsForModel` still has the last word, so a stored value
 * the selected model cannot honour is corrected rather than sent.
 *
 * Local only. There is no preferences table behind this, and the Settings
 * screen says so rather than implying the values follow the operator.
 */

const KEY = "frank-create.run-defaults";

export interface RunDefaults {
  model_id?: string;
  aspect_ratio?: string;
  image_size?: string;
  count?: number;
}

export function readRunDefaults(): RunDefaults {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const { model_id, aspect_ratio, image_size, count } = parsed as RunDefaults;
    return {
      model_id: typeof model_id === "string" ? model_id : undefined,
      aspect_ratio: typeof aspect_ratio === "string" ? aspect_ratio : undefined,
      image_size: typeof image_size === "string" ? image_size : undefined,
      count: typeof count === "number" && count > 0 ? count : undefined,
    };
  } catch {
    return {};
  }
}

export function writeRunDefaults(next: RunDefaults): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — defaults just don't persist */
  }
}

export function updateRunDefaults(patch: RunDefaults): RunDefaults {
  const next = { ...readRunDefaults(), ...patch };
  writeRunDefaults(next);
  return next;
}
