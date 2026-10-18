import { cn } from '@/lib/utils';

type MemoryPlaceToggleProps = {
  label: string;
  hidden: boolean;
  open: boolean;
  onToggle: () => void;
};

export function MemoryPlaceToggle({
  label,
  hidden,
  open,
  onToggle,
}: MemoryPlaceToggleProps) {
  return (
    <button
      type="button"
      tabIndex={open ? 0 : -1}
      aria-expanded={!hidden}
      aria-label={`${hidden ? 'Show' : 'Hide'} what is under ${label}`}
      onClick={onToggle}
      className={cn(
        'absolute top-1/2 left-0 flex size-[11px] -translate-y-1/2 items-center justify-center rounded-[2px] border border-muted-foreground/50 bg-card text-muted-foreground outline-none transition-[color,border-color,opacity] duration-150 hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 group-data-clamped/row:hidden',
        open
          ? '[transition-delay:0ms,0ms,150ms]'
          : 'pointer-events-none opacity-0',
      )}
    >
      <span aria-hidden className="h-px w-[5px] bg-current" />
      {hidden && (
        <span aria-hidden className="absolute h-[5px] w-px bg-current" />
      )}
    </button>
  );
}
