import type { ReactNode } from 'react';
import { SECTION_LINK } from '@/components/shared/section-link';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { cn } from '@/lib/utils';

type SectionLinkProps = {
  to: string;
  className?: string;
  children: ReactNode;
};

export function SectionLink({ to, className, children }: SectionLinkProps) {
  return (
    <TrailLink to={to} className={cn(SECTION_LINK, className)}>
      {children}
    </TrailLink>
  );
}
