import type { ReactNode } from 'react';

export function EmptyFrame({ children }: { children: ReactNode }) {
  return <div className="flex justify-center py-10">{children}</div>;
}
