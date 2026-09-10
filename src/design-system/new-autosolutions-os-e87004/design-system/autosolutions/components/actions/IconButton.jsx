import React from 'react';
import { Icon } from '../media/Icon.jsx';

/** Square icon-only action. 28×28 at 4px padding — the toolbar and table-row workhorse. */
export function IconButton({
  icon, label, variant = 'tertiary', tone = 'default', size = 'medium', selected = false,
  disabled = false, onClick, url, className = '', style, ...rest
}) {
  const Tag = url ? 'a' : 'button';
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
      disabled={Tag === 'button' ? disabled : undefined}
      type={Tag === 'button' ? 'button' : undefined}
      {...rest}
    >
      <Icon source={icon} size={size === 'large' ? 20 : 16} tone="inherit" />
    </Tag>
  );
}
