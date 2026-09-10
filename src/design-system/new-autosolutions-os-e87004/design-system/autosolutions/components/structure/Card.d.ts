export interface CardProps {
  /** String renders as headingMd (the default card heading), or pass your own node. */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned action group in the header. */
  actions?: React.ReactNode;
  /** 'none' lets tables and images bleed to the card edge. */
  padding?: 'default' | 'none';
  /** Surface token without the `--color-` prefix. Default 'bg-surface'. */
  background?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card(props: CardProps): JSX.Element;
