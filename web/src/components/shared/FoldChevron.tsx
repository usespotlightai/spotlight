import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type FoldChevronProps = {
  open: boolean;
  className?: string;
};

export function FoldChevron({ open, className }: FoldChevronProps) {
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
