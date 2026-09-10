export interface GoogleButtonProps {
  /** Google's approved wording only: 'Sign in with Google' (default), 'Continue with Google', 'Sign up with Google'. */
  label?: string;
  /** Swaps the label to "Opening Google" and disables the control. */
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Default true — it is the primary action on a sign-in card. */
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function GoogleButton(props: GoogleButtonProps): JSX.Element;
