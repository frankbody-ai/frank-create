import React from 'react';
import { Icon } from '../media/Icon';

export type CompanyId = 'alive' | 'coreiq' | 'enxgy' | 'frankbody' | 'ledgify' | 'seniorsnouts' | 'strengthlab';

export interface TopBarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Omit for the locked lockup (216×48 centred in the 240×56 slot). */
  brand?: React.ReactNode;
  /** Small outlined chip beside the lockup, e.g. a release name. */
  edition?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** PORT: omit entirely to drop the search field, rather than render a dead one. */
  showSearch?: boolean;
  /** PORT: the bell renders only when this is a number. */
  notificationCount?: number;
  onNotifications?: () => void;
  /** PORT: the help target renders only when this is set. */
  onHelp?: () => void;
  helpUrl?: string;
  /** Tenant company id — renders that company's mark at the locked 106×32 in the top-right. */
  company?: CompanyId;
  companyName?: string;
  /** Makes the mark a company switcher: adds a chevron and fires on click. */
  onCompanyAction?: () => void;
  /** Extra controls inserted before the company mark. */
  actions?: React.ReactNode;
}

/*
 * PORT NOTE — the shipped TopBar always renders the help and notification targets.
 * This app has neither behind it, so both are opt-in: an absent control is honest,
 * a dead one is not. Everything else matches the source.
 */
export function TopBar({
  brand, edition, searchPlaceholder = 'Search', searchValue, onSearchChange, showSearch = true,
  notificationCount, onNotifications, onHelp, helpUrl, company, companyName, onCompanyAction,
  actions, className = '', style, ...rest
}: TopBarProps) {
  const HelpTag: React.ElementType = helpUrl ? 'a' : 'button';
  return (
    <header className={['as-topbar', className].filter(Boolean).join(' ')} style={style} {...rest}>
      <div className="as-topbar__brand">
        {brand == null
          ? <span className="as-logo" role="img" aria-label="AutoSolutions OS" style={{ width: 'var(--logo-width)', height: 'var(--logo-height)' }} />
          : (typeof brand === 'string' ? <span className="as-topbar__wordmark">{brand}</span> : brand)}
      </div>
      {edition && <span className="as-topbar__edition">{edition}</span>}
      {showSearch && (
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
      )}
      <div className="as-topbar__cluster">
        {actions}
        {(onHelp || helpUrl) && (
          <HelpTag type={helpUrl ? undefined : 'button'} href={helpUrl} className="as-topbar__target" aria-label="Help" onClick={onHelp}>
            <Icon source="question-mark-circle" size={20} tone="inherit" />
          </HelpTag>
        )}
        {notificationCount != null && (
          <button type="button" className="as-topbar__target" aria-label="Notifications" onClick={onNotifications}>
            <Icon source="bell" size={20} tone="inherit" />
            {notificationCount ? <span className="as-topbar__count">{notificationCount}</span> : null}
          </button>
        )}
        {company && (onCompanyAction
          ? (
            <button type="button" className="as-topbar__company" onClick={onCompanyAction} aria-label={`Company: ${companyName || company}`}>
              <span className={`as-company as-company--${company} as-company--plain`} style={{ width: 'var(--company-width)', height: 'var(--company-height)' }} />
              <Icon source="chevron-down" size={16} tone="inherit" />
            </button>
          )
          : (
            <span className="as-topbar__company as-topbar__company--static" role="img" aria-label={companyName || company}>
              <span className={`as-company as-company--${company} as-company--plain`} style={{ width: 'var(--company-width)', height: 'var(--company-height)' }} />
            </span>
          ))}
      </div>
    </header>
  );
}
