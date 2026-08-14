import React from 'react';

export interface BoxProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
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
}

const space = (v?: string | number) => (v == null ? undefined : (typeof v === 'number' ? `${v}px` : `var(--space-${v})`));

export function Box({
  as: Tag = 'div', padding, paddingBlock, paddingInline, background, borderRadius, borderColor,
  borderWidth = '025', shadow, minHeight, width, maxWidth, overflow, children, className = '', style, ...rest
}: BoxProps) {
  return (
    <Tag
      className={['as-box', className].filter(Boolean).join(' ')}
      style={{
        padding: space(padding),
        paddingBlock: space(paddingBlock),
        paddingInline: space(paddingInline),
        background: background ? `var(--color-${background})` : undefined,
        borderRadius: borderRadius ? `var(--radius-${borderRadius})` : undefined,
        border: borderColor ? `var(--border-width-${borderWidth}) solid var(--color-${borderColor})` : undefined,
        boxShadow: shadow ? `var(--shadow-${shadow})` : undefined,
        minHeight, width, maxWidth, overflow,
        ...style,
      }}
      {...rest}
    >{children}</Tag>
  );
}
