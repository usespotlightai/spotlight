import { ListFilter } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const LOOKS = {
  regular: {
    trigger: 'rounded-full',
    empty: buttonVariants({ variant: 'outline', size: 'icon-sm' }),
    filled: buttonVariants({ variant: 'outline', size: 'sm' }),
    icon: 'size-3.5',
    popover: 'w-80 rounded-xl',
    rows: 'gap-1.5 px-4 py-3',
    footer: 'px-2 py-1.5',
    clear: 'sm',
  },
  compact: {
    trigger: 'h-6 rounded-full',
    empty: cn(buttonVariants({ variant: 'outline', size: 'icon-xs' }), 'w-6'),
    filled: cn(
      buttonVariants({ variant: 'outline', size: 'xs' }),
      'px-1.5 text-[0.7rem]',
    ),
    icon: 'size-3',
    popover: 'w-64 rounded-lg',
    rows: 'gap-0.5 px-2.5 py-1.5',
    footer: 'px-1.5 py-1',
    clear: 'xs',
  },
} as const;

type Size = keyof typeof LOOKS;

type FilterMenuProps = {
  label: string;
  applied: number;
  onClear: () => void;
  compact?: boolean;
  button?: Size;
  children: ReactNode;
};

export function FilterMenu({
  label,
  applied,
  onClear,
  compact = false,
  button,
  children,
}: FilterMenuProps) {
  const look = LOOKS[compact ? 'compact' : 'regular'];
  const trigger = LOOKS[button ?? (compact ? 'compact' : 'regular')];
  const filled = applied > 0;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={filled ? `${label}, ${applied} applied` : label}
        className={cn(
          filled ? trigger.filled : trigger.empty,
          'bg-card shadow-none transition-colors data-[popup-open]:bg-muted',
          trigger.trigger,
        )}
      >
        <ListFilter aria-hidden className={trigger.icon} />
        {filled && <span className="tabular-nums">{applied}</span>}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className={cn('p-0', look.popover)}
      >
        <div className={cn('flex flex-col', look.rows)}>{children}</div>

        {filled && (
          <div
            className={cn(
              'flex justify-end border-border border-t-[0.5px]',
              look.footer,
            )}
          >
            <Button
              variant="ghost"
              size={look.clear}
              className="text-muted-foreground"
              onClick={onClear}
            >
              Clear filters
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
