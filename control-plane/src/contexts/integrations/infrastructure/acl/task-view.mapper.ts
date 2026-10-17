import type { TaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import type { TaskViewDto } from '@work/application/ports/task-views.port';

export const TaskViewMapper = {
  toView(task: TaskViewDto): TaskView {
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
