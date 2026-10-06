import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type FilterRowProps = {
  label: string;
  htmlFor?: string;
  compact?: boolean;
  children: ReactNode;
};

export function FilterRow({
  label,
  htmlFor,
  compact = false,
  children,
}: FilterRowProps) {
  const shown = cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm');

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        compact ? 'min-h-7' : 'min-h-8',
      )}
    >
      {htmlFor ? (
        <label htmlFor={htmlFor} className={shown}>
          {label}
        </label>
      ) : (
        <span className={shown}>{label}</span>
      )}

      {children}
    </div>
  );
}
