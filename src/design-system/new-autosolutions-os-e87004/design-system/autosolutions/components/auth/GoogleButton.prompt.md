The official Google sign-in button. **This is the main sign-in method across AutoSolutions apps** — most of them authenticate through a Google work account, so this is usually the only control on the card.

```jsx
<SignIn
  company={['frankbody','enxgy']} app="smart-leadgen-crm"
  method="sso"
  providers={<GoogleButton onClick={signInWithGoogle} loading={busy} />}
  note="Access is limited to frankbody.com and autosolutions.ai."
/>
```

**Google's brand guidelines govern this control, not ours.** The four-colour G is unmodified at 18px with its own clear space, the label wording is theirs, the surface is white with a `#747775` hairline, and the minimum height is 40px — taller than the system's `large` button on purpose. Don't recolour the mark, don't put it on a dark or brand fill, don't swap the G for a monochrome glyph, and don't reword the label beyond Google's approved set ("Sign in with", "Continue with", "Sign up with").

When it's the only method, pass `method="sso"` — the card then hides the email form and its own submit button, so Google's button is the single action.
