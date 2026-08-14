import React from 'react';
import { Text } from '../primitives/Text';
import { IconButton } from '../actions/IconButton';

export interface ModalProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  open?: boolean;
  title?: React.ReactNode;
  /** 'small' 380 · 'medium' 620 · 'large' 980, or a px number. */
  size?: 'small' | 'medium' | 'large' | number;
  /** Escape and backdrop click both call this. */
  onClose?: () => void;
  /** Right-most footer action. */
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
}

const WIDTHS = { small: 380, medium: 620, large: 980 };

export function Modal({ open = false, title, size = 'medium', onClose, primaryAction, secondaryActions, children, className = '', style, ...rest }: ModalProps) {
  const layer = React.useRef<HTMLDivElement>(null);
  const restore = React.useRef<Element | null>(null);

  React.useEffect(() => {
    if (!open) return undefined;
    restore.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) { onClose(); return; }
      if (e.key !== 'Tab' || !layer.current) return;
      const focusable = layer.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const firstControl = layer.current?.querySelector<HTMLElement>('button,input,textarea,select,a[href]');
    firstControl?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      (restore.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="as-modal-layer" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={layer}>
      <div className="as-modal__backdrop" onClick={onClose} />
      <div className={['as-modal', className].filter(Boolean).join(' ')} style={{ width: typeof size === 'number' ? size : WIDTHS[size], ...style }} {...rest}>
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
