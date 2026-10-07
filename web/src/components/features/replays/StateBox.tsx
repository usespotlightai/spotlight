import type { ReactNode } from 'react';
import { useFlatLists } from '@/components/features/replays/FlatLists';
import { cn } from '@/lib/utils';

export function StateBox({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex justify-center px-4',
        useFlatLists()
          ? 'flex-1 items-center pt-2 pb-10'
          : 'rounded-xl border border-border py-10',
      )}
    >
      {children}
    </div>
  );
}
