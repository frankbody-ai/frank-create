import React from 'react';


export function Checkbox({ label, helpText, checked, defaultChecked, indeterminate = false, onChange, disabled = false, id, className = '', style, ...rest }) {
  const autoId = React.useId();
  const fieldId = id || `as-check-${autoId}`;
  const ref = React.useRef(null);
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
