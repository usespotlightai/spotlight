import type { ReactNode } from 'react';

export function DecisionControls({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}
