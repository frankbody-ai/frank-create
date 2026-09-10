export interface TopBarProps {
  /** Omit for the redesigned 20px-tall magenta lockup centred in the 240×56 slot.
   *  Pass a string only for a text fallback, or a node to override. */
  brand?: React.ReactNode;
  /** Small outlined chip beside the lockup, e.g. a release name. The lockup already says "OS", so don't repeat it. */
  edition?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  notificationCount?: number;
  /** Tenant company id — renders that company's mark at the locked 106×32 in the top-right. */
  company?: 'alive' | 'coreiq' | 'enxgy' | 'frankbody' | 'ledgify' | 'seniorsnouts' | 'strengthlab';
  /** Accessible name for the mark, if different from the registered company name. */
  companyName?: string;
  /** Makes the mark a company switcher: adds a chevron and fires on click. */
  onCompanyAction?: () => void;
  /** Extra controls inserted before help/notifications. */
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function TopBar(props: TopBarProps): JSX.Element;
