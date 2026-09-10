export interface BoxProps {
  as?: keyof JSX.IntrinsicElements;
  /** Space token key ('400') or px number. */
  padding?: string | number;
  paddingBlock?: string | number;
  paddingInline?: string | number;
  /** Colour token name without the `--color-` prefix, e.g. 'bg-surface'. */
  background?: string;
  /** Radius token key: '200' for controls, '300' for containers. */
  borderRadius?: string;
  borderColor?: string;
  borderWidth?: string;
  /** Elevation token key: '100' card, '300' popover, '400' modal. */
  shadow?: string;
  minHeight?: string | number;
  width?: string | number;
  maxWidth?: string | number;
  overflow?: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Box(props: BoxProps): JSX.Element;
