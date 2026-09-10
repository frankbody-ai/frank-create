The standard signed-out card — the other half of `SignIn`. Every AutoSolutions app uses this one, so a person leaving recognises the card they came in through.

```jsx
<AuthLayout>
  <SignedOut
    company="frankbody" companyName="frank body"
    app="asset-portal" appName="asset portal"
    signInUrl="/login"
    note="Close this tab if you're on a shared computer."
  />
</AuthLayout>
```

Structurally identical to `SignIn`: same lockup order (company mark → app wordmark → rule → message → AutoSolutions logo), same 400px column, same dialog-class surface. Only the middle changes — a success check, a confirmation line, and one primary action.

It takes `company` in both shapes `SignIn` does: one id renders large, `['frankbody','enxgy']` renders the pair at compact size either side of a hairline. Pass whatever the sign-in card passed — an exit card that drops an owner contradicts the entry card.

**It is a `<section>`, not a `<form>`.** Nothing here submits; the action is a link to the sign-in route. Pass `signInUrl` for real navigation, or `onSignIn` for a router push.

Copy states a fact and then what to do next, in that order — never "Goodbye!" or "See you soon". The default is *"You are signed out. Your session has ended on this device. Sign back in whenever you need it."* Use `note` for the shared-computer warning if the app needs it.
