export interface SegmentedOption { id: string; label: string; count?: number }

export interface SegmentedControlProps {
  /** Strings or {id, label, count} objects. */
  options?: (string | SegmentedOption)[];
  selected?: string;
  onSelect?: (id: string) => void;
  /** 'segmented' pill-in-a-well for 2–4 options · 'scroll' chip row for longer lists. */
  variant?: 'segmented' | 'scroll';
  className?: string;
  style?: React.CSSProperties;
}

export function SegmentedControl(props: SegmentedControlProps): JSX.Element;
