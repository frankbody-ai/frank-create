import React from 'react';
import { Icon } from '../media/Icon';

export interface TextFieldProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange' | 'prefix'> {
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
  name?: string;
  autoComplete?: string;
  maxLength?: number;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  inputRef?: React.Ref<never>;
}

let uid = 0;

export function TextField({
  label, labelHidden = false, value, defaultValue, onChange, placeholder, helpText, error,
  type = 'text', multiline = false, rows = 3, prefix, suffix, icon, disabled = false, readOnly = false,
  requiredIndicator = false, ai = false, maxWidth, id, className = '', style, inputRef, ...rest
}: TextFieldProps) {
  const fieldId = React.useMemo(() => id || `as-field-${++uid}`, [id]);
  const Control: React.ElementType = multiline ? 'textarea' : 'input';
  return (
    <div className={['as-field', className].filter(Boolean).join(' ')} style={{ maxWidth, ...style }}>
      {label && (
        <label className={['as-field__label', labelHidden && 'as-visually-hidden'].filter(Boolean).join(' ')} htmlFor={fieldId}>
          {label}{requiredIndicator && <span className="as-field__required" aria-hidden="true">*</span>}
        </label>
      )}
      <div className={['as-input', error && 'is-error', ai && 'is-ai', disabled && 'is-disabled'].filter(Boolean).join(' ')}>
        {icon && <Icon source={icon} size={16} tone="secondary" className="as-input__icon" />}
        {prefix && <span className="as-input__affix">{prefix}</span>}
        <Control
          id={fieldId}
          ref={inputRef}
          className="as-input__control"
          type={multiline ? undefined : type}
          rows={multiline ? rows : undefined}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        {suffix && <span className="as-input__affix">{suffix}</span>}
      </div>
      {error && typeof error === 'string' && (
        <div className="as-field__error"><Icon source="exclamation-circle" size={16} tone="critical" />{error}</div>
      )}
      {helpText && !error && <div className="as-field__help">{helpText}</div>}
    </div>
  );
}
