import React from 'react';

const VARIANTS = {
  heading3xl: 'as-text--heading-3xl', heading2xl: 'as-text--heading-2xl', headingXl: 'as-text--heading-xl',
  headingLg: 'as-text--heading-lg', headingMd: 'as-text--heading-md', headingSm: 'as-text--heading-sm',
  headingXs: 'as-text--heading-xs', bodyLg: 'as-text--body-lg', bodyMd: 'as-text--body-md',
  bodySm: 'as-text--body-sm', bodyXs: 'as-text--body-xs',
};
const TONES = {
  base: 'var(--color-text)', secondary: 'var(--color-text-secondary)', disabled: 'var(--color-text-disabled)',
  inverse: 'var(--color-text-inverse)', success: 'var(--color-text-success)', critical: 'var(--color-text-critical)',
  warning: 'var(--color-text-warning)', caution: 'var(--color-text-caution)', info: 'var(--color-text-info)',
  highlight: 'var(--color-text-highlight)', ai: 'var(--color-text-ai)',
};
const WEIGHTS = { regular: 450, medium: 550, semibold: 600, bold: 650 };

export function Text({
  as, variant = 'bodyMd', tone = 'base', alignment, fontWeight, truncate = false,
  numeric = false, mono = false, children, className = '', style, ...rest
}) {
  const Tag = as || (variant.startsWith('heading') ? 'h2' : 'span');
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
