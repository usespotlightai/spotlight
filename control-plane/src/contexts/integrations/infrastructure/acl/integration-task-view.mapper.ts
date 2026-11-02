import type { IntegrationTaskView } from '@integrations/application/ports/integration-runtime.port';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';

export const IntegrationTaskViewMapper = {
  toView(
    task: IntegrationTaskViewDto,
    url: string | null,
  ): IntegrationTaskView {
    return {
      taskId: task.taskId,
      workspaceId: task.workspaceId,
      teamId: task.teamId,
      title: task.title,
      url,
      pullRequest: task.pullRequest,
      line: task.line,
      station: task.station,
      stationKey: task.stationKey,
      marks: task.marks,
      waiting: task.waiting
        ? {
            conversationId: task.waiting.conversationId,
            body: task.waiting.body,
            awaitsApproval: task.waiting.awaitsApproval,
            attachments: task.waiting.attachments,
          }
        : null,
    };
  },
};
