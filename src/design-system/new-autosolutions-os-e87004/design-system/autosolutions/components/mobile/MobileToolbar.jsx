import React from 'react';

/**
 * Sticky bottom action bar. On a phone the primary action cannot live in a
 * header the thumb can't reach, so form and editor screens pin it here.
 * Sits above the tab bar and carries the bottom safe inset itself.
 */
export function MobileToolbar({ children, note, className = '', style, ...rest }) {
  return (
    <div className={['as-m-toolbar', className].filter(Boolean).join(' ')} style={style} {...rest}>
      {note && <span className="as-m-toolbar__note">{note}</span>}
      <div className="as-m-toolbar__actions">{children}</div>
    </div>
  );
}
