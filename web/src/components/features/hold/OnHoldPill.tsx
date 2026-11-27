import { Hand } from 'lucide-react';

import { Pill } from '@/components/shared/Pill';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useMe } from '@/hooks/useMe';
import type { TaskHoldResponseDto } from '@/lib/api';
import { heldUntilResumed } from '@/lib/hold';
import { nonEmpty } from '@/lib/non-empty';

type OnHoldPillProps = {
  hold: TaskHoldResponseDto;
  to?: string;
};

export function OnHoldPill({ hold, to }: OnHoldPillProps) {
  const me = useMe();
  const pill = (
    <Pill lead={<Hand className="size-3.5 shrink-0" aria-hidden />}>
      On hold
    </Pill>
  );

  return (
    <WithTooltip tooltip={heldUntilResumed(hold, me?.id)}>
      {nonEmpty(to) ? (
        <TrailLink to={to} className="outline-none">
          {pill}
        </TrailLink>
      ) : (
        <span className="flex">{pill}</span>
      )}
    </WithTooltip>
  );
}
