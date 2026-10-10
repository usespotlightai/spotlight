import type { ReactNode } from 'react';
import { MemoryHead } from '@/components/features/memory/MemoryHead';

export function TeamMemoryTable({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pt-2 pb-1.5">
      <MemoryHead />

      <ul aria-label="Memories" className="flex flex-col">
        {children}
      </ul>
    </div>
  );
}
