import type { LinkedTaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskViewDto } from '@work/application/ports/task-views.port';

export const TaskViewMapper = {
  toView(task: TaskViewDto): LinkedTaskView {
    return {
      taskId: TaskId.of(task.taskId),
      workspaceId: WorkspaceId.of(task.workspaceId),
      teamId: TeamId.of(task.teamId),
      title: task.title,
      url: task.url,
      line: task.line,
      station: task.station,
      stationKey: StationKey.of(task.stationKey),
      marks: { ...task.marks },
      repositories: [...task.repositories],
      pullRequest: task.pullRequest,
      runId: task.runId === null ? null : RunId.of(task.runId),
      waiting: null,
    };
  },
};
