import React from 'react';

/**
 * The mobile app shell: status strip, top bar, scrolling content, tab bar.
 * The mobile counterpart to AppFrame — same job, thumb-sized.
 */
export function MobileFrame({ topBar, tabBar, toolbar, statusBar = true, background = 'bg', children, className = '', style, ...rest }) {
  return (
    <div
      className={['as-m-frame', className].filter(Boolean).join(' ')}
      style={{ background: `var(--color-${background})`, ...style }}
      {...rest}
    >
      {statusBar && <StatusBar />}
      {topBar}
      <main className="as-m-frame__content">{children}</main>
      {toolbar}
      {tabBar}
    </div>
  );
}

/** The OS strip. Present so layouts are designed against the real available height. */
export function StatusBar({ time = '9:41', className = '', ...rest }) {
  return (
    <div className={['as-m-status', className].filter(Boolean).join(' ')} aria-hidden="true" {...rest}>
      <span className="as-m-status__time">{time}</span>
      <span className="as-m-status__glyphs">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 11.5 5.6 8.8a3.6 3.6 0 0 1 4.8 0L8 11.5Zm-4.1-4.6A7.9 7.9 0 0 1 8 5.3c1.6 0 3 .6 4.1 1.6l1.4-1.6A10.1 10.1 0 0 0 8 3a10.1 10.1 0 0 0-5.5 2.3l1.4 1.6Z"/></svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor"/><path d="M23 4v4a2.3 2.3 0 0 0 0-4Z" fill="currentColor" opacity=".5"/></svg>
      </span>
    </div>
  );
}
