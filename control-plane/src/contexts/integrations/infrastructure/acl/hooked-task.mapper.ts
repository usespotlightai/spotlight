import type { HookedTask } from '@integrations/application/ports/tasks-for-hooks.port';
import type { HookedTaskDto } from '@work/application/ports/hooked-tasks.port';

export const HookedTaskMapper = {
  toHooked(task: HookedTaskDto): HookedTask {
    return {
      taskId: task.taskId,
      workspaceId: task.workspaceId,
      teamId: task.teamId,
      title: task.title,
      url: task.url,
      line: task.line,
      station: task.station,
      stationKey: task.stationKey,
      marks: { ...task.marks },
      repositories: [...task.repositories],
      pullRequest: task.pullRequest,
      runId: task.runId,
    };
  },
};
