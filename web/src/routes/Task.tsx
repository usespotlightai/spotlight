import { useParams } from 'react-router';
import { NotFound } from '@/components/features/board/NotFound';
import { TaskPage } from '@/components/features/board/task/TaskPage';
import { TaskSkeleton } from '@/components/features/board/task/TaskSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { useLines } from '@/hooks/api/useLines';
import { useTask } from '@/hooks/api/useTasks';
import { useTaskTrail } from '@/hooks/useTaskTrail';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import { teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

export function Task() {
  const { slug, teamId, taskId } = useParams();
  const lines = useLines(teamId);
  const found = useTask(teamId, taskId);

  const task = found.data;
  const line = lines.data?.find((candidate) =>
    candidate.stations.some((station) => station.id === task?.stationId),
  );
  const { trail, forward } = useTrail(
    useTaskTrail({ slug, teamId, line, title: task?.title }),
  );

  if (failed(found) && !notFound(found.error)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The task"
          retrying={found.isFetching}
          onRetry={() => void found.refetch()}
        />
      </PageNotice>
    );
  }

  if (loading(found) || loading(lines)) {
    return <TaskSkeleton known={trail.slice(0, -1)} />;
  }

  if (!task) {
    return (
      <NotFound title="Task not found" to={teamPath(slug ?? '', teamId ?? '')}>
        This team has no task at that address.
      </NotFound>
    );
  }

  return (
    <TrailContext value={forward}>
      <TaskPage
        slug={slug}
        teamId={teamId}
        task={task}
        line={line}
        trail={trail}
      />
    </TrailContext>
  );
}
