export interface SignedOutProps {
  /** One company id, or a pair when two parties own the app — e.g. ['frankbody','enxgy']. */
  company?: string | string[];
  /** Accessible name(s), matching the shape of `company`. */
  companyName?: string | string[];
  /** 'plain' (default) is the transparent-ground mark — correct on the white card. */
  companyVariant?: 'plain' | 'full';
  /** App id, e.g. 'asset-portal'. Renders the wordmark under the company mark. */
  app?: string;
  appName?: string;
  /** Uppercase micro-label above the title. */
  eyebrow?: string;
  /** Default 'You are signed out'. */
  title?: string;
  description?: React.ReactNode;
  /** The success check above the title. Default true. */
  confirmation?: boolean;
  /** Default 'Sign in'. */
  actionLabel?: string;
  onSignIn?: () => void;
  /** Renders the action as a link — the sign-in route. */
  signInUrl?: string;
  /** Extra control below the primary action, e.g. a plain "Switch account" button. */
  secondaryAction?: React.ReactNode;
  /** bodySm explainer above the AutoSolutions logo. */
  note?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function SignedOut(props: SignedOutProps): JSX.Element;
