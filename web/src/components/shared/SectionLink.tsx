import type { ReactNode } from 'react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { cn } from '@/lib/utils';

type SectionLinkProps = {
  to: string;
  className?: string;
  children: ReactNode;
};

export function SectionLink({ to, className, children }: SectionLinkProps) {
  return (
    <TrailLink
      to={to}
      className={cn(
        '-mx-1.5 rounded-md px-1.5 py-0.5 text-muted-foreground text-xs outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      {children}
    </TrailLink>
  );
}
