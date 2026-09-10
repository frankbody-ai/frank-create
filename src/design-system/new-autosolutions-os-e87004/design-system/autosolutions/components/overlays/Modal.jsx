import React from 'react';
import { Text } from '../primitives/Text.jsx';
import { IconButton } from '../actions/IconButton.jsx';

const WIDTHS = { small: 380, medium: 620, large: 980 };

export function Modal({ open = false, title, size = 'medium', onClose, primaryAction, secondaryActions, children, className = '', style, ...rest }) {
  React.useEffect(() => {
    if (!open || !onClose) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="as-modal-layer" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="as-modal__backdrop" onClick={onClose} />
      <div className={['as-modal', className].filter(Boolean).join(' ')} style={{ width: WIDTHS[size] || size, ...style }} {...rest}>
        <header className="as-modal__header">
          {typeof title === 'string' ? <Text variant="headingLg" as="h2">{title}</Text> : title}
          {onClose && <IconButton icon="x-mark" label="Close" onClick={onClose} />}
        </header>
        <div className="as-modal__body">{children}</div>
        {(primaryAction || secondaryActions) && (
          <footer className="as-modal__footer">{secondaryActions}{primaryAction}</footer>
        )}
      </div>
    </div>
  );
}
