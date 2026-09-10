import React from 'react';

const gapValue = (v) => (v == null ? undefined : (typeof v === 'number' ? `${v}px` : `var(--space-${v})`));

/** Vertical or horizontal flex stack. `gap` takes a space token key ('200') or a raw px number. */
export function Stack({
  as: Tag = 'div', direction = 'block', gap = '200', align, justify, wrap = false,
  inline = false, children, className = '', style, ...rest
}) {
  return (
    <Tag
      className={['as-stack', className].filter(Boolean).join(' ')}
      style={{
        display: inline ? 'inline-flex' : 'flex',
        flexDirection: direction === 'inline' ? 'row' : 'column',
        gap: gapValue(gap),
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : undefined,
        ...style,
      }}
      {...rest}
    >{children}</Tag>
  );
}
