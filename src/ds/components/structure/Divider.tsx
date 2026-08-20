import React from 'react';

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  tone?: 'base' | 'secondary';
  /** Space token key for the block margin. '0' by default. */
  spacing?: string;
}

export function Divider({ tone = 'base', spacing = '0', className = '', style, ...rest }: DividerProps) {
  return (
    <hr
      className={['as-divider', className].filter(Boolean).join(' ')}
      style={{
        borderColor: tone === 'secondary' ? 'var(--color-border-secondary)' : 'var(--color-border)',
        marginBlock: spacing === '0' ? 0 : `var(--space-${spacing})`,
        ...style,
      }}
      {...rest}
    />
  );
}
