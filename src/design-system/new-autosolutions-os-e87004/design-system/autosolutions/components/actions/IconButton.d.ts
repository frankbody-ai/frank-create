export interface IconButtonProps {
  /** Icon name from /assets/icons. */
  icon: string;
  /** Required — becomes aria-label and the tooltip. */
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary';
  tone?: 'default' | 'critical';
  size?: 'micro' | 'medium' | 'large';
  /** Persistent selected state (e.g. an active view toggle). */
  selected?: boolean;
  disabled?: boolean;
  url?: string;
  onClick?: (event: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function IconButton(props: IconButtonProps): JSX.Element;
