import React from 'react';

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Column count, or a raw grid-template-columns string. */
  columns?: number | string;
  gap?: string | number;
  /** Set instead of `columns` for an auto-fit responsive grid, e.g. '280px'. */
  minColumnWidth?: string;
  align?: React.CSSProperties['alignItems'];
}

const gapValue = (v: string | number) => (typeof v === 'number' ? `${v}px` : `var(--space-${v})`);

export function Grid({ columns = 2, gap = '400', minColumnWidth, align, children, className = '', style, ...rest }: GridProps) {
  return (
    <div
      className={['as-grid', className].filter(Boolean).join(' ')}
      style={{
        display: 'grid',
        gridTemplateColumns: minColumnWidth
          ? `repeat(auto-fit,minmax(${minColumnWidth},1fr))`
          : (typeof columns === 'string' ? columns : `repeat(${columns},minmax(0,1fr))`),
        gap: gapValue(gap),
        alignItems: align,
        ...style,
      }}
      {...rest}
    >{children}</div>
  );
}
