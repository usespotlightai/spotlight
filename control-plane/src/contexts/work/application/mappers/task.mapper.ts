import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskDto } from '@work/application/dto/task.dto';
import type {
  TaskHoldSummary,
  TaskSummary,
} from '@work/application/ports/task-reader.port';
import { HoldRights } from '@work/domain/services/hold-rights';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

export interface TaskViewer {
  readonly id: string;
  readonly actsOnTasks: boolean;
}

const holdToDto = (hold: TaskHoldSummary, viewer: TaskViewer) => {
  const held = {
    by: UserId.of(hold.by.id),
    chat: hold.chatId === null ? null : ChatId.of(hold.chatId),
  };
  const person = {
    person: UserId.of(viewer.id),
    actsOnTasks: viewer.actsOnTasks,
  };

  return {
    ...hold,
    startedAt: hold.startedAt.toISOString(),
    viewerDrives: HoldRights.drives(held, person),
    viewerEnds: HoldRights.ends(held, person),
  };
};

export const TaskMapper = {
  summaryToDto(summary: TaskSummary, viewer: TaskViewer): TaskDto {
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
      finished: summary.finished,
      pullRequests: summary.pullRequests,
      createdBy: summary.createdBy,
      assignee: summary.assignee,
      source: summary.source,
      hold: summary.hold ? holdToDto(summary.hold, viewer) : null,
      runNotStarted: summary.runNotStarted,
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
