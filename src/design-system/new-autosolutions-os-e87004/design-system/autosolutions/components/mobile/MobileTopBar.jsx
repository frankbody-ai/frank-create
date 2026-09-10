import React from 'react';
import { Icon } from '../media/Icon.jsx';

/**
 * The mobile header. 56px, light surface with a hairline — the phone does NOT
 * get the desktop's inverse bar, which would eat a tenth of a 390px screen.
 * `large` renders the iOS-style large title beneath the bar row.
 */
export function MobileTopBar({
  title, size = 'default', backAction, backLabel = 'Back', app, appName,
  actions, subtitle, sticky = true, className = '', style, ...rest
}) {
  return (
    <header
      className={['as-m-topbar', `as-m-topbar--${size}`, sticky && 'is-sticky', className].filter(Boolean).join(' ')}
      style={style}
      {...rest}
    >
      <div className="as-m-topbar__row">
        {backAction
          ? (
            <button type="button" className="as-m-topbar__back" onClick={backAction} aria-label={backLabel}>
              <Icon source="chevron-left" size={24} tone="inherit" />
            </button>
          )
          : app
            ? <span className={`as-app as-app--${app} as-app--compact`} role="img" aria-label={appName || app} />
            : null}
        {size === 'default' && title && <h1 className="as-m-topbar__title">{title}</h1>}
        <div className="as-m-topbar__actions">{actions}</div>
      </div>
      {size === 'large' && (
        <div className="as-m-topbar__large">
          <h1 className="as-m-topbar__large-title">{title}</h1>
          {subtitle && <p className="as-m-topbar__subtitle">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}
