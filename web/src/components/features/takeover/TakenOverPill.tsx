import { Hand } from 'lucide-react';

import { Pill } from '@/components/shared/Pill';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useMe } from '@/hooks/useMe';
import type { TaskTakeoverResponseDto } from '@/lib/api';
import { heldUntilHandedBack } from '@/lib/takeover';

type TakenOverPillProps = {
  takeover: TaskTakeoverResponseDto;
  to?: string;
};

export function TakenOverPill({ takeover, to }: TakenOverPillProps) {
  const me = useMe();
  const pill = (
    <Pill lead={<Hand className="size-3.5 shrink-0" aria-hidden />}>
      Taken over
    </Pill>
  );

  return (
    <WithTooltip tooltip={heldUntilHandedBack(takeover, me?.id)}>
      {to ? (
        <TrailLink to={to} className="outline-none">
          {pill}
        </TrailLink>
      ) : (
        <span className="flex">{pill}</span>
      )}
    </WithTooltip>
  );
}
