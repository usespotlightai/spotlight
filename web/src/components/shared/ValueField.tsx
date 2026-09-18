import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ValueFieldProps = {
  value: string;
  children: ReactNode;
  className?: string;
};

export function ValueField({ value, children, className }: ValueFieldProps) {
  return (
    <span
      className={cn(
        'flex h-8 min-w-0 items-center gap-2 rounded-md border-[0.5px] border-border bg-background pr-0.5 pl-2.5',
        className,
      )}
    >
      <span
        title={value}
        className="min-w-0 flex-1 truncate font-mono text-foreground text-xs"
      >
        {value}
      </span>
      {children}
    </span>
  );
}
