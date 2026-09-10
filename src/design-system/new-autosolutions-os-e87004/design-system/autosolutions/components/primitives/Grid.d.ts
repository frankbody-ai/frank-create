export interface GridProps {
  /** Column count, or a raw grid-template-columns string. */
  columns?: number | string;
  gap?: string | number;
  /** Set instead of `columns` for an auto-fit responsive grid, e.g. '280px'. */
  minColumnWidth?: string;
  align?: React.CSSProperties['alignItems'];
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Grid(props: GridProps): JSX.Element;
