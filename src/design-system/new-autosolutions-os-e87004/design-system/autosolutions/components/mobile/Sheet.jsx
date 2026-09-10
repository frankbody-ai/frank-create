import React from 'react';

/**
 * Bottom sheet — the mobile stand-in for Popover AND Modal. Anchored overlays
 * need a cursor; a sheet rises into the thumb. Put an ActionList inside it for
 * a menu, or form fields for a full-screen task.
 */
export function Sheet({
  open = false, title, size = 'auto', onClose, primaryAction, secondaryAction,
  grabber = true, children, className = '', style, ...rest
}) {
  React.useEffect(() => {
    if (!open || !onClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="as-m-sheet-layer" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="as-m-sheet__backdrop" onClick={onClose} />
      <div className={['as-m-sheet', `as-m-sheet--${size}`, className].filter(Boolean).join(' ')} style={style} {...rest}>
        {grabber && <span className="as-m-sheet__grabber" aria-hidden="true" />}
        {title && (
          <header className="as-m-sheet__header">
            <h2 className="as-m-sheet__title">{title}</h2>
            {onClose && <button type="button" className="as-m-sheet__close" onClick={onClose} aria-label="Close">Done</button>}
          </header>
        )}
        <div className="as-m-sheet__body">{children}</div>
        {(primaryAction || secondaryAction) && (
          <footer className="as-m-sheet__footer">{secondaryAction}{primaryAction}</footer>
        )}
      </div>
    </div>
  );
}
