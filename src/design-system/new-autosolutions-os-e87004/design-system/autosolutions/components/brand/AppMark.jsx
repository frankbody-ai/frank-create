import React from 'react';

const SIZES = { compact: 'as-app--compact', default: '' };

export const APP_GROUPS = [
  { group: 'Marketing', sections: [
    { title: 'Revenue', apps: [
      { id: 'ad-management', name: 'ad management' },
      { id: 'shopify-sales', name: 'shopify sales' },
    ] },
    { title: 'Content & Social', apps: [
      { id: 'content-calendar', name: 'content calendar' },
      { id: 'social-simulator', name: 'social simulator' },
      { id: 'franks-kitchen', name: "frank's kitchen" },
      { id: 'shelf-simulator', name: 'shelf simulator' },
      { id: 'product-validator', name: 'product/idea validator' },
    ] },
    { title: 'Design', apps: [
      { id: 'design-studio', name: 'art-ificial design studio' },
    ] },
  ] },
  { group: 'Operations', sections: [
    { apps: [
      { id: 'label-maker', name: 'label maker', url: 'https://label-maker-app.lovable.app' },
      { id: 'asset-portal', name: 'asset portal' },
      { id: 'ops-hub', name: 'ops hub' },
    ] },
  ] },
  { group: 'Sales', sections: [
    { apps: [
      { id: 'growth-engine', name: 'growth engine' },
      { id: 'ecommerce-sales', name: 'e-commerce sales' },
      { id: 'smart-leadgen-crm', name: 'smart leadgen crm' },
    ] },
  ] },
  { group: 'Internal Comms', sections: [
    { apps: [
      { id: 'smart-comms-hub', name: 'smart comms hub' },
    ] },
  ] },
  { group: 'Finance', sections: [
    { apps: [
      { id: 'banking-balance', name: 'banking balance' },
    ] },
  ] },
];

export const APPS = APP_GROUPS.flatMap((g) => g.sections.flatMap((s) => s.apps.map((a) => ({ ...a, group: g.group, section: s.title }))));

/** One application's generated label, at the nav-plate size or the compact list size. */
export function AppMark({ app, name, size = 'default', className = '', style, ...rest }) {
  const label = name || (APPS.find((a) => a.id === app) || {}).name || app;
  return (
    <span
      className={['as-app', `as-app--${app}`, SIZES[size], className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
      title={label}
      style={style}
      {...rest}
    />
  );
}
