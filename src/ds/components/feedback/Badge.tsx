import React from 'react';
import { Icon } from '../media/Icon';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'caution' | 'critical' | 'highlight' | 'ai' | 'inverse';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: string;
  /** Leading progress dot: 'incomplete' | 'partial' | 'complete'. */
  progress?: 'incomplete' | 'partial' | 'complete';
  size?: 'medium' | 'large';
}

/** 20px tall status pill: 8px radius, 2/8 padding, 12/16 label at weight 550. Always carries text. */
export function Badge({ children, tone = 'neutral', icon, progress, size = 'medium', className = '', style, ...rest }: BadgeProps) {
  return (
    <span className={['as-badge', `as-badge--${tone}`, size === 'large' && 'as-badge--large', className].filter(Boolean).join(' ')} style={style} {...rest}>
      {progress && <span className={`as-badge__dot as-badge__dot--${progress}`} aria-hidden="true" />}
      {icon && <Icon source={icon} size={16} tone="inherit" />}
      {children}
    </span>
  );
}
