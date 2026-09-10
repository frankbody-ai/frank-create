export interface ModalProps {
  open?: boolean;
  title?: React.ReactNode;
  /** 'small' 380 · 'medium' 620 · 'large' 980, or a px number. */
  size?: 'small' | 'medium' | 'large' | number;
  /** Escape and backdrop click both call this. */
  onClose?: () => void;
  /** Right-most footer action. */
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Modal(props: ModalProps): JSX.Element | null;
