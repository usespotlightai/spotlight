import { Undo2 } from 'lucide-react';
import { type Ref, use, useId, useState } from 'react';

import { ProposedTaskFacts } from '@/components/features/agent/ProposedTaskFacts';
import { Collapsible } from '@/components/shared/Collapsible';
import { CopyIconAction } from '@/components/shared/CopyIconAction';
import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { FoldToggle } from '@/components/shared/FoldToggle';
import { IconAction } from '@/components/shared/IconAction';
import { OverflowFade } from '@/components/shared/OverflowFade';
import type { Attachment } from '@/lib/attachment';
import {
  type Proposal,
  proposalStatusOf,
  proposalText,
  proposalTitleOf,
} from '@/lib/chat';
import { DockedContext } from '@/lib/decision-tray';
import { nonEmpty } from '@/lib/non-empty';
import { cn } from '@/lib/utils';

type ProposedTaskCardProps = {
  slug: string;
  teamId: string;
  proposal: Proposal;
  waitsFor?: readonly string[];
  attachments: readonly Attachment[];
  pending: boolean;
  onCreate: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  ref?: Ref<HTMLElement>;
};

export function ProposedTaskCard({
  slug,
  teamId,
  proposal,
  waitsFor = [],
  attachments,
  pending,
  onCreate,
  onDismiss,
  onRestore,
  ref,
}: ProposedTaskCardProps) {
  const titleId = useId();
  const docked = use(DockedContext) !== null;
  const [unfolded, setUnfolded] = useState(false);
  const dismissed =
    proposal.state === 'dismissed' || proposal.state === 'replaced';
  const folded = dismissed && !unfolded;
  const facts = (
    <ProposedTaskFacts
      slug={slug}
      teamId={teamId}
      proposal={proposal}
      waitsFor={waitsFor}
      attachments={attachments}
      titleId={titleId}
    />
  );

  return (
    <DecisionCard
      ref={ref}
      data-slot="proposed-task"
      className={cn(
        'gap-0 transition-[padding] duration-200 ease-out-quad motion-reduce:transition-none',
        dismissed && 'opacity-70',
        folded && 'pb-2',
      )}
    >
      <DecisionHeader
        className={cn(folded && 'mb-0')}
        title={
          <DecisionTitle status={proposalStatusOf(proposal)}>
            {proposalTitleOf(proposal)}
            {folded && (
              <span className="ml-2 font-normal text-muted-foreground">
                {proposal.title}
              </span>
            )}
          </DecisionTitle>
        }
        trailing={
          <span className="flex shrink-0 items-center gap-1">
            {dismissed && (
              <IconAction
                label={`Restore ${proposal.title}`}
                tip="Restore"
                disabled={pending}
                focusNext
                onClick={() => {
                  setUnfolded(false);
                  onRestore();
                }}
              >
                <Undo2 />
              </IconAction>
            )}
            {!docked && (
              <CopyIconAction
                text={proposalText(proposal)}
                label={`Copy ${proposal.title}`}
              />
            )}
            {dismissed && (
              <FoldToggle
                folded={folded}
                what="the proposal"
                onToggle={() => setUnfolded((was) => !was)}
              />
            )}
          </span>
        }
      />

      <Collapsible open={!folded} appear={false}>
        <div className="flex flex-col gap-3 pt-1.5">
          {docked ? (
            facts
          ) : (
            <OverflowFade className="max-h-96">{facts}</OverflowFade>
          )}

          <ProposalOutcome
            proposal={proposal}
            pending={pending}
            titleId={titleId}
            onCreate={onCreate}
            onDismiss={onDismiss}
          />
        </div>
      </Collapsible>
    </DecisionCard>
  );
}

type ProposalOutcomeProps = Pick<
  ProposedTaskCardProps,
  'proposal' | 'pending' | 'onCreate' | 'onDismiss'
> & { titleId: string };

function ProposalOutcome({
  proposal,
  pending,
  titleId,
  onCreate,
  onDismiss,
}: ProposalOutcomeProps) {
  if (proposal.state === 'open') {
    return (
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
          data-focus-next
          disabled={pending || !nonEmpty(proposal.stationName)}
          onClick={onCreate}
          aria-describedby={titleId}
        >
          Create task
        </DecisionButton>
      </DecisionControls>
    );
  }

  return null;
}
