export interface MobileListRowProps {
  title: React.ReactNode;
  /** Second line — the metadata a table would have given its own column. */
  subtitle?: React.ReactNode;
  /** Third line, for a run time or an owner. Use sparingly. */
  meta?: React.ReactNode;
  /** Leading Thumbnail, Avatar or Icon. */
  media?: React.ReactNode;
  /** Trailing Badge. */
  badge?: React.ReactNode;
  /** Trailing figure, rendered with tabular numerals. */
  value?: React.ReactNode;
  /** Trailing chevron. Only drawn when the row is tappable. Default true. */
  chevron?: boolean;
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function MobileListRow(props: MobileListRowProps): JSX.Element;

export interface MobileListProps {
  /** Uppercase micro-heading above the block. */
  title?: React.ReactNode;
  action?: React.ReactNode;
  /** true (default) = 12px-radius card inset by the gutter · false = edge-to-edge band. */
  inset?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function MobileList(props: MobileListProps): JSX.Element;
