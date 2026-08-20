import React from 'react';

export interface StackProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  /** 'block' = column (default), 'inline' = row. */
  direction?: 'block' | 'inline';
  /** Space token key ('200' = 8px, the default control gap) or px number. */
  gap?: string | number;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  wrap?: boolean;
  inline?: boolean;
}

const gapValue = (v?: string | number) => (v == null ? undefined : (typeof v === 'number' ? `${v}px` : `var(--space-${v})`));

/** Vertical or horizontal flex stack. `gap` takes a space token key ('200') or a raw px number. */
export function Stack({
  as: Tag = 'div', direction = 'block', gap = '200', align, justify, wrap = false,
  inline = false, children, className = '', style, ...rest
}: StackProps) {
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
