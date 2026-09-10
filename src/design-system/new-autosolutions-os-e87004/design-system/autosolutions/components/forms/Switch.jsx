import React from 'react';

export function Switch({ label, labelHidden = false, checked = false, onChange, disabled = false, size = 'medium', className = '', style, ...rest }) {
  return (
    <label className={['as-switch', size === 'small' && 'as-switch--small', disabled && 'is-disabled', className].filter(Boolean).join(' ')} style={style}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : undefined}
        className="as-switch__track"
        disabled={disabled}
        onClick={disabled ? undefined : () => onChange && onChange(!checked)}
        {...rest}
      ><span className="as-switch__knob" /></button>
      {label && !labelHidden && <span className="as-switch__label">{label}</span>}
    </label>
  );
}
