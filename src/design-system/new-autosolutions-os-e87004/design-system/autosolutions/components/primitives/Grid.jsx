import React from 'react';

const gapValue = (v) => (typeof v === 'number' ? `${v}px` : `var(--space-${v})`);

export function Grid({ columns = 2, gap = '400', minColumnWidth, align, children, className = '', style, ...rest }) {
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
