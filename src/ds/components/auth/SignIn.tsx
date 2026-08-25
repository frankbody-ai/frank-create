import React from 'react';
import { Button } from '../actions/Button';
import { TextField } from '../forms/TextField';
import { Checkbox } from '../forms/Checkbox';
import { Banner } from '../feedback/Banner';

export interface SignInProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'title'> {
  company?: string | string[] | null;
  companyName?: string | (string | undefined)[] | null;
  companyVariant?: 'plain' | 'tile';
  app?: string;
  appName?: string;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** 'sso' hides the email/password form entirely. */
  method?: 'password' | 'link' | 'sso';
  email?: string;
  onEmailChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  password?: string;
  onPasswordChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  remember?: boolean;
  onRememberChange?: (checked: boolean) => void;
  error?: React.ReactNode;
  loading?: boolean;
  submitLabel?: string;
  onSubmit?: (values: { email?: string; password?: string; remember?: boolean }) => void;
  forgotAction?: React.ReactNode;
  providers?: React.ReactNode;
  note?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * The standard sign-in card. Every AutoSolutions app uses this, so the
 * order of the lockup never varies: company mark, app wordmark, rule,
 * the form, then the AutoSolutions logo pinned at the very bottom.
 */
export function SignIn({
  company, companyName, companyVariant = 'plain', app, appName,
  eyebrow, title = 'Sign in', description, method = 'password',
  email, onEmailChange, password, onPasswordChange, remember, onRememberChange,
  error, loading = false, submitLabel, onSubmit, forgotAction, providers,
  note, footer, className = '', style, ...rest
}: SignInProps) {
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (onSubmit) onSubmit({ email, password, remember }); };
  const label = submitLabel || (method === 'link' ? 'Email me a sign-in link' : 'Sign in');
  // One mark, or a pair when two parties own the app (client + operator).
  const companies = company == null ? [] : (Array.isArray(company) ? company : [company]);
  const names = companyName == null ? [] : (Array.isArray(companyName) ? companyName : [companyName]);

  return (
    <form className={['as-auth', className].filter(Boolean).join(' ')} onSubmit={submit} style={style} {...rest}>
      <div className="as-auth__brand">
        {companies.length > 0 && (
          <div className={['as-auth__marks', companies.length > 1 && 'as-auth__marks--pair'].filter(Boolean).join(' ')}>
            {companies.map((id, i) => (
              <span
                key={id}
                className={['as-company', `as-company--${id}`, companies.length > 1 ? 'as-company--compact' : 'as-company--large', companyVariant === 'plain' && 'as-company--plain'].filter(Boolean).join(' ')}
                role="img"
                aria-label={names[i] || id}
              />
            ))}
          </div>
        )}
        {app && <span className={`as-app as-app--${app} as-app--large as-app--center`} role="img" aria-label={appName || app} />}
      </div>

      <hr className="as-auth__rule" />

      <div className="as-auth__head">
        {eyebrow && <span className="as-auth__eyebrow">{eyebrow}</span>}
        <h1 className="as-auth__title">{title}</h1>
        {description && <p className="as-auth__description">{description}</p>}
      </div>

      {error && <Banner tone="critical">{error}</Banner>}

      {providers && (
        <div className="as-auth__providers">
          {providers}
          {method !== 'sso' && <span className="as-auth__or">or</span>}
        </div>
      )}

      {method !== 'sso' && (
        <div className="as-auth__form">
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            value={email}
            onChange={onEmailChange}
            requiredIndicator
          />
          {method === 'password' && (
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={onPasswordChange}
              requiredIndicator
            />
          )}
          {(onRememberChange || forgotAction) && (
            <div className="as-auth__aside">
              {onRememberChange
                ? <Checkbox label="Keep me signed in" checked={remember} onChange={(e) => onRememberChange(e.target.checked)} />
                : <span />}
              {forgotAction}
            </div>
          )}
        </div>
      )}

      {method !== 'sso' && <Button variant="primary" size="large" fullWidth loading={loading} type="submit">{label}</Button>}

      <div className="as-auth__foot">
        {note && <p className="as-auth__note">{note}</p>}
        {footer}
        <span className="as-auth__os as-logo" role="img" aria-label="AutoSolutions OS" />
      </div>
    </form>
  );
}
