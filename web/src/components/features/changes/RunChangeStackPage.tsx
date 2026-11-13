import { ChangeStackNotice } from '@/components/features/changes/ChangeStackNotice';
import { ChangeStackView } from '@/components/features/changes/ChangeStackView';
import { StackRepositoryPills } from '@/components/features/changes/StackRepositoryPills';
import { DecisionsProvider } from '@/components/features/decisions/DecisionsProvider';
import { ReviewProvider } from '@/components/features/review/ReviewProvider';
import { SubmitReviewButton } from '@/components/features/review/SubmitReviewButton';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useStackInView } from '@/hooks/useStackInView';
import type { ChangeStack } from '@/lib/change-stack';
import type { CodeReview } from '@/lib/review';
import { runPath } from '@/lib/run';

type RunChangeStackPageProps = {
  slug: string;
  teamId: string;
  runId: string;
  taskId: string | null | undefined;
  stacks: readonly ChangeStack[];
  review: CodeReview | undefined;
  trail: readonly BreadcrumbSegment[];
};

export function RunChangeStackPage({
  slug,
  teamId,
  runId,
  taskId,
  stacks,
  review,
  trail,
}: RunChangeStackPageProps) {
  const { current, stack, layerId, pick, switchTo } = useStackInView(stacks);
  const ready = stack?.state === 'ready' ? stack : null;

  return (
    <ReviewProvider
      teamId={teamId}
      runId={runId}
      repository={stack?.repository ?? null}
      alone={current.length <= 1}
      review={review}
    >
      <DecisionsProvider slug={slug} teamId={teamId} taskId={taskId}>
        <div className="flex min-h-0 flex-1 flex-col">
          <PageHeader
            title={<Breadcrumbs segments={trail} />}
            trailing={
              ready && (
                <StackRepositoryPills
                  stacks={current}
                  stack={ready}
                  onChange={switchTo}
                  className="hidden shrink grow justify-end-safe pr-2 @4xl/pane:flex"
                />
              )
            }
            actions={ready && taskId ? <SubmitReviewButton /> : undefined}
          />

          {ready && (
            <StackRepositoryPills
              stacks={current}
              stack={ready}
              onChange={switchTo}
              className="border-border border-b-[0.5px] @md/pane:px-4 @4xl/pane:hidden"
            />
          )}

          {ready ? (
            <ChangeStackView stack={ready} layerId={layerId} onPick={pick} />
          ) : (
            <ChangeStackNotice
              stack={stack}
              runTo={runPath(slug, teamId, runId)}
            />
          )}
        </div>
      </DecisionsProvider>
    </ReviewProvider>
  );
}
