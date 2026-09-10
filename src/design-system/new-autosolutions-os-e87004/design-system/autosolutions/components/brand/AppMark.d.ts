export interface AppDefinition {
  id: string;
  name: string;
  /** External app, opened in a new tab. */
  url?: string;
  group?: string;
  section?: string;
}

export interface AppMarkProps {
  /** App id. Artwork lives in assets/apps/<id>.png. */
  app: string;
  /** Overrides the accessible name. Defaults to the registered app name. */
  name?: string;
  /** 'default' 159×48 (the nav plate) · 'compact' 106×32 (switcher rows, lists). */
  size?: 'default' | 'compact';
  className?: string;
  style?: React.CSSProperties;
}

export function AppMark(props: AppMarkProps): JSX.Element;
/** The hub's applications, grouped as they appear in the switcher. */
export const APP_GROUPS: Array<{ group: string; sections: Array<{ title?: string; apps: AppDefinition[] }> }>;
/** Flat list of every app, each carrying its group and section. */
export const APPS: AppDefinition[];
