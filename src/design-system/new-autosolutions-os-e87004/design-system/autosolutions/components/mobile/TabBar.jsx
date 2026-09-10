import React from 'react';
import { Icon } from '../media/Icon.jsx';

/**
 * Bottom tab bar. Five destinations maximum — a sixth becomes "More", which
 * opens a Sheet. The 240px side nav's long list does not fit a thumb.
 */
export function TabBar({ tabs = [], selected, onSelect, className = '', style, ...rest }) {
  return (
    <nav className={['as-m-tabbar', className].filter(Boolean).join(' ')} style={style} {...rest}>
      {tabs.slice(0, 5).map((tab) => {
        const isSelected = tab.id === selected;
        return (
          <button
            key={tab.id}
            type="button"
            className={['as-m-tabbar__tab', isSelected && 'is-selected'].filter(Boolean).join(' ')}
            aria-current={isSelected ? 'page' : undefined}
            onClick={() => onSelect && onSelect(tab.id)}
          >
            <span className="as-m-tabbar__glyph">
              <Icon source={tab.icon} size={24} tone="inherit" />
              {tab.badge ? <span className="as-m-tabbar__badge">{tab.badge}</span> : null}
            </span>
            <span className="as-m-tabbar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
