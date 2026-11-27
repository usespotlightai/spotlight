import { type ReactElement, useRef } from 'react';
import { Link } from 'react-router';

import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import { useFocusAfterDecision } from '@/hooks/useFocusAfterDecision';
import { KIND_LABELS, kindOf, memoryPath } from '@/lib/memory';
import {
  changeStatusOf,
  changeTitleOf,
  findingOf,
  type UpkeepDecision,
  type UpkeepProposal,
} from '@/lib/memory-upkeep';
import { cn } from '@/lib/utils';

type UpkeepProposalCardProps = {
  slug: string;
  teamId: string;
  proposal: UpkeepProposal;
  pending: boolean;
  onDecide: (decision: UpkeepDecision) => void;
};

export function UpkeepProposalCard({
  slug,
  teamId,
  proposal,
  pending,
  onDecide,
}: UpkeepProposalCardProps): ReactElement {
  const card = useRef<HTMLElement>(null);
  const decided = useFocusAfterDecision(card, `${proposal.state}:${pending}`);
  const open = proposal.state === 'pending';
  const what = proposal.memories.map((each) => each.handle).join(' and ');
  const reasonId = `upkeep-${proposal.id}-reason`;
  const lapsed = proposal.inactiveMemories;

  return (
    <DecisionCard
      ref={card}
      data-slot="upkeep-proposal"
      className={cn(
        proposal.state !== 'pending' &&
          proposal.state !== 'approved' &&
          'opacity-70',
      )}
    >
      <DecisionHeader
        title={
          <DecisionTitle status={changeStatusOf(proposal)}>
            {changeTitleOf(proposal)}
          </DecisionTitle>
        }
      />

      <dl>
        <FactRow>
          <dt className={FACT_LABEL}>Found</dt>
          <dd className={FACT_VALUE}>{findingOf(proposal)}</dd>
        </FactRow>
        <FactRow>
          <dt className={FACT_LABEL}>Reason</dt>
          <dd id={reasonId} className={FACT_VALUE}>
            {proposal.reason}
          </dd>
        </FactRow>
        {proposal.memories.map((memory) => (
          <FactRow key={memory.id}>
            <dt className={FACT_LABEL}>
              <Link
                to={memoryPath(slug, teamId, memory.id)}
                className="underline-offset-2 hover:underline"
              >
                {memory.handle}
              </Link>
            </dt>
            <dd className={FACT_VALUE}>
              <span className="text-muted-foreground">
                {KIND_LABELS[kindOf(memory.kind)]}
                {memory.status === 'retired' ? ', retired' : ''}
              </span>
              <span className="block">{memory.body}</span>
            </dd>
          </FactRow>
        ))}
        {proposal.body !== null && proposal.body !== '' && (
          <FactRow>
            <dt className={FACT_LABEL}>Merged</dt>
            <dd className={FACT_VALUE}>{proposal.body}</dd>
          </FactRow>
        )}
      </dl>

      {open && lapsed.length > 0 && (
        <p className="pt-2 text-muted-foreground text-sm">
          {`${lapsed.join(' and ')} ${lapsed.length === 1 ? 'was' : 'were'} retired after the sweep, so this change no longer applies.`}
        </p>
      )}

      {open && (
        <DecisionControls>
          <DecisionButton
            disabled={pending}
            onClick={() => {
              decided();
              onDecide('rejected');
            }}
            aria-label={`Keep ${what}`}
            aria-describedby={reasonId}
          >
            Keep
          </DecisionButton>
          <DecisionButton
            variant="default"
            data-focus-next
            disabled={pending || lapsed.length > 0}
            onClick={() => {
              decided();
              onDecide('approved');
            }}
            aria-label={
              proposal.change === 'merge' ? `Merge ${what}` : `Retire ${what}`
            }
            aria-describedby={reasonId}
          >
            {proposal.change === 'merge' ? 'Merge' : 'Retire'}
          </DecisionButton>
        </DecisionControls>
      )}
    </DecisionCard>
  );
}
