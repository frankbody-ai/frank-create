import React from 'react';
import { Text } from '../primitives/Text';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** 'none' lets tables and media bleed to the card edge. */
  padding?: 'default' | 'none';
  /** Colour token name without the `--color-` prefix. */
  background?: string;
}

/** Level-1 container: white, 12px radius, 16px padding, shadow-100 (the ring lives in the shadow). */
export function Card({ title, subtitle, actions, padding = 'default', background = 'bg-surface', children, className = '', style, ...rest }: CardProps) {
  return (
    <section
      className={['as-card', padding === 'none' && 'as-card--flush', className].filter(Boolean).join(' ')}
      style={{ background: `var(--color-${background})`, ...style }}
      {...rest}
    >
      {(title || actions) && (
        <header className="as-card__header">
          <div className="as-card__titles">
            {typeof title === 'string' ? <Text variant="headingMd" as="h3">{title}</Text> : title}
            {subtitle && <Text variant="bodySm" tone="secondary">{subtitle}</Text>}
          </div>
          {actions && <div className="as-card__actions">{actions}</div>}
        </header>
      )}
      <div className="as-card__body">{children}</div>
    </section>
  );
}
