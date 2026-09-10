export interface SheetProps {
  open?: boolean;
  title?: React.ReactNode;
  /** 'auto' hugs its content · 'half' 52% · 'full' 88% of the viewport. */
  size?: 'auto' | 'half' | 'full';
  /** Backdrop tap and Escape both call this. */
  onClose?: () => void;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** The drag handle. Default true. */
  grabber?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Sheet(props: SheetProps): JSX.Element | null;
