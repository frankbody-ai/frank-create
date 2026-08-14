import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'text' | 'heading' | 'block';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

/** Loading placeholder: bg-fill-secondary with a slow shimmer. Use wherever layout is predictable. */
export function Skeleton({ variant = 'text', width = '100%', height, lines = 1, className = '', style, ...rest }: SkeletonProps) {
  const h = height || (variant === 'text' ? 12 : variant === 'heading' ? 20 : 40);
  if (variant === 'text' && lines > 1) {
    return (
      <span className={['as-skeleton-group', className].filter(Boolean).join(' ')} style={style}>
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className="as-skeleton" style={{ width: i === lines - 1 ? '62%' : width, height: h }} />
        ))}
      </span>
    );
  }
  return <span className={['as-skeleton', className].filter(Boolean).join(' ')} style={{ width, height: h, ...style }} {...rest} />;
}
