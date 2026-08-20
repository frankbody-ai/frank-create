import React from 'react';

export type TextVariant = 'heading3xl' | 'heading2xl' | 'headingXl' | 'headingLg' | 'headingMd' | 'headingSm' | 'headingXs' | 'bodyLg' | 'bodyMd' | 'bodySm' | 'bodyXs';
export type TextTone = 'base' | 'secondary' | 'disabled' | 'inverse' | 'success' | 'critical' | 'warning' | 'caution' | 'info' | 'highlight' | 'ai';

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to h2 for heading variants, span for body. */
  as?: React.ElementType;
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
}

const VARIANTS: Record<TextVariant, string> = {
  heading3xl: 'as-text--heading-3xl', heading2xl: 'as-text--heading-2xl', headingXl: 'as-text--heading-xl',
  headingLg: 'as-text--heading-lg', headingMd: 'as-text--heading-md', headingSm: 'as-text--heading-sm',
  headingXs: 'as-text--heading-xs', bodyLg: 'as-text--body-lg', bodyMd: 'as-text--body-md',
  bodySm: 'as-text--body-sm', bodyXs: 'as-text--body-xs',
};
const TONES: Record<TextTone, string> = {
  base: 'var(--color-text)', secondary: 'var(--color-text-secondary)', disabled: 'var(--color-text-disabled)',
  inverse: 'var(--color-text-inverse)', success: 'var(--color-text-success)', critical: 'var(--color-text-critical)',
  warning: 'var(--color-text-warning)', caution: 'var(--color-text-caution)', info: 'var(--color-text-info)',
  highlight: 'var(--color-text-highlight)', ai: 'var(--color-text-ai)',
};
const WEIGHTS = { regular: 450, medium: 550, semibold: 600, bold: 650 } as const;

export function Text({
  as, variant = 'bodyMd', tone = 'base', alignment, fontWeight, truncate = false,
  numeric = false, mono = false, children, className = '', style, ...rest
}: TextProps) {
  const Tag: React.ElementType = as || (variant.startsWith('heading') ? 'h2' : 'span');
  return (
    <Tag
      className={['as-text', VARIANTS[variant] || VARIANTS.bodyMd, truncate && 'as-text--truncate', numeric && 'as-tabular', className].filter(Boolean).join(' ')}
      style={{
        color: TONES[tone] || TONES.base,
        textAlign: alignment,
        fontWeight: fontWeight ? WEIGHTS[fontWeight] : undefined,
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        ...style,
      }}
      {...rest}
    >{children}</Tag>
  );
}
