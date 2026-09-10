import React from 'react';


export function RadioButton({ label, helpText, checked, defaultChecked, onChange, name, value, disabled = false, id, className = '', style, ...rest }) {
  const autoId = React.useId();
  const fieldId = id || `as-radio-${autoId}`;
  return (
    <div className={['as-choice', 'as-choice--radio', disabled && 'is-disabled', className].filter(Boolean).join(' ')} style={style}>
      <input id={fieldId} type="radio" className="as-choice__input" name={name} value={value} checked={checked} defaultChecked={defaultChecked} onChange={onChange} disabled={disabled} {...rest} />
      {label != null && (
        <label className="as-choice__label" htmlFor={fieldId}>
          {label}
          {helpText && <span className="as-choice__help">{helpText}</span>}
        </label>
      )}
    </div>
  );
}
