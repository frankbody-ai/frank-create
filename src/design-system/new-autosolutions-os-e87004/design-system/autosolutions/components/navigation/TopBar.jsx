import React from 'react';
import { Icon } from '../media/Icon.jsx';
import { Logo } from '../brand/Logo.jsx';
import { CompanySwitcher } from '../brand/CompanyMark.jsx';

/** 56px inverse bar — the only dark surface in the product. */
export function TopBar({
  brand, edition, searchPlaceholder = 'Search', searchValue, onSearchChange,
  notificationCount, company, companyName, onCompanyAction, companyMenuOpen = false, actions, className = '', style, ...rest
}) {
  return (
    <header className={['as-topbar', className].filter(Boolean).join(' ')} style={style} {...rest}>
      <div className="as-topbar__brand">
        {brand == null
          ? <Logo />
          : (typeof brand === 'string' ? <span className="as-topbar__wordmark">{brand}</span> : brand)}
      </div>
      {edition && <span className="as-topbar__edition">{edition}</span>}
      <label className="as-topbar__search">
        <Icon source="magnifying-glass" size={16} tone="inherit" />
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          aria-label={searchPlaceholder}
        />
        <span className="as-topbar__kbd" aria-hidden="true"><span>⌘</span><span>K</span></span>
      </label>
      <div className="as-topbar__cluster">
        {actions}
        <button type="button" className="as-topbar__target" aria-label="Help"><Icon source="question-mark-circle" size={20} tone="inherit" /></button>
        <button type="button" className="as-topbar__target" aria-label="Notifications">
          <Icon source="bell" size={20} tone="inherit" />
          {notificationCount ? <span className="as-topbar__count">{notificationCount}</span> : null}
        </button>
        {company && (
          <CompanySwitcher
            company={company}
            name={companyName}
            open={companyMenuOpen}
            onClick={onCompanyAction}
          />
        )}
      </div>
    </header>
  );
}
