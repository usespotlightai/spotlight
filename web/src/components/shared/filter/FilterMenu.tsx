import { ListFilter } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
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
  children: ReactNode;
};

export function FilterMenu({
  label,
  applied,
  onClear,
  children,
}: FilterMenuProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={applied > 0 ? `${label}, ${applied} applied` : label}
        className={cn(
          buttonVariants({
            variant: 'outline',
            size: applied > 0 ? 'sm' : 'icon-sm',
          }),
          'rounded-full bg-card shadow-none data-[popup-open]:bg-muted',
        )}
      >
        <ListFilter aria-hidden className="size-3.5" />
        {applied > 0 && <span className="tabular-nums">{applied}</span>}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-80 rounded-xl p-0"
      >
        <div className="flex flex-col gap-1.5 px-4 py-3">{children}</div>

        {applied > 0 && (
          <div className="flex justify-end border-border border-t-[0.5px] px-2 py-1.5">
            <Button
              variant="ghost"
              size="sm"
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
