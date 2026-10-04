import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DisclosureToggleProps = {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function DisclosureToggle({
  open,
  onToggle,
  children,
}: DisclosureToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex items-center gap-1.5 self-start rounded py-0.5 text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronRight
        aria-hidden
        className={cn(
          'size-3 transition-transform duration-200',
          open && 'rotate-90',
        )}
      />
      {children}
    </button>
  );
}
