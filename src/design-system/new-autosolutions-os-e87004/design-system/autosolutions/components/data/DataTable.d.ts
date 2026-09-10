export interface DataTableColumn {
  key: string;
  title: React.ReactNode;
  /** 'end' right-aligns and applies tabular figures — use for every numeric column. */
  align?: 'start' | 'end';
  width?: string | number;
}

export interface DataTableProps {
  columns?: DataTableColumn[];
  /** Each row is `{ id, [columnKey]: ReactNode }`. */
  rows?: Array<{ id: string } & Record<string, React.ReactNode>>;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleRow?: (id: string) => void;
  onToggleAll?: (next: boolean) => void;
  onRowClick?: (row: Record<string, unknown>) => void;
  /** Rendered in a bordered strip under the table — usually Pagination. */
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function DataTable(props: DataTableProps): JSX.Element;
