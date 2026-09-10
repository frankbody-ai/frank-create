export interface SkeletonProps {
  /** 'text' 12px · 'heading' 20px · 'block' 40px (or set `height`). */
  variant?: 'text' | 'heading' | 'block';
  width?: string | number;
  height?: string | number;
  /** Renders a paragraph of N lines, last one short. */
  lines?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton(props: SkeletonProps): JSX.Element;
