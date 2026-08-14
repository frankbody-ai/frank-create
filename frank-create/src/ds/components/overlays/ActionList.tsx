import React from 'react';
import { Icon } from '../media/Icon';

export interface ActionListItem {
  content: string;
  icon?: string;
  destructive?: boolean;
  active?: boolean;
  disabled?: boolean;
  suffix?: React.ReactNode;
  onAction?: () => void;
}

export interface ActionListSection { title?: string; items: ActionListItem[] }

export interface ActionListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Grouped items, separated by a hairline. */
  sections?: ActionListSection[];
  /** Shorthand for a single ungrouped section. */
  items?: ActionListItem[];
  onAction?: (item: ActionListItem) => void;
}

/** Menu body for a Popover. Sections are separated by a hairline, not a heading, unless titled. */
export function ActionList({ sections, items, onAction, className = '', style, ...rest }: ActionListProps) {
  const groups: ActionListSection[] = sections || [{ items: items || [] }];
  return (
    <div className={['as-actionlist', className].filter(Boolean).join(' ')} style={style} {...rest}>
      {groups.map((section, i) => (
        <div className="as-actionlist__section" key={section.title || i}>
          {section.title && <div className="as-actionlist__title">{section.title}</div>}
          {section.items.map((item) => (
            <button
              key={item.content}
              type="button"
              className={['as-actionlist__item', item.destructive && 'is-destructive', item.active && 'is-active', item.disabled && 'is-disabled'].filter(Boolean).join(' ')}
              disabled={item.disabled}
              onClick={() => { if (item.onAction) item.onAction(); if (onAction) onAction(item); }}
            >
              {item.icon && <Icon source={item.icon} size={16} tone="inherit" />}
              <span className="as-actionlist__label">{item.content}</span>
              {item.suffix}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
