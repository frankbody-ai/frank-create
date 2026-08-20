import React from 'react';
import { Icon } from '../media/Icon';

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

export interface ThemePickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Controlled theme id. Omit to let the component track its own selection. */
  value?: string;
  onChange?: (id: string) => void;
  themes?: ThemeDefinition[];
  columns?: number;
  /** Writes `data-theme` on <html> and remembers the choice under `as-theme`. */
  apply?: boolean;
}

export const OFFICIAL_THEMES: ThemeDefinition[] = [
  { id: 'ink', name: 'Ink', accent: '#303030', swatches: ['#F1F1F1', '#E3E3E3', '#616161', '#303030'], note: 'Default' },
  { id: 'marina', name: 'Marina', accent: '#326080', swatches: ['#FFF1E7', '#B5D2E6', '#326080', '#805232'] },
  { id: 'moondust', name: 'Moon dust', accent: '#80A8FF', swatches: ['#D3D3FF', '#CEB5FF', '#8EC1DE', '#80A8FF'] },
  { id: 'sapphire', name: 'Sapphire ash morning', accent: '#35627A', swatches: ['#35627A', '#E5AEA9', '#B46258', '#A6A9D0'] },
  { id: 'neptune', name: 'Neptune', accent: '#4AB5B5', swatches: ['#8FD9FB', '#4AB5B5', '#6D8BC0', '#525AFF'] },
  { id: 'amethyst', name: 'Amethyst mint harmony', accent: '#F650BD', swatches: ['#2A3F38', '#8DF688', '#562F54', '#F650BD'] },
  { id: 'opaline', name: 'Opaline', accent: '#FF634A', swatches: ['#F4F4F6', '#E7E7E7', '#D2D2D4', '#FF634A'] },
];

export const THEME_STORAGE_KEY = 'as-theme';

/** Writes `data-theme` on <html> and remembers the choice. Safe to call before React mounts. */
export function applyTheme(id?: string) {
  if (typeof document === 'undefined') return;
  if (!id || id === 'ink') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = id;
  try { window.localStorage.setItem(THEME_STORAGE_KEY, id || 'ink'); } catch { /* storage blocked */ }
}

/** Reads the remembered theme. Returns 'ink' when nothing is stored or storage is blocked. */
export function storedTheme(): string {
  try { return window.localStorage.getItem(THEME_STORAGE_KEY) || 'ink'; } catch { return 'ink'; }
}

export function ThemePicker({ value, onChange, themes, columns = 4, apply = true, className = '', style, ...rest }: ThemePickerProps) {
  const list = themes && themes.length ? themes : OFFICIAL_THEMES;
  const [internal, setInternal] = React.useState(() => (typeof document === 'undefined' ? 'ink' : (document.documentElement.dataset.theme || 'ink')));
  const selected = value != null ? value : internal;

  const pick = (id: string) => {
    if (value == null) setInternal(id);
    if (apply) applyTheme(id);
    if (onChange) onChange(id);
  };

  return (
    <div
      className={['as-themes', className].filter(Boolean).join(' ')}
      role="radiogroup"
      aria-label="Theme"
      style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`, ...style }}
      {...rest}
    >
      {list.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={t.id === selected}
          className={['as-theme', t.id === selected && 'is-selected'].filter(Boolean).join(' ')}
          onClick={() => pick(t.id)}
        >
          <span className="as-theme__field" data-theme={t.id === 'ink' ? undefined : t.id}>
            <span className="as-theme__chip">{t.accent}</span>
            {t.id === selected && <span className="as-theme__check"><Icon source="check" size={16} tone="inherit" /></span>}
          </span>
          <span className="as-theme__swatches">
            {t.swatches.map((c) => <span key={c} style={{ background: c }} />)}
          </span>
          <span className="as-theme__meta">
            <span className="as-theme__name">{t.name}</span>
            {t.note && <span className="as-theme__note">{t.note}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
