export interface AvatarProps {
  /** Used for the tooltip and, when `initials` is absent, to derive them. */
  name?: string;
  initials?: string;
  /** 20 | 24 | 28 | 32 | 40 from the size scale. Radius scales with it. */
  size?: number;
  /** Force a palette entry. Omitted = hashed from `name`. */
  tone?: 'default' | 'one' | 'two' | 'three' | 'four' | 'five' | 'six' | 'seven';
  /** Image URL. Replaces the initials. */
  source?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Avatar(props: AvatarProps): JSX.Element;
