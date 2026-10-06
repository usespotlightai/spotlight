import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title?: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  bordered?: boolean;
};

export function PageHeader({
  title,
  trailing,
  actions,
  bordered = true,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-12 shrink-0 items-center gap-3 px-4',
        bordered && 'border-b-[0.5px] border-border',
      )}
    >
      {title && (
        <h1 className="flex min-w-0 items-center gap-1.5 font-medium text-foreground text-sm">
          {title}
        </h1>
      )}
      {trailing}
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  );
}
