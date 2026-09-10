import React from 'react';
import { Icon } from '../media/Icon.jsx';

/**
 * The mobile replacement for a DataTable row. A table cannot survive 390px,
 * so every resource index becomes a stack of these: leading media, a two-line
 * stack of title + metadata, a trailing badge or value, then a chevron.
 */
export function MobileListRow({
  title, subtitle, meta, media, badge, value, chevron = true, selected = false,
  destructive = false, disabled = false, onClick, className = '', style, ...rest
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={['as-m-row', selected && 'is-selected', destructive && 'is-destructive', disabled && 'is-disabled', className].filter(Boolean).join(' ')}
      onClick={disabled ? undefined : onClick}
      disabled={Tag === 'button' ? disabled : undefined}
      style={style}
      {...rest}
    >
      {media && <span className="as-m-row__media">{media}</span>}
      <span className="as-m-row__body">
        <span className="as-m-row__title">{title}</span>
        {subtitle && <span className="as-m-row__subtitle">{subtitle}</span>}
        {meta && <span className="as-m-row__meta">{meta}</span>}
      </span>
      {(badge || value) && (
        <span className="as-m-row__trailing">
          {badge}
          {value && <span className="as-m-row__value as-tabular">{value}</span>}
        </span>
      )}
      {chevron && onClick && <Icon source="chevron-right" size={20} tone="secondary" className="as-m-row__chevron" />}
    </Tag>
  );
}

/** Groups rows into one hairline-divided block with an optional heading. */
export function MobileList({ title, action, inset = true, children, className = '', style, ...rest }) {
  return (
    <section className={['as-m-list', inset && 'as-m-list--inset', className].filter(Boolean).join(' ')} style={style} {...rest}>
      {(title || action) && (
        <header className="as-m-list__header">
          {title && <h2 className="as-m-list__title">{title}</h2>}
          {action}
        </header>
      )}
      <div className="as-m-list__rows">{children}</div>
    </section>
  );
}
