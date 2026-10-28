import type { ReactNode } from 'react';
import { MemoryHead } from '@/components/features/memory/MemoryHead';
import { ScrollArea } from '@/components/ui/scroll-area';

export function TeamMemoryTable({ children }: { children: ReactNode }) {
  return (
    <ScrollArea
      className="min-h-0 flex-1"
      contentClassName="min-h-full px-1.5 pt-2 pb-1.5"
    >
      <MemoryHead />

      <ul aria-label="Memories" className="flex flex-col">
        {children}
      </ul>
    </ScrollArea>
  );
}
