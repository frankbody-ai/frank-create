export interface ThumbnailProps {
  source?: string;
  alt?: string;
  /** 'small' 28 · 'medium' 40 (the table row size) · 'large' 60, or a px number. */
  size?: 'small' | 'medium' | 'large' | number;
  className?: string;
  style?: React.CSSProperties;
}

export function Thumbnail(props: ThumbnailProps): JSX.Element;
