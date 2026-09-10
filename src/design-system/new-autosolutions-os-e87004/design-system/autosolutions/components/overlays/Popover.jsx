import React from 'react';

/** Anchored overlay for menus and filters. shadow-300, 12px radius, 200ms ease-out. */
export function Popover({ active = false, activator, onClose, align = 'start', width, children, className = '', style, ...rest }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!active || !onClose) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [active, onClose]);
  return (
    <span className={['as-popover-wrap', className].filter(Boolean).join(' ')} ref={ref} style={style}>
      {activator}
      {active && (
        <div className={['as-popover', align === 'end' && 'as-popover--end'].filter(Boolean).join(' ')} style={{ width }} {...rest}>
          {children}
        </div>
      )}
    </span>
  );
}
