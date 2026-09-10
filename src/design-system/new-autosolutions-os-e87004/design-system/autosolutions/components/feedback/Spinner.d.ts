export interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  tone?: 'base' | 'inverse';
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Spinner(props: SpinnerProps): JSX.Element;
