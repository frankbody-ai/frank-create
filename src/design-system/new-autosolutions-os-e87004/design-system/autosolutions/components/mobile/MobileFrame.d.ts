/**
 * @startingPoint section="Screens" subtitle="Phone app shell — status strip, top bar, scrolling content, tab bar" viewport="393x852"
 */
export interface MobileFrameProps {
  /** A <MobileTopBar />. */
  topBar?: React.ReactNode;
  /** A <TabBar />. Omit on a pushed detail screen. */
  tabBar?: React.ReactNode;
  /** A <MobileToolbar /> — sits between content and the tab bar. */
  toolbar?: React.ReactNode;
  /** Show the OS status strip. Default true, so layouts are designed against the real height. */
  statusBar?: boolean;
  /** Canvas token without the `--color-` prefix. Default 'bg'. */
  background?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function MobileFrame(props: MobileFrameProps): JSX.Element;

export interface StatusBarProps {
  time?: string;
  className?: string;
}

export function StatusBar(props: StatusBarProps): JSX.Element;
