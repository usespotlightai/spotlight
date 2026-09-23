import { useParams, useSearchParams } from 'react-router';
import { ChangeStackNotice } from '@/components/features/changes/ChangeStackNotice';
import { ChangeStackSkeleton } from '@/components/features/changes/ChangeStackSkeleton';
import { ChangeStackView } from '@/components/features/changes/ChangeStackView';
import { DecisionsProvider } from '@/components/features/decisions/DecisionsProvider';
import { ReviewProvider } from '@/components/features/review/ReviewProvider';
import { SubmitReviewButton } from '@/components/features/review/SubmitReviewButton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { ViewPills } from '@/components/shared/ViewPills';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useRunChangeStacks } from '@/hooks/api/useRunChangeStacks';
import { useRunReview } from '@/hooks/api/useRunReview';
import { useTeamRuns } from '@/hooks/api/useTeamRuns';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { currentStacks } from '@/lib/change-stack';
import { failed, loading } from '@/lib/query';
import { runPath } from '@/lib/run';
import { taskPath } from '@/lib/task';
import { teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

const UNNAMED = 'the repository';

export function RunChangeStack() {
  const { slug, teamId, runId } = useParams();
  const [params, setParams] = useSearchParams();
  const stacks = useRunChangeStacks(teamId, runId);
  const runs = useTeamRuns(teamId);
  const review = useRunReview(teamId, runId);
  const { data: workspace } = useWorkspace(slug);

  const run = runs.data?.find((each) => each.id === runId);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const base: BreadcrumbSegment[] = [
    ...(team && slug
      ? [{ label: team.name, avatar: team.name, to: teamPath(slug, team.id) }]
      : []),
    ...(run && slug && teamId
      ? [
          {
            label: run.taskTitle ?? 'Run',
            to: run.taskId ? taskPath(slug, teamId, run.taskId) : undefined,
          },
          {
            label: run.station?.name ?? 'Run',
            to: runPath(slug, teamId, run.id),
          },
        ]
      : []),
    { label: 'Change stack' },
  ];
  const { trail, forward } = useTrail(base);

  if (!slug || !teamId || !runId) {
    return null;
  }

  if (loading(stacks) || loading(runs)) {
    return <ChangeStackSkeleton known={trail.slice(0, -1)} />;
  }

  if (failed(stacks)) {
    return (
      <PageNotice title={<Breadcrumbs segments={trail} />}>
        <CouldNotLoad
          what="The change stack"
          retrying={stacks.isFetching}
          onRetry={() => void stacks.refetch()}
        />
      </PageNotice>
    );
  }

  const current = currentStacks(stacks.data?.stacks ?? []);
  const repository = params.get('repository');
  const stack =
    current.find((each) => (each.repository ?? UNNAMED) === repository) ??
    current[0] ??
    null;

  const pick = (layerId: string) =>
    setParams((now) => {
      const next = new URLSearchParams(now);
      next.set('layer', layerId);
      return next;
    });

  const switchTo = (named: string) =>
    setParams(new URLSearchParams({ repository: named }));

  return (
    <TrailContext value={forward}>
      <ReviewProvider teamId={teamId} runId={runId} review={review.data}>
        <DecisionsProvider slug={slug} teamId={teamId} taskId={run?.taskId}>
          <div className="flex min-h-0 flex-1 flex-col">
            <PageHeader
              title={<Breadcrumbs segments={trail} />}
              actions={
                stack?.state === 'ready' ? (
                  <>
                    {current.length > 1 && (
                      <ViewPills
                        views={current.map((each) => ({
                          id: each.repository ?? UNNAMED,
                          label: each.repository ?? UNNAMED,
                        }))}
                        current={stack.repository ?? UNNAMED}
                        onChange={switchTo}
                      />
                    )}
                    {run?.taskId && <SubmitReviewButton />}
                  </>
                ) : undefined
              }
            />

            {stack?.state === 'ready' ? (
              <ChangeStackView
                stack={stack}
                layerId={params.get('layer')}
                onPick={pick}
              />
            ) : (
              <ChangeStackNotice
                stack={stack}
                runTo={runPath(slug, teamId, runId)}
              />
            )}
          </div>
        </DecisionsProvider>
      </ReviewProvider>
    </TrailContext>
  );
}
