import { useLines } from '@/hooks/api/useLines';
import { useTaskPullRequests } from '@/hooks/api/useTaskPullRequests';
import { useTaskRuns } from '@/hooks/api/useTaskRuns';
import { useTask } from '@/hooks/api/useTasks';
import { loading } from '@/lib/query';

export function useTaskFooterLoading(
  teamId: string | undefined,
  taskId: string | null | undefined,
  runStationId?: string | null,
): boolean {
  const known =
    teamId !== undefined &&
    teamId !== '' &&
    taskId !== undefined &&
    taskId !== null &&
    taskId !== ''
      ? taskId
      : undefined;
  const task = useTask(teamId, known);
  const lines = useLines(teamId);
  const pullRequests = useTaskPullRequests(teamId, known);
  const movedOn =
    Boolean(runStationId) &&
    task.data !== undefined &&
    task.data.stationId !== runStationId;
  const taskRuns = useTaskRuns(teamId, movedOn ? known : undefined);

  if (known === undefined) {
    return false;
  }

  return (
    loading(task) ||
    loading(lines) ||
    loading(pullRequests) ||
    (movedOn && loading(taskRuns))
  );
}
