import type { ReactNode } from 'react';

export function SidebarHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-7 items-center px-2">
      <h2 className="font-medium text-muted-foreground text-xs">{children}</h2>
    </div>
  );
}
