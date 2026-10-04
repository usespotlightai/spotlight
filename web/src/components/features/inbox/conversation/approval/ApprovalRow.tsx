import type { ReactNode } from 'react';

export function ApprovalRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 py-2 first:pt-0 last:pb-0">
      {children}
    </div>
  );
}
