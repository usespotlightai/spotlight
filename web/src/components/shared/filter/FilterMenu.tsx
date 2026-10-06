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

type FilterMenuProps = {
  label: string;
  applied: number;
  onClear: () => void;
  compact?: boolean;
  children: ReactNode;
};

export function FilterMenu({
  label,
  applied,
  onClear,
  compact = false,
  children,
}: FilterMenuProps) {
  const filled = applied > 0;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={filled ? `${label}, ${applied} applied` : label}
        className={cn(
          buttonVariants({
            variant: 'outline',
            size: compact
              ? filled
                ? 'xs'
                : 'icon-xs'
              : filled
                ? 'sm'
                : 'icon-sm',
          }),
          'rounded-full bg-card shadow-none data-[popup-open]:bg-muted',
        )}
      >
        <ListFilter aria-hidden className={compact ? 'size-3' : 'size-3.5'} />
        {filled && <span className="tabular-nums">{applied}</span>}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className={cn('rounded-xl p-0', compact ? 'w-72' : 'w-80')}
      >
        <div
          className={cn(
            'flex flex-col',
            compact ? 'gap-0.5 px-3 py-1.5' : 'gap-1.5 px-4 py-3',
          )}
        >
          {children}
        </div>

        {filled && (
          <div
            className={cn(
              'flex justify-end border-border border-t-[0.5px]',
              compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
            )}
          >
            <Button
              variant="ghost"
              size={compact ? 'xs' : 'sm'}
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
