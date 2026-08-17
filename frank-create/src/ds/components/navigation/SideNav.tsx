import React from 'react';
import { Icon } from '../media/Icon';

export interface SideNavItem {
  id: string;
  label?: string;
  /** 20px icon name. Icon colour never changes on hover or selection. */
  icon?: string;
  trailingIcon?: string;
  /** Right-aligned count. */
  badge?: string | number;
  /** Renders as a section heading rather than a target. */
  group?: boolean;
  /** Sub-items, revealed only while the parent is selected. */
  items?: SideNavItem[];
  selectedChild?: string;
}

export interface SideNavProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onSelect'> {
  items?: SideNavItem[];
  selected?: string;
  onSelect?: (id: string) => void;
  /** App id — renders that application's generated label in the fixed plate at the top of the nav. */
  app?: string;
  appName?: string;
  /** Makes the plate an app switcher: adds a chevron and fires on click. */
  appAction?: () => void;
  /** Pinned to the bottom edge of the nav and always visible — Settings lives here. */
  footerItems?: SideNavItem[];
  /** Extra controls below the footer items — sign out and the theme picker. */
  footer?: React.ReactNode;
}

/**
 * Fixed 240px navigation on #EBEBEB — one step darker than the canvas so the
 * content area reads as raised. Icon colour never changes on hover or selection.
 */
export function SideNav({ items = [], selected, onSelect, footerItems = [], footer, app, appName, appAction, className = '', style, ...rest }: SideNavProps) {

  const renderItem = (item: SideNavItem) => {
    if (item.group) {
      return <li key={item.id || item.label} className="as-nav__group">{item.label}</li>;
    }
    const isSelected = item.id === selected;
    return (
      <li key={item.id}>
        <button
          type="button"
          className={['as-nav__item', isSelected && 'is-selected'].filter(Boolean).join(' ')}
          onClick={() => onSelect && onSelect(item.id)}
          aria-current={isSelected ? 'page' : undefined}
        >
          {item.icon && <Icon source={item.icon} size={20} />}
          <span className="as-nav__label">{item.label}</span>
          {item.badge != null && <span className="as-nav__badge as-tabular">{item.badge}</span>}
          {item.trailingIcon && <Icon source={item.trailingIcon} size={16} tone="secondary" />}
        </button>
        {isSelected && item.items && (
          <ul className="as-nav__sub">
            {item.items.map((sub) => (
              <li key={sub.id}>
                <button
                  type="button"
                  className={['as-nav__item', 'as-nav__item--sub', sub.id === item.selectedChild && 'is-selected'].filter(Boolean).join(' ')}
                  onClick={() => onSelect && onSelect(sub.id)}
                >
                  <span className="as-nav__label">{sub.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };
  return (
    <nav className={['as-nav', className].filter(Boolean).join(' ')} style={style} {...rest}>
      <div className="as-nav__app" onClick={appAction} role={appAction ? 'button' : undefined} tabIndex={appAction ? 0 : undefined}>
        {app
          ? <span className={`as-app as-app--${app}`} role="img" aria-label={appName || app} />
          : (appName ? <span className="as-nav__app-name">{appName}</span> : null)}
        {appAction && <Icon source="chevron-up-down" size={16} tone="secondary" />}
      </div>
      <ul className="as-nav__list as-nav__list--main">{items.map(renderItem)}</ul>
      {footerItems.length > 0 && <ul className="as-nav__list as-nav__list--footer">{footerItems.map(renderItem)}</ul>}
    </nav>
  );
}
