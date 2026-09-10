export interface Company { id: string; name: string }

export declare const COMPANIES: Company[];

export interface CompanyMarkProps {
  /** Company id from COMPANIES, e.g. 'frankbody'. */
  company: string;
  name?: string;
  /** Locked heights: 'compact' 24px · 'default' 32px · 'large' 48px. */
  size?: 'compact' | 'default' | 'large';
  /** 'white' (default) for dark surfaces · 'ink' for light · 'full' for the brand's own colour plate. */
  cut?: 'white' | 'ink' | 'full';
  className?: string;
  style?: React.CSSProperties;
}

export function CompanyMark(props: CompanyMarkProps): JSX.Element;

export interface CompanySwitcherProps {
  company: string;
  name?: string;
  size?: 'compact' | 'default' | 'large';
  cut?: 'white' | 'ink' | 'full';
  /** Rotates the chevron and holds the hover wash while the menu is open. */
  open?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function CompanySwitcher(props: CompanySwitcherProps): JSX.Element;
