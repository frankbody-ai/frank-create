export interface TextFieldProps {
  label?: React.ReactNode;
  labelHidden?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  /** bodySm helper below the field. Hidden while an error is showing. */
  helpText?: React.ReactNode;
  /** Error message. Swaps the surface to the critical tint and prefixes a 16px critical icon. */
  error?: string | boolean;
  type?: string;
  multiline?: boolean;
  rows?: number;
  /** Static text inside the field, e.g. 'A$' or '%'. */
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  /** Leading 16px icon name. */
  icon?: string;
  disabled?: boolean;
  readOnly?: boolean;
  requiredIndicator?: boolean;
  /** Tints the surface with the AI token set for generated / assisted inputs. */
  ai?: boolean;
  maxWidth?: string | number;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function TextField(props: TextFieldProps): JSX.Element;
