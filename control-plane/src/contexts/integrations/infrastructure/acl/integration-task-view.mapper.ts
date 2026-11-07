import type { UnlinkedTaskView } from '@integrations/application/ports/tasks-for-hooks.port';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';

export const IntegrationTaskViewMapper = {
  toView(task: IntegrationTaskViewDto): UnlinkedTaskView {
    return {
      taskId: TaskId.of(task.taskId),
      workspaceId: WorkspaceId.of(task.workspaceId),
      teamId: TeamId.of(task.teamId),
      title: task.title,
      pullRequest: task.pullRequest,
      line: task.line,
      station: task.station,
      stationKey: StationKey.of(task.stationKey),
      marks: task.marks,
      repositories: [],
      runId: null,
      waiting: task.waiting
        ? {
            conversationId: task.waiting.conversationId,
            body: task.waiting.body,
            awaitsApproval: task.waiting.awaitsApproval,
            attachments: task.waiting.attachments.map((file) => ({
              id: file.id,
              name: file.name,
              type: file.contentType,
              size: file.size,
            })),
          }
        : null,
    };
  },
};
