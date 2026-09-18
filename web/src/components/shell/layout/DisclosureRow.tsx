import { ChevronDown } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DisclosureRowProps = {
  label: string;
  count?: ReactNode;
  open: boolean;
  onToggle: () => void;
  icon?: ComponentType<{ className?: string }>;
  chevron?: 'start' | 'end';
  className?: string;
};

export function DisclosureRow({
  label,
  count,
  open,
  onToggle,
  icon: Icon,
  chevron = 'end',
  className,
}: DisclosureRowProps) {
  const mark = (
    <ChevronDown
      className={cn(
        'size-3 shrink-0 transition-transform',
        chevron === 'end' && 'ml-auto',
        !open && '-rotate-90',
      )}
      aria-hidden
    />
  );

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-md pr-2 text-muted-foreground text-sm outline-none transition-colors hover:bg-border/50 hover:text-foreground',
        className,
      )}
    >
      {chevron === 'start' && mark}
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="truncate">{label}</span>

      {count !== undefined && (
        <span className="shrink-0 tabular-nums">{count}</span>
      )}

      {chevron === 'end' && mark}
    </button>
  );
}
