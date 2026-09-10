export interface DividerProps {
  tone?: 'base' | 'secondary';
  /** Space token key applied as block margin. Default '0'. */
  spacing?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Divider(props: DividerProps): JSX.Element;
