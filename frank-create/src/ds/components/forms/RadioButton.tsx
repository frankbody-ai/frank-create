import React from 'react';

export interface RadioButtonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Share one `name` across the group. */
  name?: string;
  value?: string;
  disabled?: boolean;
}

let uid = 0;

export function RadioButton({ label, helpText, checked, defaultChecked, onChange, name, value, disabled = false, id, className = '', style, ...rest }: RadioButtonProps) {
  const fieldId = React.useMemo(() => id || `as-radio-${++uid}`, [id]);
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
