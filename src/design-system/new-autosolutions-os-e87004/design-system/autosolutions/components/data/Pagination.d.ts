export interface PaginationProps {
  /** e.g. '1-50 of 1,044'. Rendered with tabular figures. */
  label?: React.ReactNode;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function Pagination(props: PaginationProps): JSX.Element;
