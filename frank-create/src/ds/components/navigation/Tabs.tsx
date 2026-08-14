import React from 'react';

export interface TabItem { id: string; label: string; count?: number }

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Strings or {id, label, count} objects. */
  tabs?: (string | TabItem)[];
  selected?: string;
  onSelect?: (id: string) => void;
  /** Stretch tabs to fill the row. */
  fitted?: boolean;
}

export function Tabs({ tabs = [], selected, onSelect, fitted = false, className = '', style, ...rest }: TabsProps) {
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
