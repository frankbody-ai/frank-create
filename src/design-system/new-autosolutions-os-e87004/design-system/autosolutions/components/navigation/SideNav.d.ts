export interface SideNavItem {
  id: string;
  label: string;
  /** 20px icon name. Icon colour never changes on hover or selection. */
  icon?: string;
  trailingIcon?: string;
  /** Right-aligned count. */
  badge?: string | number;
  /** Sub-items, revealed only while the parent is selected. */
  items?: SideNavItem[];
  selectedChild?: string;
}

export interface SideNavProps {
  items?: SideNavItem[];
  selected?: string;
  onSelect?: (id: string) => void;
  /** App id — renders that application's generated label in the fixed plate at the top of the nav. */
  app?: string;
  /** Name of the application. Used as the label's accessible name, or rendered as type when no `app` is given. The plate is always rendered, filled or not, so the geometry never shifts between products. */
  appName?: string;
  /** Makes the plate an app switcher: adds a chevron and fires on click. */
  appAction?: () => void;
  /** Pinned to the bottom edge of the nav and always visible — Settings lives here. */
  footerItems?: SideNavItem[];
  className?: string;
  style?: React.CSSProperties;
}

export function SideNav(props: SideNavProps): JSX.Element;
