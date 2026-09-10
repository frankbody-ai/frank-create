export interface MobileToolbarProps {
  /** Buttons. They share the row equally. */
  children?: React.ReactNode;
  /** Centred bodySm line above the actions — unsaved-change counts, totals. */
  note?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function MobileToolbar(props: MobileToolbarProps): JSX.Element;
