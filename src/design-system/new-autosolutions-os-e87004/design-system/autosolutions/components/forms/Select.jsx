import React from 'react';
import { Icon } from '../media/Icon.jsx';


export function Select({
  label, labelHidden = false, options = [], value, defaultValue, onChange, helpText, error,
  disabled = false, id, maxWidth, className = '', style, ...rest
}) {
  const autoId = React.useId();
  const fieldId = id || `as-select-${autoId}`;
  const items = options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o));
  return (
    <div className={['as-field', className].filter(Boolean).join(' ')} style={{ maxWidth, ...style }}>
      {label && (
        <label className={['as-field__label', labelHidden && 'as-visually-hidden'].filter(Boolean).join(' ')} htmlFor={fieldId}>{label}</label>
      )}
      <div className={['as-input', 'as-input--select', error && 'is-error', disabled && 'is-disabled'].filter(Boolean).join(' ')}>
        <select id={fieldId} className="as-input__control" value={value} defaultValue={defaultValue} onChange={onChange} disabled={disabled} {...rest}>
          {items.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon source="chevron-up-down" size={16} tone="secondary" className="as-input__chevron" />
      </div>
      {error && typeof error === 'string' && (
        <div className="as-field__error"><Icon source="exclamation-circle" size={16} tone="critical" />{error}</div>
      )}
      {helpText && !error && <div className="as-field__help">{helpText}</div>}
    </div>
  );
}
