import React from 'react';

export function Divider({ tone = 'base', spacing = '0', className = '', style, ...rest }) {
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
