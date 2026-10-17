import { Check, X } from 'lucide-react';
import { formatMark } from '@/lib/judge';
import { cn } from '@/lib/utils';

export function ClaimMark({ met }: { met: boolean }) {
  const Icon = met ? Check : X;

  return (
    <span
      data-slot="claim-mark"
      data-met={met}
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 font-medium text-xs',
        met ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {formatMark(met)}
    </span>
  );
}
