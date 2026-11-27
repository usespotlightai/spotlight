import { Binoculars } from 'lucide-react';

import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { IconLink } from '@/components/shared/IconLink';
import { formatDay } from '@/lib/judge';
import {
  DISAGREEMENT_STATUSES,
  type DisagreementCardState,
  OPEN_THE_TRACE,
  SENDING_ANSWER,
} from '@/lib/judge-disagreement';
import { nonEmpty } from '@/lib/non-empty';

type DisagreementCardHeaderProps = {
  state: DisagreementCardState;
  title: string;
  sending: boolean;
  at: string | null;
  trace: string;
};

export function DisagreementCardHeader({
  state,
  title,
  sending,
  at,
  trace,
}: DisagreementCardHeaderProps) {
  return (
    <DecisionHeader
      title={
        <DecisionTitle status={DISAGREEMENT_STATUSES[state]}>
          {title}
        </DecisionTitle>
      }
      trailing={
        <div className="flex shrink-0 items-center gap-2">
          {state === 'open' ? (
            <span
              role="status"
              aria-live="polite"
              className="text-muted-foreground text-xs empty:hidden"
            >
              {sending ? SENDING_ANSWER : null}
            </span>
          ) : (
            nonEmpty(at) && (
              <p className="text-muted-foreground text-xs tabular-nums">
                {formatDay(at.slice(0, 10))}
              </p>
            )
          )}
          <IconLink to={trace} label={OPEN_THE_TRACE}>
            <Binoculars aria-hidden />
          </IconLink>
        </div>
      }
    />
  );
}
