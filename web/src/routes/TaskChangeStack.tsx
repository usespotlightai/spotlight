import { useParams } from 'react-router';

import { ChangeStackPage } from '@/components/features/changes/ChangeStackPage';
import { ChangeStackSkeleton } from '@/components/features/changes/ChangeStackSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { useLines } from '@/hooks/api/useLines';
import { useTaskChangeStacks } from '@/hooks/api/useTaskChangeStacks';
import { useTaskReview } from '@/hooks/api/useTaskReview';
import { useTask } from '@/hooks/api/useTasks';
import { useTaskTrail } from '@/hooks/useTaskTrail';
import { failed, loading } from '@/lib/query';
import { taskPath } from '@/lib/task';
import { TrailContext, useTrail } from '@/lib/trail';

export function TaskChangeStack() {
  const { slug, teamId, taskId } = useParams();
  const stacks = useTaskChangeStacks(teamId, taskId);
  const found = useTask(teamId, taskId);
  const lines = useLines(teamId);
  const review = useTaskReview(teamId, taskId);

  const task = found.data;
  const line = lines.data?.find((candidate) =>
    candidate.stations.some((station) => station.id === task?.stationId),
  );
  const toTask = slug && teamId && taskId ? taskPath(slug, teamId, taskId) : '';
  const { trail, forward } = useTrail([
    ...useTaskTrail({ slug, teamId, line, title: task?.title }).map(
      (segment, index, all) =>
        index === all.length - 1 ? { ...segment, to: toTask } : segment,
    ),
    { label: 'Change stack' },
  ]);

  if (!slug || !teamId || !taskId) {
    return null;
  }

  if (loading(stacks) || loading(found)) {
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
      <ChangeStackPage
        slug={slug}
        teamId={teamId}
        taskId={taskId}
        stacks={stacks.data?.stacks ?? []}
        review={review.data}
        trail={trail}
        back={{ to: toTask, label: 'Back to the task' }}
      />
    </TrailContext>
  );
}
