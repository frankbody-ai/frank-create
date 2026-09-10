export interface AppFrameProps {
  /** A <TopBar />. */
  topBar?: React.ReactNode;
  /** A <SideNav />. */
  navigation?: React.ReactNode;
  children?: React.ReactNode;
  /** Content column cap. Default 1260px; pass 1000px for single-column reading views. */
  maxWidth?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AppFrame(props: AppFrameProps): JSX.Element;
