export type BadgeTone = 'neutral' | 'success' | 'critical' | 'warning' | 'caution' | 'info' | 'highlight' | 'ai';

export interface BadgeProps {
  children?: React.ReactNode;
  /** Pairs the status fill-secondary with its matching dark text colour. */
  tone?: BadgeTone;
  /** Leading 16px icon in the badge's own colour. */
  icon?: string;
  /** Progress dot for lifecycle states. */
  progress?: 'incomplete' | 'partial' | 'complete';
  size?: 'medium' | 'large';
  className?: string;
  style?: React.CSSProperties;
}

export function Badge(props: BadgeProps): JSX.Element;
