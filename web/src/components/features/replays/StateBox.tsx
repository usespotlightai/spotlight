import type { ReactNode } from 'react';

export function StateBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center rounded-xl border border-border px-4 py-10">
      {children}
    </div>
  );
}
