export type IconTone = 'base' | 'secondary' | 'hover' | 'active' | 'disabled' | 'inverse' | 'success' | 'critical' | 'warning' | 'caution' | 'info' | 'highlight' | 'ai' | 'inherit';

export interface IconProps {
  /** Icon name from /assets/icons (e.g. 'bolt'), or an explicit path to an SVG. */
  source: string;
  /** 20 for almost everything, 16 for inline and dense contexts. */
  size?: 20 | 16 | number;
  /** Defaults to 'base' (#4A4A4A). Use 'inherit' inside buttons and links. */
  tone?: IconTone;
  /** Sets role="img" + aria-label. Omit for decorative icons (they are aria-hidden). */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Every bundled glyph name, sorted alphabetically. */
export const ICON_NAMES: string[];

export function Icon(props: IconProps): JSX.Element;
