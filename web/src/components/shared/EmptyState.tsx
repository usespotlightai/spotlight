import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex max-w-xs flex-col items-center gap-3 text-center',
        className,
      )}
    >
      <Icon className="size-5 text-muted-foreground" aria-hidden />

      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground text-sm">{title}</p>
        {children && (
          <p className="text-muted-foreground text-sm">{children}</p>
        )}
      </div>

      {action}
    </div>
  );
}
