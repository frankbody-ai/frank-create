export interface ActionListItem {
  content: string;
  icon?: string;
  destructive?: boolean;
  active?: boolean;
  disabled?: boolean;
  suffix?: React.ReactNode;
  onAction?: () => void;
}

export interface ActionListSection { title?: string; items: ActionListItem[] }

export interface ActionListProps {
  /** Grouped items, separated by a hairline. */
  sections?: ActionListSection[];
  /** Shorthand for a single ungrouped section. */
  items?: ActionListItem[];
  onAction?: (item: ActionListItem) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function ActionList(props: ActionListProps): JSX.Element;
