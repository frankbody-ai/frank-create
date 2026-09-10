export interface RadioButtonProps {
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Share one `name` across the group. */
  name?: string;
  value?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function RadioButton(props: RadioButtonProps): JSX.Element;
