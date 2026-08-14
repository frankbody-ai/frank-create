import React from 'react';

export interface CheckboxProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  /** Mixed state for "some rows selected" headers. */
  indeterminate?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  name?: string;
}

let uid = 0;

export function Checkbox({ label, helpText, checked, defaultChecked, indeterminate = false, onChange, disabled = false, id, className = '', style, ...rest }: CheckboxProps) {
  const fieldId = React.useMemo(() => id || `as-check-${++uid}`, [id]);
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <div className={['as-choice', disabled && 'is-disabled', className].filter(Boolean).join(' ')} style={style}>
      <input ref={ref} id={fieldId} type="checkbox" className="as-choice__input" checked={checked} defaultChecked={defaultChecked} onChange={onChange} disabled={disabled} {...rest} />
      {label != null && (
        <label className="as-choice__label" htmlFor={fieldId}>
          {label}
          {helpText && <span className="as-choice__help">{helpText}</span>}
        </label>
      )}
    </div>
  );
}
