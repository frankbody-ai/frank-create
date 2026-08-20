import React from 'react';
import { Text } from '../primitives/Text';

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  /** 'flat' = level-2 inset group at radius 8 · 'divided' = a hairline-divided run. */
  variant?: 'flat' | 'divided';
}

/** Level-2 group inside a Card: a flat inset block ('flat') or a divided run ('divided'). */
export function Section({ title, actions, variant = 'flat', children, className = '', style, ...rest }: SectionProps) {
  return (
    <div className={['as-section', `as-section--${variant}`, className].filter(Boolean).join(' ')} style={style} {...rest}>
      {(title || actions) && (
        <div className="as-section__header">
          {typeof title === 'string' ? <Text variant="headingSm" as="h4">{title}</Text> : title}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
