export interface FilterBarProps {
  /** Saved view names, e.g. ['All','Active','Failing']. */
  views?: string[];
  selectedView?: string;
  onSelectView?: (view: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  /** Right-hand controls. Defaults to an "Edit columns" IconButton. */
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function FilterBar(props: FilterBarProps): JSX.Element;
