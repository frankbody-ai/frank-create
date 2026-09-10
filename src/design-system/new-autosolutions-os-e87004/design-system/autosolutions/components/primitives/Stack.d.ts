export interface StackProps {
  as?: keyof JSX.IntrinsicElements;
  /** 'block' = column (default), 'inline' = row. */
  direction?: 'block' | 'inline';
  /** Space token key ('200' = 8px, the default control gap) or px number. */
  gap?: string | number;
  align?: React.CSSProperties['alignItems'];
  justify?: React.CSSProperties['justifyContent'];
  wrap?: boolean;
  inline?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Stack(props: StackProps): JSX.Element;
