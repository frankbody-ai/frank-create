import React from 'react';
import { Icon } from '../media/Icon';
import { IconButton } from '../actions/IconButton';

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Saved view names, e.g. ['All','Active','Failing']. */
  views?: string[];
  selectedView?: string;
  onSelectView?: (view: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  /** Right-hand controls. Defaults to an "Edit columns" IconButton. */
  actions?: React.ReactNode;
}

/** The bar that sits above a resource table: saved views, inline search, filters, view controls. */
export function FilterBar({
  views = [], selectedView, onSelectView, searchValue = '', onSearchChange,
  placeholder = 'Search and filter', actions, className = '', style, ...rest
}: FilterBarProps) {
  return (
    <div className={['as-filterbar', className].filter(Boolean).join(' ')} style={style} {...rest}>
      {views.length > 0 && (
        <div className="as-filterbar__views">
          {views.map((v) => (
            <button
              key={v}
              type="button"
              className={['as-filterbar__view', v === selectedView && 'is-selected'].filter(Boolean).join(' ')}
              onClick={() => onSelectView && onSelectView(v)}
            >{v}</button>
          ))}
        </div>
      )}
      <label className="as-filterbar__search">
        <Icon source="magnifying-glass" size={16} tone="secondary" />
        <input
          type="search"
          value={searchValue}
          placeholder={placeholder}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          aria-label={placeholder}
        />
      </label>
      <div className="as-filterbar__actions">
        {actions === undefined ? <IconButton icon="adjustments-horizontal" label="Edit columns" /> : actions}
      </div>
    </div>
  );
}
