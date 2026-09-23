import type { ReactNode } from 'react';

export function StationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 py-8">
        {children}
      </main>
    </div>
  );
}
