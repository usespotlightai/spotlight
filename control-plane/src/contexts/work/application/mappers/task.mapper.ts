import type { TaskDto, TaskPersonDto } from '@work/application/dto/task.dto';
import type { TaskSummary } from '@work/application/ports/task-reader.port';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';

export const TaskMapper = {
  awaited(task: Task): { conversationId: string } | null {
    const pending = task.pendingConversation;

    return pending
      ? {
          conversationId: ConversationId.of({
            taskId: task.id,
            from: pending.from,
          }).value,
        }
      : null;
  },

  summaryToDto(summary: TaskSummary): TaskDto {
    return {
      id: summary.id,
      stationId: summary.stationId,
      revision: summary.revision,
      title: summary.title,
      description: summary.description,
      attachments: summary.attachments,
      createdAt: summary.createdAt.toISOString(),
      running: summary.running,
      awaitingReview: summary.awaitingReview,
      pullRequest: summary.pullRequest,
      raisedBy: summary.raisedBy,
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

  taskToDto(
    task: Task,
    raisedBy: TaskPersonDto | null,
    assignee: TaskPersonDto | null,
  ): TaskDto {
    const last = task.notes[task.notes.length - 1];

    return {
      id: task.id.value,
      stationId: task.stationId.value,
      revision: task.revision.value,
      title: task.title.value,
      description: task.description?.value ?? null,
      attachments: task.attachments.map((each) => ({
        id: each.id.value,
        name: each.name,
        contentType: each.contentType,
        size: each.size,
      })),
      createdAt: task.createdAt.toISOString(),
      running: task.working,
      awaitingReview: TaskMapper.awaited(task),
      pullRequest: task.pullRequest?.value ?? null,
      raisedBy,
      assignee,
      note: last
        ? {
            position: task.notes.length - 1,
            station: last.station.value,
            body: last.body.value,
          }
        : null,
    };
  },
};
