import type { ReactNode } from 'react';
import { TrailLink } from '@/components/shell/layout/TrailLink';

type SectionLinkProps = {
  to: string;
  children: ReactNode;
};

export function SectionLink({ to, children }: SectionLinkProps) {
  return (
    <TrailLink
      to={to}
      className="text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline"
    >
      {children}
    </TrailLink>
  );
}
