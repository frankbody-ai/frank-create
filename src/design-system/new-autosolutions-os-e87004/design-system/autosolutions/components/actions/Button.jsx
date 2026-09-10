import React from 'react';
import { Icon } from '../media/Icon.jsx';

/**
 * The product's action control. 28px tall, 8px radius, 12/16 label at weight 550.
 * Primary is a fill + gradient + triple inset — never a flat colour.
 */
export function Button({
  children, variant = 'secondary', tone = 'default', size = 'medium', icon, disclosure = false,
  loading = false, disabled = false, fullWidth = false, pressed = false, url, target,
  onClick, className = '', style, ...rest
}) {
  const Tag = url ? 'a' : 'button';
  const cls = [
    'as-btn', `as-btn--${variant}`, `as-btn--${size}`,
    tone !== 'default' && `as-btn--${tone}`,
    fullWidth && 'as-btn--full', pressed && 'is-pressed', disclosure && 'as-btn--disclosure',
    (disabled || loading) && 'is-disabled', className,
  ].filter(Boolean).join(' ');
  return (
    <Tag
      className={cls}
      style={style}
      href={url}
      target={target}
      onClick={disabled || loading ? undefined : onClick}
      disabled={Tag === 'button' ? (disabled || loading) : undefined}
      aria-disabled={disabled || loading || undefined}
      type={Tag === 'button' ? 'button' : undefined}
      {...rest}
    >
      {loading && <span className="as-btn__spinner" aria-hidden="true" />}
      {icon && !loading && <Icon source={icon} size={16} tone="inherit" />}
      {children && <span className="as-btn__label">{children}</span>}
      {disclosure && <Icon source="chevron-down" size={16} tone="inherit" />}
    </Tag>
  );
}
