import React from 'react';
import { Icon } from '../media/Icon';
import { Text } from '../primitives/Text';
import { IconButton } from '../actions/IconButton';

export interface BannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'critical' | 'ai';
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  onDismiss?: () => void;
  icon?: string;
}

const ICONS: Record<string, string> = { info: 'information-circle', success: 'check-circle', warning: 'exclamation-triangle', critical: 'exclamation-circle', ai: 'sparkles' };

export function Banner({ title, tone = 'info', children, action, secondaryAction, onDismiss, icon, className = '', style, ...rest }: BannerProps) {
  return (
    <div className={['as-banner', `as-banner--${tone}`, className].filter(Boolean).join(' ')} role={tone === 'critical' ? 'alert' : 'status'} style={style} {...rest}>
      <Icon source={icon || ICONS[tone] || ICONS.info} size={20} tone={tone === 'ai' ? 'ai' : tone} className="as-banner__icon" />
      <div className="as-banner__body">
        {title && <Text variant="headingSm" as="h3">{title}</Text>}
        {children && <div className="as-banner__content">{children}</div>}
        {(action || secondaryAction) && <div className="as-banner__actions">{action}{secondaryAction}</div>}
      </div>
      {onDismiss && <IconButton icon="x-mark" label="Dismiss" size="micro" onClick={onDismiss} />}
    </div>
  );
}
