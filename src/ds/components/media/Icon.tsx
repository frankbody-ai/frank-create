import React from 'react';

/*
 * PORT NOTE — diverges from the shipped `Icon.jsx` on purpose.
 * The shipped component fetches each SVG at runtime from `window.AS_ICON_BASE`.
 * Vite can inline the whole set at build time instead, which removes the network
 * waterfall and the first-paint icon flash. The size/tone/currentColor contract
 * and the ICONS_16 fallback set below are unchanged from the source.
 */

/*
 * The glob is relative to THIS file (src/ds/components/media/), so the set
 * lives two levels up at src/ds/icons. `import.meta.glob` returns {} for a
 * pattern that matches nothing rather than failing, which is how a wrong path
 * here once shipped every icon as an empty box — hence the guard below and
 * the Icon.test.tsx that asserts the set is populated.
 */
const RAW = import.meta.glob('../../icons/**/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const SETS: Record<number, Record<string, string>> = { 16: {}, 20: {} };
for (const path in RAW) {
  const m = /\/icons\/(16|20)\/(.+)\.svg$/.exec(path);
  if (m) SETS[Number(m[1])][m[2]] = RAW[path];
}

if (!Object.keys(SETS[20]).length) {
  throw new Error(
    '[ds] the icon set is empty — the glob in Icon.tsx matched no files. ' +
      'Check that src/ds/icons/{16,20}/*.svg exist and that the glob is relative to this file.',
  );
}

/** Every icon name the build inlined, both sizes merged. Used by the tests. */
export const ICON_NAMES: string[] = Array.from(
  new Set([...Object.keys(SETS[20]), ...Object.keys(SETS[16])]),
).sort();

export type IconTone = 'base' | 'secondary' | 'hover' | 'active' | 'disabled' | 'inverse'
  | 'success' | 'critical' | 'warning' | 'caution' | 'info' | 'highlight' | 'ai' | 'inherit';

export interface IconProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Icon name, e.g. 'bolt'. */
  source: string;
  /** 20 for the vast majority; 16 inside buttons, badges, inputs and dense tables. */
  size?: number;
  tone?: IconTone;
  /** Only set when the icon carries meaning on its own — otherwise it stays aria-hidden. */
  label?: string;
}

const TONES: Record<IconTone, string> = {
  base: 'var(--color-icon)', secondary: 'var(--color-icon-secondary)', hover: 'var(--color-icon-hover)',
  active: 'var(--color-icon-active)', disabled: 'var(--color-icon-disabled)', inverse: 'var(--color-icon-inverse)',
  success: 'var(--color-success-icon)', critical: 'var(--color-critical-icon)', warning: 'var(--color-warning-icon)',
  caution: 'var(--color-caution-icon)', info: 'var(--color-info-icon)', highlight: 'var(--color-highlight-icon)',
  ai: 'var(--color-ai-icon)', inherit: 'currentColor',
};

/** Icons available in the 16px set; everything else falls back to the 20px art. */
const ICONS_16 = new Set(Object.keys(SETS[16]));

function parse(markup: string) {
  const inner = markup.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
  const box = (markup.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 20 20';
  return { inner, box };
}

const CACHE = new Map<string, { inner: string; box: string }>();

function glyph(source: string, size: number) {
  const dir = size <= 16 && ICONS_16.has(source) ? 16 : 20;
  const key = `${dir}/${source}`;
  const cached = CACHE.get(key);
  if (cached) return cached;
  const markup = SETS[dir][source] || SETS[20][source] || SETS[16][source];
  if (!markup) return null;
  const parsed = parse(markup);
  CACHE.set(key, parsed);
  return parsed;
}

export function Icon({ source, size = 20, tone = 'base', label, className = '', style, ...rest }: IconProps) {
  const svg = glyph(source, size);
  if (!svg && import.meta.env.DEV) console.warn(`[ds] unknown icon "${source}"`);
  return (
    <span
      className={['as-icon', className].filter(Boolean).join(' ')}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size, color: TONES[tone] || TONES.base, ...style }}
      {...rest}
    >
      {svg && (
        <svg
          viewBox={svg.box}
          width={size}
          height={size}
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
          dangerouslySetInnerHTML={{ __html: svg.inner }}
        />
      )}
    </span>
  );
}
