export interface TabBarItem {
  id: string;
  label: string;
  /** 24px icon name — 20px reads too small under a thumb. */
  icon: string;
  badge?: string | number;
}

export interface TabBarProps {
  /** Five maximum; a sixth destination belongs behind a "More" sheet. */
  tabs?: TabBarItem[];
  selected?: string;
  onSelect?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function TabBar(props: TabBarProps): JSX.Element;
