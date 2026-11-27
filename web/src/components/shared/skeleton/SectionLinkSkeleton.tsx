import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export function SectionLinkSkeleton({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center gap-0.5 py-0.5 text-muted-foreground text-xs"
    >
      {children}
      <ChevronRight className="size-3 shrink-0" />
    </span>
  );
}
