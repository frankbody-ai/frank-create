import React from 'react';

const SIZES = { default: '', compact: 'as-logo--compact', large: 'as-logo--large' };

/**
 * The redesigned AutoSolutions OS lockup. Two official cuts: the default is magenta and
 * is correct nearly everywhere, including the dark top bar; `inverse` is the
 * white cut, for the rare surface where magenta would clash with a brand
 * colour behind it. Height is locked by the size class and width follows the
 * aspect ratio — never set a width.
 */
export function Logo({ size = 'default', inverse = false, slot = false, label = 'AutoSolutions OS', className = '', style, ...rest }) {
  const mark = (
    <span
      className={['as-logo', SIZES[size], inverse && 'as-logo--inverse', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
      style={slot ? undefined : style}
      {...(slot ? {} : rest)}
    />
  );
  if (!slot) return mark;
  return <span className="as-logo-slot" style={style} {...rest}>{mark}</span>;
}
