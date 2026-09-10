import React from 'react';

export function Tabs({ tabs = [], selected, onSelect, fitted = false, className = '', style, ...rest }) {
  return (
    <div className={['as-tabs', fitted && 'as-tabs--fitted', className].filter(Boolean).join(' ')} role="tablist" style={style} {...rest}>
      {tabs.map((t) => {
        const id = typeof t === 'string' ? t : t.id;
        const label = typeof t === 'string' ? t : t.label;
        const count = typeof t === 'string' ? undefined : t.count;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === selected}
            className={['as-tabs__tab', id === selected && 'is-selected'].filter(Boolean).join(' ')}
            onClick={() => onSelect && onSelect(id)}
          >
            {label}{count != null && <span className="as-tabs__count as-tabular">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
