import { useParams } from 'react-router';
import { ChangeStackSkeleton } from '@/components/features/changes/ChangeStackSkeleton';
import { RunChangeStackPage } from '@/components/features/changes/RunChangeStackPage';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { useRunChangeStacks } from '@/hooks/api/useRunChangeStacks';
import { useRunReview } from '@/hooks/api/useRunReview';
import { useTeamRuns } from '@/hooks/api/useTeamRuns';
import { useChangeStackTrail } from '@/hooks/useChangeStackTrail';
import { failed, loading } from '@/lib/query';
import { TrailContext, useTrail } from '@/lib/trail';

export function RunChangeStack() {
  const { slug, teamId, runId } = useParams();
  const stacks = useRunChangeStacks(teamId, runId);
  const runs = useTeamRuns(teamId);
  const review = useRunReview(teamId, runId);

  const run = runs.data?.find((each) => each.id === runId);
  const { trail, forward } = useTrail(useChangeStackTrail(slug, teamId, run));

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

  return (
    <TrailContext value={forward}>
      <RunChangeStackPage
        slug={slug}
        teamId={teamId}
        runId={runId}
        taskId={run?.taskId}
        stacks={stacks.data?.stacks ?? []}
        review={review.data}
        trail={trail}
      />
    </TrailContext>
  );
}
