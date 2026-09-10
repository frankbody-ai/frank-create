The standard sign-in card. Every AutoSolutions app uses this one, so a partner who signs in to two of them sees the same card twice with different marks.

```jsx
<AuthLayout>
  <SignIn
    company="frankbody" app="asset-portal" appName="asset portal"
    eyebrow="Partner access"
    description="Use the email address the frank body team set your account up with."
    email={email} onEmailChange={e => setEmail(e.target.value)}
    password={pw} onPasswordChange={e => setPw(e.target.value)}
    onRememberChange={setRemember} remember={remember}
    forgotAction={<Button variant="plain">Forgot password</Button>}
    error={error} loading={busy} onSubmit={signIn}
    note="No sign-up here — accounts are created by frank body staff. Ask your account manager for access."
  />
</AuthLayout>
```

**The lockup order is fixed**: company mark → app wordmark → hairline rule → form → AutoSolutions logo pinned at the bottom. Whose product it is, then which product, then who runs it. Don't rearrange it per app, and don't drop the AutoSolutions logo — it's the only thing every card shares.

When two parties own the app — a client and the operator building for them — pass both: `company={['frankbody','enxgy']}`. The pair renders at compact size either side of a hairline; a single mark renders large.

Three methods: `password` (default), `link` for magic-link apps, `sso` for providers only. Pass `providers` alongside any of them to put SSO buttons above an "or" rule.

The card is a **modal-class surface** — 20px radius, `--shadow-400`, 32px padding — because it floats alone on the canvas rather than sitting in a page column. That's the one place those values are correct outside a modal.

The company mark defaults to the **`plain` (transparent-ground) variant**. The full-colour assets carry the company's own colour plate, which drops a decorative colour field onto an otherwise achromatic card. Pass `companyVariant="full"` only if a brand genuinely requires its plate.

Errors go in the critical Banner above the form (wrong password, locked account). Field-scoped problems still belong inline on the field itself.
