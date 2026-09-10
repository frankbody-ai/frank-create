import React from 'react';

const TONES = {
  base: 'var(--color-icon)', secondary: 'var(--color-icon-secondary)', hover: 'var(--color-icon-hover)',
  active: 'var(--color-icon-active)', disabled: 'var(--color-icon-disabled)', inverse: 'var(--color-icon-inverse)',
  success: 'var(--color-success-icon)', critical: 'var(--color-critical-icon)', warning: 'var(--color-warning-icon)',
  caution: 'var(--color-caution-icon)', info: 'var(--color-info-icon)', highlight: 'var(--color-highlight-icon)',
  ai: 'var(--color-ai-icon)', inherit: 'currentColor',
};

/** The canonical set contains 90 glyphs at 20px, with compact 16px artwork
 *  supplied for the glyphs used in dense contexts. */

/* Vite port: the 16 and 20 sets are bundled at build time instead of fetched
   at runtime, so icons render during SSR and need no window.AS_ICON_BASE. */
const RAW = import.meta.glob('../../assets/icons/*/*.svg', { eager: true, query: '?raw', import: 'default' });

const SETS = (() => {
  const map = { 16: {}, 20: {} };
  for (const [path, text] of Object.entries(RAW)) {
    const m = /icons\/(16|20)\/(.+)\.svg$/.exec(path);
    if (!m) continue;
    map[m[1]][m[2]] = {
      inner: text.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, ''),
      box: (text.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 20 20',
    };
  }
  return map;
})();

/** Every glyph name in the set, sorted. Both sizes carry the same 90 names. */
export const ICON_NAMES = Object.keys(SETS[20]).sort();

export function Icon({ source, size = 20, tone = 'base', label, className = '', style, ...rest }) {
  const dir = size <= 16 ? 16 : 20;
  const svg = SETS[dir][source] || SETS[dir === 16 ? 20 : 16][source];
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
