import React from 'react';
import { Icon } from '../media/Icon.jsx';

const SIZES = { compact: 'as-company--compact', default: '', large: 'as-company--large' };

export const COMPANIES = [
  { id: 'alive', name: 'al.ive body' },
  { id: 'coreiq', name: 'Core iQ' },
  { id: 'enxgy', name: 'enxgy' },
  { id: 'frankbody', name: 'frank body' },
  { id: 'ledgify', name: 'Ledgify' },
  { id: 'seniorsnouts', name: 'Senior Snouts' },
  { id: 'strengthlab', name: 'Strength Lab' },
];

/**
 * A tenant company's mark at one of three locked heights. The mark sits on
 * whatever is behind it — no plate. Height is locked and width follows the
 * art's own aspect ratio, so never set a width.
 *
 * `cut="white"` (default) for dark surfaces · `cut="ink"` for light ones ·
 * `cut="full"` opts back into the brand's own colour plate.
 */
export function CompanyMark({ company, name, size = 'default', cut = 'white', className = '', style, ...rest }) {
  const label = name || (COMPANIES.find((c) => c.id === company) || {}).name || company;
  return (
    <span
      className={['as-company', `as-company--${company}`, SIZES[size], cut !== 'white' && `as-company--${cut}`, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
      title={label}
      style={style}
      {...rest}
    />
  );
}

/**
 * The standard company switcher: the mark on its own, with a disclosure
 * chevron to its right. Transparent at rest; the faintest wash on hover and
 * while open, so the target is discoverable without a permanent plate.
 *
 * This is the ONE treatment across every AutoSolutions app — top bar, mobile
 * header, settings. Don't reintroduce a plate behind it.
 */
export function CompanySwitcher({ company, name, size = 'default', cut = 'white', open = false, onClick, className = '', style, ...rest }) {
  const label = name || (COMPANIES.find((c) => c.id === company) || {}).name || company;
  return (
    <button
      type="button"
      className={['as-company-switch', open && 'is-open', className].filter(Boolean).join(' ')}
      aria-label={`Company: ${label}`}
      aria-expanded={open}
      aria-haspopup="menu"
      onClick={onClick}
      style={style}
      {...rest}
    >
      <CompanyMark company={company} name={label} size={size} cut={cut} />
      <span className="as-company-switch__chev" aria-hidden="true">
        <Icon source="chevron-down" size={16} tone="inherit" />
      </span>
    </button>
  );
}
