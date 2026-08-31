import type { TaskDto, TaskPersonDto } from '@application/dto/task.dto';
import type { TaskSummary } from '@application/ports/task-reader.port';
import type { Task } from '@domain/aggregates/task.aggregate';
import { ConversationId } from '@domain/value-objects/conversation-id.vo';

export const TaskMapper = {
  awaited(task: Task): { conversationId: string } | null {
    const open = task.awaitingReview ? task.openConversation : null;

    return open
      ? {
          conversationId: ConversationId.of({
            taskId: task.id,
            from: open.from,
          }).value,
        }
      : null;
  },

  summaryToDto(summary: TaskSummary): TaskDto {
    return {
      id: summary.id,
      stationId: summary.stationId,
      title: summary.title,
      description: summary.description,
      createdAt: summary.createdAt.toISOString(),
      running: summary.running,
      awaitingReview: summary.awaitingReview,
      repository: summary.repository,
      pullRequest: summary.pullRequest,
      raisedBy: summary.raisedBy,
      note: summary.note
        ? {
            position: summary.note.position,
            station: summary.note.station,
            body: summary.note.body,
          }
        : null,
    };
  },

  /** The aggregate holds only an identity, so the caller resolves the rest. */
  taskToDto(task: Task, raisedBy: TaskPersonDto | null): TaskDto {
    const last = task.notes[task.notes.length - 1];

    return {
      id: task.id.value,
      stationId: task.stationId.value,
      title: task.title.value,
      description: task.description?.value ?? null,
      createdAt: task.createdAt.toISOString(),
      running: task.running,
      awaitingReview: TaskMapper.awaited(task),
      repository: task.repository?.value ?? null,
      pullRequest: task.pullRequest?.value ?? null,
      raisedBy,
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
