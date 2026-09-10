import React from 'react';

/**
 * Device bezel for presenting a mobile screen on a desktop page. A preview
 * device, not product chrome — never ship it inside an app.
 */
export function PhoneFrame({ label, width, height, children, className = '', style, ...rest }) {
  return (
    <div className={['as-m-phone', className].filter(Boolean).join(' ')} style={style} {...rest}>
      <div
        className="as-m-phone__screen"
        style={{ width: width || 'var(--m-viewport-width)', height: height || 'var(--m-viewport-height)' }}
      >
        <span className="as-m-phone__notch" aria-hidden="true" />
        {children}
        <span className="as-m-phone__home" aria-hidden="true" />
      </div>
      {label && <span className="as-m-phone__label">{label}</span>}
    </div>
  );
}
