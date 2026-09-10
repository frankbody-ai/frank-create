export interface LogoProps {
  /** Locked heights: 'default' 20px (app top bar) · 'compact' 16px · 'large' 28px. */
  size?: 'default' | 'compact' | 'large';
  /** Use the white cut. Only for a surface where the magenta would clash — the
   *  magenta default is correct on the dark top bar. */
  inverse?: boolean;
  /** Centre the mark in the 240×56 shell slot. */
  slot?: boolean;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Logo(props: LogoProps): JSX.Element;
