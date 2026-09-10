import React from 'react';

const PALETTE = ['default', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const hash = (s = '') => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

export function Avatar({ name = '', initials, size = 32, tone, source, className = '', style, ...rest }) {
  const key = tone || PALETTE[1 + (hash(name) % (PALETTE.length - 1))];
  const label = (initials || name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();
  return (
    <span
      className={['as-avatar', className].filter(Boolean).join(' ')}
      title={name || undefined}
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.4),
        background: source ? `center/cover no-repeat url("${source}")` : `var(--color-avatar-${key}-bg)`,
        color: `var(--color-avatar-${key}-text)`,
        ...style,
      }}
      {...rest}
    >{source ? '' : label}</span>
  );
}
