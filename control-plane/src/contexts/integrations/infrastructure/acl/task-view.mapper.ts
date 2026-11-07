import type { LinkedTaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
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
      line: LineKey.of(task.line),
      station: StationName.of(task.station),
      stationKey: StationKey.of(task.stationKey),
      marks: { ...task.marks },
      repositories: task.repositories.map(Repository.of),
      pullRequest:
        task.pullRequest === null ? null : PullRequestUrl.of(task.pullRequest),
      runId: task.runId === null ? null : RunId.of(task.runId),
      waiting: null,
    };
  },
};
