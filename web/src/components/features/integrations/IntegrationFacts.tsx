import type { ReactNode } from 'react';

export function IntegrationFacts({ children }: { children: ReactNode }) {
  return (
    <dl className="flex flex-col gap-1 pt-3 pr-4 pb-4 pl-12">{children}</dl>
  );
}
