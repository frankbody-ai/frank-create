import React from 'react';

/** Row of related actions. 8px gap by default; `segmented` joins them into one control. */
export function ButtonGroup({ children, variant = 'default', align = 'start', className = '', style, ...rest }) {
  return (
    <div
      className={['as-btn-group', variant === 'segmented' && 'as-btn-group--segmented', className].filter(Boolean).join(' ')}
      style={{ justifyContent: align === 'end' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', ...style }}
      {...rest}
    >{children}</div>
  );
}
