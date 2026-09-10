/**
 * @startingPoint section="Screens" subtitle="The standard sign-in card — company, app, form, AutoSolutions logo" viewport="700x560"
 */
export interface SignInProps {
  /** One company id, or a pair when two parties own the app — e.g. ['frankbody','enxgy']. */
  company?: string | string[];
  /** Accessible name(s), matching the shape of `company`. */
  companyName?: string | string[];
  /** 'plain' (default) is the transparent-ground mark — correct on the white card.
   *  'full' carries the company's own colour plate; only use it if a brand demands it. */
  companyVariant?: 'plain' | 'full';
  /** App id, e.g. 'asset-portal'. Renders the wordmark under the company mark. */
  app?: string;
  appName?: string;
  /** Uppercase micro-label above the title, e.g. 'Partner access'. */
  eyebrow?: string;
  /** Default 'Sign in'. */
  title?: string;
  description?: React.ReactNode;
  /** 'password' email + password (default) · 'link' email only · 'sso' providers only. */
  method?: 'password' | 'link' | 'sso';
  email?: string;
  onEmailChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  password?: string;
  onPasswordChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  remember?: boolean;
  /** Supplying this renders the "Keep me signed in" checkbox. */
  onRememberChange?: (next: boolean) => void;
  /** Message for the critical Banner above the form. */
  error?: React.ReactNode;
  loading?: boolean;
  /** Defaults to 'Sign in', or 'Email me a sign-in link' when method is 'link'. */
  submitLabel?: string;
  onSubmit?: (values: { email?: string; password?: string; remember?: boolean }) => void;
  /** Usually a plain Button, right-aligned next to the remember checkbox. */
  forgotAction?: React.ReactNode;
  /** SSO buttons, rendered above an "or" rule. */
  providers?: React.ReactNode;
  /** bodySm explainer under the button — who creates accounts, who to ask. */
  note?: React.ReactNode;
  /** Extra nodes between the note and the AutoSolutions logo. */
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function SignIn(props: SignInProps): JSX.Element;
