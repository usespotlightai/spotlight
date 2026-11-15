import { OutcomeIcon } from '@/components/shared/OutcomeIcon';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatMark } from '@/lib/judge';

type ClaimMarkProps = {
  met: boolean;
  scorer: string;
};

export function ClaimMark({ met, scorer }: ClaimMarkProps) {
  const label = formatMark(met);

  return (
    <WithTooltip tooltip={label}>
      <span
        role="img"
        aria-label={`${scorer}: ${label}`}
        data-slot="claim-mark"
        data-met={met}
        className="inline-flex size-6 shrink-0 cursor-default items-center justify-center"
      >
        <OutcomeIcon tone={met ? 'done' : 'failed'} />
      </span>
    </WithTooltip>
  );
}
