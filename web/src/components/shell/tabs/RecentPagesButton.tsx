import { GalleryHorizontalEnd } from 'lucide-react';
import { useRef, useState } from 'react';

import { buttonVariants } from '@/components/ui/button-variants';
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { kindOf, type RecentPage } from '@/lib/recent-pages';
import { cn } from '@/lib/utils';

type RecentPagesButtonProps = {
  pages: readonly RecentPage[];
  onSelect: (path: string) => void;
  className?: string;
};

export function RecentPagesButton({
  pages,
  onSelect,
  className,
}: RecentPagesButtonProps) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Recently viewed"
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'text-muted-foreground',
          className,
        )}
      >
        <GalleryHorizontalEnd className="size-3.5" aria-hidden />
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" initialFocus={list}>
        <Command ref={list} tabIndex={-1} className="bg-transparent">
          <h2 className="px-3 pt-2.5 pb-1 font-medium text-muted-foreground text-xs">
            Recently viewed
          </h2>

          <CommandList aria-label="Recently viewed">
            <CommandEmpty>No pages viewed yet.</CommandEmpty>

            {pages.map((page) => {
              const kind = kindOf(page.path);

              return (
                <CommandItem
                  key={page.path}
                  value={page.path}
                  onSelect={() => {
                    setOpen(false);
                    onSelect(page.path);
                  }}
                >
                  <span className="w-16 shrink-0 truncate text-muted-foreground text-xs tabular-nums">
                    {page.label ?? kind.label}
                  </span>
                  <kind.icon aria-hidden />
                  <span className="truncate">{page.title ?? kind.label}</span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
