export interface PageHeaderProps {
  title: React.ReactNode;
  /** Optional 20px leading icon. */
  icon?: string;
  subtitle?: React.ReactNode;
  /** Usually a Badge next to the title. */
  badge?: React.ReactNode;
  /** Shows a 28px tertiary back button to the left of the title. */
  backAction?: () => void;
  /** Action group, ordered secondary → secondary → menu → primary. */
  actions?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function PageHeader(props: PageHeaderProps): JSX.Element;
