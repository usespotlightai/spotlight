import { OutcomeIcon } from '@/components/shared/OutcomeIcon';
import { formatMark } from '@/lib/judge';

export function ClaimMarkText({ met }: { met: boolean }) {
  return (
    <span
      data-slot="claim-mark"
      data-met={met}
      className="inline-flex items-center gap-1.5 text-foreground text-sm leading-6"
    >
      <OutcomeIcon tone={met ? 'done' : 'failed'} />
      {formatMark(met)}
    </span>
  );
}
