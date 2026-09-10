export interface SelectOption { label: string; value: string }

export interface SelectProps {
  label?: React.ReactNode;
  labelHidden?: boolean;
  /** Strings or {label, value} objects. */
  options?: (string | SelectOption)[];
  value?: string;
  defaultValue?: string;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  helpText?: React.ReactNode;
  error?: string | boolean;
  disabled?: boolean;
  id?: string;
  maxWidth?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Select(props: SelectProps): JSX.Element;
