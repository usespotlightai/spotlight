import type { ReactNode } from 'react';

export function PanelActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto flex flex-wrap items-center justify-start gap-2 pt-3">
      {children}
    </div>
  );
}
