export interface PhoneFrameProps {
  /** Caption under the device. */
  label?: React.ReactNode;
  /** Defaults to the 393×852 logical viewport. */
  width?: string | number;
  height?: string | number;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function PhoneFrame(props: PhoneFrameProps): JSX.Element;
