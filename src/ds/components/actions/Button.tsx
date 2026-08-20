import React from 'react';
import { Icon } from '../media/Icon';

export interface ButtonProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick'> {
  /** 'secondary' is the default. 'primary' is reserved for the single most important action on a view. */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'plain';
  /** 'critical' recolours destructive actions. */
  tone?: 'default' | 'critical';
  /** 'medium' = 28px (default) · 'micro' = 24px · 'large' = 32px. */
  size?: 'micro' | 'medium' | 'large';
  /** Leading icon name, rendered at 16px in currentColor. */
  icon?: string;
  /** Trailing chevron for menu-opening buttons. */
  disclosure?: boolean;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Persistent on-state for toggle buttons. */
  pressed?: boolean;
  /** Renders an <a> instead of a <button>. */
  url?: string;
  target?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: React.MouseEvent) => void;
}

/**
 * The product's action control. 28px tall, 8px radius, 12/16 label at weight 550.
 * Primary is a fill + gradient + triple inset — never a flat colour.
 */
export function Button({
  children, variant = 'secondary', tone = 'default', size = 'medium', icon, disclosure = false,
  loading = false, disabled = false, fullWidth = false, pressed = false, url, target, type,
  onClick, className = '', style, ...rest
}: ButtonProps) {
  const Tag: React.ElementType = url ? 'a' : 'button';
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
      disabled={url ? undefined : (disabled || loading)}
      aria-disabled={disabled || loading || undefined}
      aria-pressed={pressed || undefined}
      type={url ? undefined : (type || 'button')}
      {...rest}
    >
      {loading && <span className="as-btn__spinner" aria-hidden="true" />}
      {icon && !loading && <Icon source={icon} size={16} tone="inherit" />}
      {children && <span className="as-btn__label">{children}</span>}
      {disclosure && <Icon source="chevron-down" size={16} tone="inherit" />}
    </Tag>
  );
}
