import React from 'react';

export interface TooltipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'content'> {
  content: React.ReactNode;
  position?: 'above' | 'below';
}

export function Tooltip({ content, children, position = 'above', className = '', style, ...rest }: TooltipProps) {
  return (
    <span className={['as-tooltip', `as-tooltip--${position}`, className].filter(Boolean).join(' ')} style={style} {...rest}>
      {children}
      <span className="as-tooltip__bubble" role="tooltip">{content}</span>
    </span>
  );
}
