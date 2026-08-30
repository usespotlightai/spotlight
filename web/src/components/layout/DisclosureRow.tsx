import { ChevronDown } from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

type DisclosureRowProps = {
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
};

/** For a group with no page of its own, so there is nothing to navigate to. */
export function DisclosureRow({
  label,
  count,
  open,
  onToggle,
  icon: Icon,
  className,
}: DisclosureRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-md pr-2 text-muted-foreground text-sm outline-none transition-colors hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span className="truncate">{label}</span>

      {count !== undefined && (
        <span className="shrink-0 tabular-nums">{count}</span>
      )}

      <ChevronDown
        className={cn(
          'ml-auto size-3 shrink-0 transition-transform',
          !open && '-rotate-90',
        )}
        aria-hidden
      />
    </button>
  );
}
