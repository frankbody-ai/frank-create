export interface TooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
  position?: 'above' | 'below';
  className?: string;
  style?: React.CSSProperties;
}

export function Tooltip(props: TooltipProps): JSX.Element;
