import React from 'react';
import { Icon } from '../media/Icon.jsx';


export function TextField({
  label, labelHidden = false, value, defaultValue, onChange, placeholder, helpText, error,
  type = 'text', multiline = false, rows = 3, prefix, suffix, icon, disabled = false, readOnly = false,
  requiredIndicator = false, ai = false, maxWidth, id, className = '', style, ...rest
}) {
  const autoId = React.useId();
  const fieldId = id || `as-field-${autoId}`;
  const Control = multiline ? 'textarea' : 'input';
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
