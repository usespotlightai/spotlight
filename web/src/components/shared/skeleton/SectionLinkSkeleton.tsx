import type { ReactNode } from 'react';

export function SectionLinkSkeleton({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="py-0.5 text-muted-foreground text-xs">
      {children}
    </span>
  );
}
