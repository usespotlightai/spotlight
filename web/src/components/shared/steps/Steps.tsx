import type { ReactNode } from 'react';

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="flex flex-col [counter-reset:step]">{children}</ol>;
}
