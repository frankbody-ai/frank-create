export interface MobileTopBarProps {
  title?: React.ReactNode;
  /** 'default' 56px inline title · 'large' adds the iOS-style large title row beneath. */
  size?: 'default' | 'large';
  /** Renders a 44px back chevron in place of the app wordmark. */
  backAction?: () => void;
  backLabel?: string;
  /** App id — renders the compact wordmark at the leading edge on root screens. */
  app?: string;
  appName?: string;
  /** Trailing controls. IconButtons grow to 44px automatically here. */
  actions?: React.ReactNode;
  /** Only rendered with size="large". */
  subtitle?: React.ReactNode;
  sticky?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function MobileTopBar(props: MobileTopBarProps): JSX.Element;
