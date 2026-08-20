import React from 'react';

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 'segmented' joins the buttons into one control with shared end radii. */
  variant?: 'default' | 'segmented';
  align?: 'start' | 'center' | 'end';
}

/** Row of related actions. 8px gap by default; `segmented` joins them into one control. */
export function ButtonGroup({ children, variant = 'default', align = 'start', className = '', style, ...rest }: ButtonGroupProps) {
  return (
    <div
      className={['as-btn-group', variant === 'segmented' && 'as-btn-group--segmented', className].filter(Boolean).join(' ')}
      style={{ justifyContent: align === 'end' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', ...style }}
      {...rest}
    >{children}</div>
  );
}
