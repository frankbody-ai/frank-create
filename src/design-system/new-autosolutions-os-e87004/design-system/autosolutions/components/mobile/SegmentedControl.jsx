import React from 'react';

/**
 * Horizontal filter control for phones — the mobile replacement for Tabs.
 * `segmented` is the pill-in-a-well form for 2–4 exclusive options;
 * `scroll` is a scrolling chip row for a longer saved-view list.
 */
export function SegmentedControl({ options = [], selected, onSelect, variant = 'segmented', className = '', style, ...rest }) {
  const items = options.map((o) => (typeof o === 'string' ? { id: o, label: o } : o));
  return (
    <div
      className={['as-m-seg', `as-m-seg--${variant}`, className].filter(Boolean).join(' ')}
      role="tablist"
      style={style}
      {...rest}
    >
      {items.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === selected}
          className={['as-m-seg__item', o.id === selected && 'is-selected'].filter(Boolean).join(' ')}
          onClick={() => onSelect && onSelect(o.id)}
        >
          {o.label}
          {o.count != null && <span className="as-m-seg__count as-tabular">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
