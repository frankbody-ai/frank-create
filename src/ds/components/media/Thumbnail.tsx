import React from 'react';
import { Icon } from './Icon';

export interface ThumbnailProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'title'> {
  source?: string;
  alt?: string;
  /** 'small' 28 · 'medium' 40 (the record-row size) · 'large' 60, or a px number. */
  size?: 'small' | 'medium' | 'large' | number;
}

const SIZES = { small: 28, medium: 40, large: 60 };

export function Thumbnail({ source, alt = '', size = 'medium', className = '', style, ...rest }: ThumbnailProps) {
  const px = typeof size === 'number' ? size : (SIZES[size] || SIZES.medium);
  return (
    <span
      className={['as-thumbnail', className].filter(Boolean).join(' ')}
      style={{ width: px, height: px, ...style }}
      {...rest}
    >
      {source
        ? <img src={source} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
        : <Icon source="photo" size={px >= 40 ? 20 : 16} tone="secondary" />}
    </span>
  );
}
