export interface ThemeDefinition {
  /** Matches the `[data-theme="…"]` scope in tokens/themes.css. 'ink' is the default (no attribute). */
  id: string;
  name: string;
  /** Accent hex, shown as the chip label. */
  accent: string;
  /** The four foundation colours, in order. */
  swatches: string[];
  note?: string;
}

/** The seven palettes shipped with AutoSolutions OS. */
export const OFFICIAL_THEMES: ThemeDefinition[];

/** Applies a theme to the document root and remembers it for future visits. */
export function applyTheme(id: string): void;

/**
 * @startingPoint section="Settings" subtitle="Seven-theme picker for a tenant settings screen" viewport="700x300"
 */
export interface ThemePickerProps {
  /** Controlled theme id. Omit to let the component track its own selection. */
  value?: string;
  onChange?: (id: string) => void;
  /** Defaults to the seven official themes: ink, marina, moondust, sapphire, neptune, amethyst, opaline. */
  themes?: ThemeDefinition[];
  columns?: number;
  /** Writes `data-theme` on <html> and remembers the choice in localStorage under `as-theme`. Set false for a preview-only picker. */
  apply?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ThemePicker(props: ThemePickerProps): JSX.Element;
