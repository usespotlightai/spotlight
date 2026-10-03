import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type StepsFoldProps = {
  open: boolean;
  children: ReactNode;
};

export function StepsFold({ open, children }: StepsFoldProps) {
  return (
    <div
      inert={!open}
      className={cn(
        'grid transition-all duration-200 ease-out',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
