import { useId } from 'react';
import { ProposedTaskFacts } from '@/components/features/agent/ProposedTaskFacts';
import { CopyIconAction } from '@/components/shared/CopyIconAction';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionPill } from '@/components/shared/DecisionPill';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import {
  type Proposal,
  proposalStandingOf,
  proposalText,
  proposalTitleOf,
} from '@/lib/chat';
import { cn } from '@/lib/utils';

type ProposedTaskCardProps = {
  slug: string;
  teamId: string;
  proposal: Proposal;
  pending: boolean;
  onCreate: () => void;
  onDismiss: () => void;
};

export function ProposedTaskCard({
  slug,
  teamId,
  proposal,
  pending,
  onCreate,
  onDismiss,
}: ProposedTaskCardProps) {
  const titleId = useId();
  const open = proposal.state === 'open';

  return (
    <DecisionCard
      data-slot="proposed-task"
      className={cn(proposal.state === 'dismissed' && 'opacity-70')}
    >
      <DecisionHeader
        title={
          <DecisionTitle standing={proposalStandingOf(proposal)}>
            {proposalTitleOf(proposal)}
          </DecisionTitle>
        }
        trailing={
          <CopyIconAction
            text={proposalText(proposal)}
            label={`Copy ${proposal.title}`}
          />
        }
      />

      <ProposedTaskFacts
        slug={slug}
        teamId={teamId}
        proposal={proposal}
        titleId={titleId}
      />

      <DecisionControls>
        <DecisionPill
          disabled={pending || !open}
          onClick={onDismiss}
          aria-describedby={titleId}
        >
          Dismiss
        </DecisionPill>
        <DecisionPill
          variant="default"
          disabled={pending || !open || !proposal.stationName}
          onClick={onCreate}
          aria-describedby={titleId}
        >
          Create task
        </DecisionPill>
      </DecisionControls>
    </DecisionCard>
  );
}
