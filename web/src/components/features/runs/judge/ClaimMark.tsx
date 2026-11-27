import type { ReactElement } from 'react';

import { OutcomeIcon } from '@/components/shared/OutcomeIcon';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatMark, JUDGE_LABEL } from '@/lib/judge';

export function ClaimMark({ met }: { met: boolean }): ReactElement {
  const label = formatMark(met);

  return (
    <WithTooltip tooltip={label}>
      <span
        role="img"
        aria-label={`${JUDGE_LABEL}: ${label}`}
        data-slot="claim-mark"
        data-met={met}
        className="inline-flex size-6 shrink-0 cursor-default items-center justify-center"
      >
        <OutcomeIcon tone={met ? 'done' : 'failed'} />
      </span>
    </WithTooltip>
  );
}
