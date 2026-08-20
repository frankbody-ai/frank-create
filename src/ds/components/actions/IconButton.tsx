import React from 'react';
import { Icon } from '../media/Icon';

export interface IconButtonProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick'> {
  icon: string;
  /** Required — becomes aria-label and the tooltip. */
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary';
  tone?: 'default' | 'critical';
  size?: 'micro' | 'medium' | 'large';
  /** Persistent selected state (e.g. an active view toggle). */
  selected?: boolean;
  disabled?: boolean;
  url?: string;
  onClick?: (event: React.MouseEvent) => void;
}

/** Square icon-only action. 28×28 at 4px padding — the toolbar and table-row workhorse. */
export function IconButton({
  icon, label, variant = 'tertiary', tone = 'default', size = 'medium', selected = false,
  disabled = false, onClick, url, className = '', style, ...rest
}: IconButtonProps) {
  const Tag: React.ElementType = url ? 'a' : 'button';
  return (
    <Tag
      className={['as-btn', 'as-btn--icon', `as-btn--${variant}`, `as-btn--${size}`,
        tone !== 'default' && `as-btn--${tone}`, selected && 'is-selected', disabled && 'is-disabled', className]
        .filter(Boolean).join(' ')}
      style={style}
      href={url}
      aria-label={label}
      title={label}
      onClick={disabled ? undefined : onClick}
      disabled={url ? undefined : disabled}
      type={url ? undefined : 'button'}
      {...rest}
    >
      <Icon source={icon} size={size === 'large' ? 20 : 16} tone="inherit" />
    </Tag>
  );
}
