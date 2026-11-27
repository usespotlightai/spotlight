import { ChevronRight } from 'lucide-react';

export function CrumbSeparator() {
  return (
    <ChevronRight
      className="size-3.5 shrink-0 text-muted-foreground"
      aria-hidden
    />
  );
}
