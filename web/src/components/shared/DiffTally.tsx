import { cn } from '@/lib/utils';

type DiffTallyProps = {
  added: number;
  removed: number;
  always?: boolean;
  className?: string;
};

export function DiffTally({
  added,
  removed,
  always = false,
  className,
}: DiffTallyProps) {
  return (
    <span
      className={cn('flex shrink-0 items-center gap-2 tabular-nums', className)}
    >
      {(always || added > 0) && (
        <span className="text-emerald-600 dark:text-emerald-400">+{added}</span>
      )}
      {(always || removed > 0) && (
        <span className="text-destructive">−{removed}</span>
      )}
    </span>
  );
}
