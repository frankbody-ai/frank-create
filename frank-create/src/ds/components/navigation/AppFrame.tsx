import React from 'react';

export interface AppFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A <TopBar />. */
  topBar?: React.ReactNode;
  /** A <SideNav />. */
  navigation?: React.ReactNode;
  /** Content column cap. Default 1260px; pass 1000px for single-column reading views. */
  maxWidth?: string;
}

/**
 * App shell: inverse top bar, 240px nav on #EBEBEB, and a content region
 * rounded 12px on its top-left corner so it reads as raised off the nav.
 */
export function AppFrame({ topBar, navigation, children, maxWidth = 'var(--page-max-width)', className = '', style, ...rest }: AppFrameProps) {
  return (
    <div className={['as-frame', className].filter(Boolean).join(' ')} style={style} {...rest}>
      {topBar}
      <div className="as-frame__body">
        {navigation && <div className="as-frame__nav">{navigation}</div>}
        <main className="as-frame__content">
          <div className="as-frame__page" style={{ maxWidth }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
