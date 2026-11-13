import { useId } from 'react';

import { ProposedTaskFacts } from '@/components/features/agent/ProposedTaskFacts';
import { CopyIconAction } from '@/components/shared/CopyIconAction';
import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { OverflowFade } from '@/components/shared/OverflowFade';
import type { Attachment } from '@/lib/attachment';
import {
  type Proposal,
  proposalStatusOf,
  proposalText,
  proposalTitleOf,
} from '@/lib/chat';
import { cn } from '@/lib/utils';

type ProposedTaskCardProps = {
  slug: string;
  teamId: string;
  proposal: Proposal;
  attachments: readonly Attachment[];
  pending: boolean;
  onCreate: () => void;
  onDismiss: () => void;
};

export function ProposedTaskCard({
  slug,
  teamId,
  proposal,
  attachments,
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
          <DecisionTitle status={proposalStatusOf(proposal)}>
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

      <OverflowFade className="max-h-96">
        <ProposedTaskFacts
          slug={slug}
          teamId={teamId}
          proposal={proposal}
          attachments={attachments}
          titleId={titleId}
        />
      </OverflowFade>

      {open && (
        <DecisionControls>
          <DecisionButton
            disabled={pending}
            onClick={onDismiss}
            aria-describedby={titleId}
          >
            Dismiss
          </DecisionButton>
          <DecisionButton
            variant="default"
            disabled={pending || !proposal.stationName}
            onClick={onCreate}
            aria-describedby={titleId}
          >
            Create task
          </DecisionButton>
        </DecisionControls>
      )}
    </DecisionCard>
  );
}
