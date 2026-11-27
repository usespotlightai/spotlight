import { ChevronRight } from 'lucide-react';
import type { ReactElement } from 'react';

export function CrumbSeparator(): ReactElement {
  return (
    <ChevronRight
      className="size-3.5 shrink-0 text-muted-foreground"
      aria-hidden
    />
  );
}
