import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type PaneHandleProps = ComponentProps<'div'> & {
  edge: 'left' | 'right';
  resizing: boolean;
};

export function PaneHandle({
  edge,
  resizing,
  className,
  ...rest
}: PaneHandleProps) {
  return (
    <div
      {...rest}
      className={cn(
        'absolute inset-y-0 z-10 w-2 cursor-col-resize outline-none',
        edge === 'left' ? '-left-1' : '-right-1',
        // Faded out at both ends so it reads as a grip on the edge rather than
        // one more line dividing the page.
        'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-faint/70 after:opacity-0 after:transition-opacity',
        'after:[mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]',
        'hover:after:opacity-100 focus-visible:after:opacity-100',
        resizing && 'after:opacity-100',
        className,
      )}
    />
  );
}
