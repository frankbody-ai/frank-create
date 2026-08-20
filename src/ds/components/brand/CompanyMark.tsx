import React from 'react';

export type CompanyId = 'alive' | 'coreiq' | 'enxgy' | 'frankbody' | 'ledgify' | 'seniorsnouts' | 'strengthlab';

export interface CompanyProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'title'> {
  company: CompanyId;
  name?: string;
  /** 'compact' 80×24 (rows) · 'default' 106×32 (top bar) · 'large' 159×48 (switcher, settings). */
  size?: 'compact' | 'default' | 'large';
  /** 'tile' = the brand's own colour field. 'plain' = transparent cut — the product default. */
  variant?: 'tile' | 'plain';
}

const SIZES = {
  compact: ['var(--company-width-compact)', 'var(--company-height-compact)'],
  default: ['var(--company-width)', 'var(--company-height)'],
  large: ['var(--company-width-large)', 'var(--company-height-large)'],
};

export const COMPANIES: Array<{ id: CompanyId; name: string }> = [
  { id: 'alive', name: 'al.ive body' },
  { id: 'coreiq', name: 'Core iQ' },
  { id: 'enxgy', name: 'enxgy' },
  { id: 'frankbody', name: 'frank body' },
  { id: 'ledgify', name: 'Ledgify' },
  { id: 'seniorsnouts', name: 'Senior Snouts' },
  { id: 'strengthlab', name: 'Strength Lab' },
];

export function CompanyMark({ company, name, size = 'default', variant = 'tile', className = '', style, ...rest }: CompanyProps) {
  const [w, h] = SIZES[size] || SIZES.default;
  const label = name || (COMPANIES.find((c) => c.id === company) || { name: company }).name;
  return (
    <span
      className={['as-company', `as-company--${company}`, variant === 'plain' && 'as-company--plain', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
      title={label}
      style={{ width: w, height: h, ...style }}
      {...rest}
    />
  );
}
