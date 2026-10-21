import type { TaskDto } from '@work/application/dto/task.dto';
import type { TaskSummary } from '@work/application/ports/task-reader.port';

export const TaskMapper = {
  summaryToDto(summary: TaskSummary): TaskDto {
    return {
      id: summary.id,
      stationId: summary.stationId,
      revision: summary.revision,
      title: summary.title,
      description: summary.description,
      attachments: summary.attachments,
      createdAt: summary.createdAt.toISOString(),
      progress: summary.progress,
      awaitingReview: summary.awaitingReview,
      pullRequest: summary.pullRequest,
      createdBy: summary.createdBy,
      assignee: summary.assignee,
      note: summary.note
        ? {
            position: summary.note.position,
            station: summary.note.station,
            body: summary.note.body,
          }
        : null,
    };
  },
};
