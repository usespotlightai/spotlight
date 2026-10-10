import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type StateBoxProps = {
  flat?: boolean;
  children: ReactNode;
};

export function StateBox({ flat = false, children }: StateBoxProps) {
  return (
    <div
      className={cn(
        'flex justify-center px-4',
        flat
          ? 'flex-1 items-center pt-2 pb-10'
          : 'rounded-xl border border-border py-10',
      )}
    >
      {children}
    </div>
  );
}
