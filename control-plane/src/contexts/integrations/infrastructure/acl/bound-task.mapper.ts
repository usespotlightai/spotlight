import type { BoundTask } from '@integrations/application/ports/integration-runtime.port';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';

export const BoundTaskMapper = {
  toBound(task: BoundTaskDto): BoundTask {
    return {
      taskId: task.taskId,
      workspaceId: task.workspaceId,
      teamId: task.teamId,
      line: task.line,
      station: task.station,
      stationKey: task.stationKey,
      marks: task.marks,
      waiting: task.waiting
        ? {
            conversationId: task.waiting.conversationId,
            body: task.waiting.body,
            awaitsApproval: task.waiting.awaitsApproval,
          }
        : null,
    };
  },
};
