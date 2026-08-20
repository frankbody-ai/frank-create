import React from 'react';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'small' | 'medium' | 'large';
  tone?: 'base' | 'inverse';
  label?: string;
}

/** Reserved for indeterminate waits under 3 seconds. Anything with predictable layout gets a Skeleton. */
export function Spinner({ size = 'medium', tone = 'base', label = 'Loading', className = '', style, ...rest }: SpinnerProps) {
  const px = size === 'small' ? 16 : size === 'large' ? 32 : 20;
  return (
    <span
      className={['as-spinner', className].filter(Boolean).join(' ')}
      role="status"
      aria-label={label}
      style={{ width: px, height: px, borderColor: tone === 'inverse' ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)', borderRightColor: 'transparent', ...style }}
      {...rest}
    />
  );
}
