import { useParams } from 'react-router';

import { ChangeStackPage } from '@/components/features/changes/ChangeStackPage';
import { ChangeStackSkeleton } from '@/components/features/changes/ChangeStackSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { useRunChangeStacks } from '@/hooks/api/useRunChangeStacks';
import { useTaskReview } from '@/hooks/api/useTaskReview';
import { useTeamRun } from '@/hooks/api/useTeamRuns';
import { useChangeStackTrail } from '@/hooks/useChangeStackTrail';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import { runPath } from '@/lib/run';
import { TrailContext, useTrail } from '@/lib/trail';
import { PublicChangeStack } from '@/routes/PublicChangeStack';

export function RunChangeStack() {
  const { slug, teamId, runId } = useParams();
  const stacks = useRunChangeStacks(teamId, runId);
  const found = useTeamRun(teamId, runId);
  const review = useTaskReview(teamId, found.data?.taskId);

  const run = found.data;
  const { trail, forward } = useTrail(useChangeStackTrail(slug, teamId, run));

  if (!slug || !teamId || !runId) {
    return null;
  }

  if (loading(stacks) || loading(found)) {
    return <ChangeStackSkeleton known={trail.slice(0, -1)} />;
  }

  if (failed(stacks) && notFound(stacks.error)) {
    return <PublicChangeStack />;
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
      <ChangeStackPage
        slug={slug}
        teamId={teamId}
        taskId={run?.taskId}
        stacks={stacks.data?.stacks ?? []}
        review={review.data}
        trail={trail}
        back={{ to: runPath(slug, teamId, runId), label: 'Back to the run' }}
      />
    </TrailContext>
  );
}
