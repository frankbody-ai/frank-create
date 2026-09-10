export interface CheckboxProps {
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  /** Mixed state for "some rows selected" headers. */
  indeterminate?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Checkbox(props: CheckboxProps): JSX.Element;
