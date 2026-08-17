import React from 'react';

/** Centres a SignIn card on the app canvas. Use as the whole page body. */
export function AuthLayout({ children, className = '', style, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['as-auth-page', className].filter(Boolean).join(' ')} style={style} {...rest}>
      {children}
    </div>
  );
}
