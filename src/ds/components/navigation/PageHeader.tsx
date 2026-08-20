import React from 'react';
import { Icon } from '../media/Icon';
import { Text } from '../primitives/Text';
import { IconButton } from '../actions/IconButton';

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  /** Optional 20px leading icon. */
  icon?: string;
  subtitle?: React.ReactNode;
  /** Usually a Badge next to the title. */
  badge?: React.ReactNode;
  /** Shows a 28px tertiary back button to the left of the title. */
  backAction?: () => void;
  /** Action group, ordered secondary → secondary → menu → primary. */
  actions?: React.ReactNode;
}

/** Page title in headingXl with a right-aligned action group ordered secondary → menu → primary. */
export function PageHeader({ title, icon, subtitle, badge, backAction, actions, className = '', style, ...rest }: PageHeaderProps) {
  return (
    <div className={['as-page-header', className].filter(Boolean).join(' ')} style={style} {...rest}>
      <div className="as-page-header__title">
        {backAction && <IconButton icon="arrow-left" label="Back" variant="secondary" onClick={backAction} className="as-page-header__back" />}
        {icon && <Icon source={icon} size={20} />}
        <Text variant="headingXl" as="h1">{title}</Text>
        {badge}
      </div>
      {subtitle && <Text variant="bodySm" tone="secondary" className="as-page-header__subtitle">{subtitle}</Text>}
      {actions && <div className="as-page-header__actions">{actions}</div>}
    </div>
  );
}
