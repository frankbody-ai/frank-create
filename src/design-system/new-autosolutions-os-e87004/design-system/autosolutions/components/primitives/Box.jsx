import React from 'react';

const space = (v) => (v == null ? undefined : (typeof v === 'number' ? `${v}px` : `var(--space-${v})`));

export function Box({
  as: Tag = 'div', padding, paddingBlock, paddingInline, background, borderRadius, borderColor,
  borderWidth = '025', shadow, minHeight, width, maxWidth, overflow, children, className = '', style, ...rest
}) {
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
