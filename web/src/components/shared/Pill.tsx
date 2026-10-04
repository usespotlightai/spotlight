import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PillProps = {
  children: ReactNode;
  lead?: ReactNode;
  title?: string;
  className?: string;
};

export function Pill({ children, lead, title, className }: PillProps) {
  return (
    <span
      title={title}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card py-1 font-medium text-muted-foreground text-xs',
        lead ? 'pr-2.5 pl-2' : 'px-2.5',
        className,
      )}
    >
      {lead}
      {children}
    </span>
  );
}
