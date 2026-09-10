export interface ButtonGroupProps {
  children?: React.ReactNode;
  /** 'segmented' joins the buttons into one control with shared end radii. */
  variant?: 'default' | 'segmented';
  align?: 'start' | 'center' | 'end';
  className?: string;
  style?: React.CSSProperties;
}

export function ButtonGroup(props: ButtonGroupProps): JSX.Element;
