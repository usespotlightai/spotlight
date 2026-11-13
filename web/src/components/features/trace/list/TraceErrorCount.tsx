import { CircleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

export function TraceErrorCount({
  errors,
  className,
}: {
  errors: number;
  className?: string;
}) {
  if (errors === 0) {
    return null;
  }

  const label = `${errors} ${errors === 1 ? 'error' : 'errors'}`;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-0.5 text-outcome-failed text-xs tabular-nums',
        className,
      )}
      title={label}
      aria-label={label}
    >
      <CircleAlert className="size-3 shrink-0" />
      {errors}
    </span>
  );
}
