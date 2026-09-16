import type { ReactNode } from 'react';

export function StationAside({ children }: { children: ReactNode }) {
  return (
    <aside className="sticky top-8 hidden w-56 shrink-0 flex-col gap-6 self-start lg:flex">
      {children}
    </aside>
  );
}
