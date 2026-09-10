export interface SectionProps {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  /** 'flat' = inset grey block (level 2) · 'divided' = hairline-separated run. */
  variant?: 'flat' | 'divided';
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Section(props: SectionProps): JSX.Element;
