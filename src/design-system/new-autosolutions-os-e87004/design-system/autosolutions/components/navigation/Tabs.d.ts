export interface TabItem { id: string; label: string; count?: number }

export interface TabsProps {
  /** Strings or {id, label, count} objects. */
  tabs?: (string | TabItem)[];
  selected?: string;
  onSelect?: (id: string) => void;
  /** Stretch tabs to fill the row. */
  fitted?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Tabs(props: TabsProps): JSX.Element;
