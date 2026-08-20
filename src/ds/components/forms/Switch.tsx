import React from 'react';

export interface SwitchProps extends Omit<React.HTMLAttributes<HTMLLabelElement>, 'onChange'> {
  label?: React.ReactNode;
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

export function Switch({ label, checked = false, onChange, disabled = false, size = 'medium', className = '', style, ...rest }: SwitchProps) {
  return (
    <label className={['as-switch', size === 'small' && 'as-switch--small', disabled && 'is-disabled', className].filter(Boolean).join(' ')} style={style} {...rest}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : undefined}
        className="as-switch__track"
        disabled={disabled}
        onClick={disabled ? undefined : () => onChange && onChange(!checked)}
      ><span className="as-switch__knob" /></button>
      {label && <span className="as-switch__label">{label}</span>}
    </label>
  );
}
