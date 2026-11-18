import { ChevronRight } from 'lucide-react';
import { type Ref, useId, useState } from 'react';

import { ProposedTaskFacts } from '@/components/features/agent/ProposedTaskFacts';
import { Collapsible } from '@/components/shared/Collapsible';
import { CopyIconAction } from '@/components/shared/CopyIconAction';
import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { OverflowFade } from '@/components/shared/OverflowFade';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { Attachment } from '@/lib/attachment';
import {
  type Proposal,
  proposalStatusOf,
  proposalText,
  proposalTitleOf,
} from '@/lib/chat';
import { taskPath } from '@/lib/task';
import { cn } from '@/lib/utils';

type ProposedTaskCardProps = {
  slug: string;
  teamId: string;
  proposal: Proposal;
  attachments: readonly Attachment[];
  pending: boolean;
  onCreate: () => void;
  onDismiss: () => void;
  ref?: Ref<HTMLElement>;
};

const OUTCOME = 'flex h-7 items-center justify-end text-sm pointer-coarse:h-9';

export function ProposedTaskCard({
  slug,
  teamId,
  proposal,
  attachments,
  pending,
  onCreate,
  onDismiss,
  ref,
}: ProposedTaskCardProps) {
  const titleId = useId();
  const [unfolded, setUnfolded] = useState(false);
  const open = proposal.state === 'open';
  const dismissed = proposal.state === 'dismissed';
  const folded = dismissed && !unfolded;

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
              <button
                type="button"
                aria-expanded={!folded}
                aria-label={folded ? 'Show the proposal' : 'Hide the proposal'}
                onClick={() => setUnfolded((was) => !was)}
                className="flex size-6 items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronRight
                  aria-hidden
                  className={cn(
                    'size-3.5 transition-transform duration-200',
                    !folded && 'rotate-90',
                  )}
                />
              </button>
            )}
            <CopyIconAction
              text={proposalText(proposal)}
              label={`Copy ${proposal.title}`}
            />
          </span>
        }
      />

      <Collapsible open={!folded} appear={false}>
        <div className="flex flex-col gap-3 pt-1.5">
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

          {(proposal.state === 'accepted' ||
            (proposal.state === 'created' && !proposal.taskId)) && (
            <p className={cn(OUTCOME, 'text-muted-foreground')}>
              Creating the task…
            </p>
          )}

          {proposal.state === 'created' && proposal.taskId && (
            <div className={OUTCOME}>
              <TrailLink
                to={taskPath(slug, teamId, proposal.taskId)}
                className="rounded-sm font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Open task
              </TrailLink>
            </div>
          )}
        </div>
      </Collapsible>
    </DecisionCard>
  );
}
