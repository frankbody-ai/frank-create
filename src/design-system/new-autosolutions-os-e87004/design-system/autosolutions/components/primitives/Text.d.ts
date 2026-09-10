export type TextVariant = 'heading3xl' | 'heading2xl' | 'headingXl' | 'headingLg' | 'headingMd' | 'headingSm' | 'headingXs' | 'bodyLg' | 'bodyMd' | 'bodySm' | 'bodyXs';
export type TextTone = 'base' | 'secondary' | 'disabled' | 'inverse' | 'success' | 'critical' | 'warning' | 'caution' | 'info' | 'highlight' | 'ai';

export interface TextProps {
  /** Element to render. Defaults to h2 for heading variants, span for body. */
  as?: keyof JSX.IntrinsicElements;
  /** Applied type ramp step. Default 'bodyMd' (13/20 at weight 450). */
  variant?: TextVariant;
  tone?: TextTone;
  alignment?: 'start' | 'center' | 'end' | 'justify';
  /** Overrides the variant weight. 450 / 550 / 600 / 650. */
  fontWeight?: 'regular' | 'medium' | 'semibold' | 'bold';
  truncate?: boolean;
  /** Tabular figures — use for anything in a table column. */
  numeric?: boolean;
  mono?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Text(props: TextProps): JSX.Element;
