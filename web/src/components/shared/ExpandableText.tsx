import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useRef, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useOverflows } from '@/hooks/useOverflows';
import { cn } from '@/lib/utils';

const HEIGHTS = {
  regular: {
    collapsed: 'max-h-[min(20vh,8rem)]',
    expanded: 'max-h-[min(50vh,16rem)]',
  },
  tall: {
    collapsed: 'max-h-[min(30vh,12rem)]',
    expanded: 'max-h-[min(50vh,28rem)]',
  },
} as const;

type ExpandableTextProps = {
  what: string;
  size?: keyof typeof HEIGHTS;
  children: ReactNode;
};

export function ExpandableText({
  what,
  size = 'regular',
  children,
}: ExpandableTextProps) {
  const [open, setOpen] = useState(false);
  const text = useRef<HTMLDivElement>(null);
  const shown = useId();
  const clipped = useOverflows(text, !open);
  const expandable = open || clipped;

  const toggle = () => {
    if (open && text.current) {
      text.current.scrollTop = 0;
    }
    setOpen(!open);
  };

  return (
    <div className="group/expandable relative flex flex-col gap-1">
      <ScrollArea
        viewportRef={text}
        viewportClassName="pr-3"
        className={cn(
          '-mr-3 transition-[max-height] duration-200 ease-out motion-reduce:transition-none',
          open ? HEIGHTS[size].expanded : HEIGHTS[size].collapsed,
          !open &&
            clipped &&
            '[mask-image:linear-gradient(to_bottom,black_55%,transparent)]',
        )}
      >
        <div id={shown}>{children}</div>
      </ScrollArea>

      {expandable && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={shown}
          aria-label={
            open ? `Show less of the ${what}` : `Show the whole ${what}`
          }
          className={cn(
            'rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open ? 'self-end' : 'absolute inset-x-0 bottom-0 h-[45%]',
          )}
        >
          <ChevronDown
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform group-hover/expandable:text-foreground',
              open ? 'rotate-180' : 'absolute right-0 bottom-0',
            )}
          />
        </button>
      )}
    </div>
  );
}
