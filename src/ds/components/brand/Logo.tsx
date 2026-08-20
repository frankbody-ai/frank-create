import React from 'react';

export interface LogoProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'slot'> {
  /** 'default' 216×48 (app shell) · 'compact' 144×32 · 'large' 288×64. These are the only sanctioned sizes. */
  size?: 'default' | 'compact' | 'large';
  /** Wraps the lockup in the 240×56 slot — exactly the nav width and top-bar height — centred both ways. */
  slot?: boolean;
  label?: string;
}

const SIZES = {
  default: ['var(--logo-width)', 'var(--logo-height)'],
  compact: ['var(--logo-width-compact)', 'var(--logo-height-compact)'],
  large: ['var(--logo-width-large)', 'var(--logo-height-large)'],
};

/**
 * The AutoSolutions OS lockup at one of three locked sizes.
 * The image lives in CSS (`.as-logo`) so the path resolves from the stylesheet,
 * not from whatever page is mounting it.
 */
export function Logo({ size = 'default', slot = false, label = 'AutoSolutions OS', className = '', style, ...rest }: LogoProps) {
  const [w, h] = SIZES[size] || SIZES.default;
  const mark = (
    <span
      className={['as-logo', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
      style={{ width: w, height: h, ...(slot ? null : style) }}
      {...(slot ? {} : rest)}
    />
  );
  if (!slot) return mark;
  return <span className="as-logo-slot" style={style} {...rest}>{mark}</span>;
}
