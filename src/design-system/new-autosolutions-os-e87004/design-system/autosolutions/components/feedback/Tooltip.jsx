import React from 'react';

export function Tooltip({ content, children, position = 'above', className = '', style, ...rest }) {
  return (
    <span className={['as-tooltip', `as-tooltip--${position}`, className].filter(Boolean).join(' ')} style={style} {...rest}>
      {children}
      <span className="as-tooltip__bubble" role="tooltip">{content}</span>
    </span>
  );
}
