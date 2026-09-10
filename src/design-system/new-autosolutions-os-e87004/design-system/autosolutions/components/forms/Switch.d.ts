export interface SwitchProps {
  label?: React.ReactNode;
  /** Keeps the accessible name but hides the visible text. Set this whenever a
   *  surrounding row title or card heading already names the control. */
  labelHidden?: boolean;
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  className?: string;
  style?: React.CSSProperties;
}

export function Switch(props: SwitchProps): JSX.Element;
