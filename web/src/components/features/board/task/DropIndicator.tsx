import { cn } from '@/lib/utils';

type DropIndicatorProps = {
  edge: 'top' | 'bottom';
};

export function DropIndicator({ edge }: DropIndicatorProps) {
  return (
    <span
      data-slot="drop-indicator"
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-1.5 z-10 h-0.5 rounded-full bg-primary',
        edge === 'top' ? '-top-px' : '-bottom-px',
      )}
    />
  );
}
