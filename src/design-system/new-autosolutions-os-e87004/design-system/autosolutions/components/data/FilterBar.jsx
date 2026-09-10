import React from 'react';
import { Icon } from '../media/Icon.jsx';
import { IconButton } from '../actions/IconButton.jsx';

/** The bar that sits above a resource table: saved views, inline search, filters, view controls. */
export function FilterBar({
  views = [], selectedView, onSelectView, searchValue = '', onSearchChange,
  placeholder = 'Search and filter', actions, className = '', style, ...rest
}) {
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
        {actions || <IconButton icon="adjustments-horizontal" label="Edit columns" />}
      </div>
    </div>
  );
}
