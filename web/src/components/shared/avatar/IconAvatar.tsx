import type { ReactNode } from 'react';

export function IconAvatar({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground [&_svg]:size-3.5">
      {children}
    </span>
  );
}
