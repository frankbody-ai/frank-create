export interface ButtonProps {
  children?: React.ReactNode;
  /** 'secondary' is the default. 'primary' is reserved for the single most important action on a view. */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'plain';
  /** 'critical' recolours destructive actions. */
  tone?: 'default' | 'critical';
  /** 'medium' = 28px (default) · 'micro' = 24px · 'large' = 32px. */
  size?: 'micro' | 'medium' | 'large';
  /** Leading icon name from /assets/icons, rendered at 16px in currentColor. */
  icon?: string;
  /** Trailing chevron for menu-opening buttons. Switches to the 4/6/4/12 padding. */
  disclosure?: boolean;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Persistent on-state for toggle buttons. */
  pressed?: boolean;
  /** Renders an <a> instead of a <button>. */
  url?: string;
  target?: string;
  onClick?: (event: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function Button(props: ButtonProps): JSX.Element;
