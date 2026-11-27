import { ChevronRight } from 'lucide-react';
import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

type ExpandChevronProps = {
  open: boolean;
  className?: string;
};

export function ExpandChevron({
  open,
  className,
}: ExpandChevronProps): ReactElement {
  return (
    <ChevronRight
      aria-hidden
      className={cn(
        'size-3 transition-transform duration-200 motion-reduce:transition-none',
        open && 'rotate-90',
        className,
      )}
    />
  );
}
