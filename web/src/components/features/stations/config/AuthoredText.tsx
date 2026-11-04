import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function AuthoredText({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', label && 'pt-2')}>
      {label && <p className="text-muted-foreground text-xs">{label}</p>}
      <div
        data-slot="authored-text"
        className="min-w-0 border-border border-l-2 pl-4"
      >
        {children}
      </div>
    </div>
  );
}
