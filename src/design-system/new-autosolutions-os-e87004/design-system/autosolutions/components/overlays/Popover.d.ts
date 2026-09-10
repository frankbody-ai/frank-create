export interface PopoverProps {
  active?: boolean;
  /** The control that opens it — rendered inline, the panel anchors to it. */
  activator?: React.ReactNode;
  /** Fired on outside click and Escape. */
  onClose?: () => void;
  align?: 'start' | 'end';
  width?: string | number;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Popover(props: PopoverProps): JSX.Element;
