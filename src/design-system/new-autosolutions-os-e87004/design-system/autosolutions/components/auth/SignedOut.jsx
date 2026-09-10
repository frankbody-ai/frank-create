import React from 'react';
import { Button } from '../actions/Button.jsx';
import { Icon } from '../media/Icon.jsx';

/**
 * The standard signed-out card. Structurally identical to SignIn — same
 * lockup order, same surface, same 400px column — because a person who has
 * just left an app should recognise the card they came in through.
 *
 *   company mark → app wordmark → rule → confirmation → AutoSolutions logo
 */
export function SignedOut({
  company,
  companyName,
  companyVariant = 'plain',
  app,
  appName,
  eyebrow,
  title = 'You are signed out',
  description = 'Your session has ended on this device. Sign back in whenever you need it.',
  confirmation = true,
  actionLabel = 'Sign in',
  onSignIn,
  signInUrl,
  secondaryAction,
  note,
  footer,
  className = '',
  style,
  ...rest
}) {
  // One mark, or a pair when two parties own the app — identical to SignIn,
  // so the exit card never contradicts the entry card.
  const companies = company == null ? [] : (Array.isArray(company) ? company : [company]);
  const names = companyName == null ? [] : (Array.isArray(companyName) ? companyName : [companyName]);

  return (
    <section className={['as-auth', 'as-auth--signed-out', className].filter(Boolean).join(' ')} style={style} {...rest}>
      <div className="as-auth__brand">
        {companies.length > 0 && (
          <div className={['as-auth__marks', companies.length > 1 && 'as-auth__marks--pair'].filter(Boolean).join(' ')}>
            {companies.map((id, i) => (
              <React.Fragment key={id}>
                {i > 0 && <span className="as-auth__marks-rule" aria-hidden="true" />}
                <span
                  className={['as-company', `as-company--${id}`, companies.length > 1 ? 'as-company--compact' : 'as-company--large', companyVariant === 'plain' && 'as-company--ink'].filter(Boolean).join(' ')}
                  role="img"
                  aria-label={names[i] || id}
                />
              </React.Fragment>
            ))}
          </div>
        )}
        {app && <span className={`as-app as-app--${app} as-app--large as-app--center`} role="img" aria-label={appName || app} />}
      </div>

      <hr className="as-auth__rule" />

      <div className="as-auth__head">
        {confirmation && (
          <span className="as-auth__confirm" aria-hidden="true">
            <Icon source="check" size={20} tone="inherit" />
          </span>
        )}
        {eyebrow && <span className="as-auth__eyebrow">{eyebrow}</span>}
        <h1 className="as-auth__title">{title}</h1>
        {description && <p className="as-auth__description">{description}</p>}
      </div>

      <Button variant="primary" size="large" fullWidth url={signInUrl} onClick={onSignIn}>{actionLabel}</Button>
      {secondaryAction}

      <div className="as-auth__foot">
        {note && <p className="as-auth__note">{note}</p>}
        {footer}
        <span className="as-auth__os as-logo" role="img" aria-label="AutoSolutions OS" />
      </div>
    </section>
  );
}
