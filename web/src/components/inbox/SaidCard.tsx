import type { ReactNode } from 'react';

export function SaidCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-2">
      {children}
    </div>
  );
}
