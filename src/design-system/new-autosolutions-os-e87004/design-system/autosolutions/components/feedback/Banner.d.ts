export interface BannerProps {
  title?: React.ReactNode;
  /** Sets surface, border and icon from one status family. */
  tone?: 'info' | 'success' | 'warning' | 'critical' | 'ai';
  children?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** Renders a dismiss IconButton when provided. */
  onDismiss?: () => void;
  /** Overrides the tone's default icon. */
  icon?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Banner(props: BannerProps): JSX.Element;
