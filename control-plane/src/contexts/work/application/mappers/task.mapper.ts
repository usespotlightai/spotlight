import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskDto } from '@work/application/dto/task.dto';
import type {
  TaskHoldSummary,
  TaskSummary,
} from '@work/application/ports/task-reader.port';
import type { MessageReading } from '@work/application/services/message-reading';
import type { ConversationViewer } from '@work/domain/services/conversation-audience';
import { HoldRights } from '@work/domain/services/hold-rights';
import type { MessagedTask } from '@work/domain/services/message-effect';
import { SendBack } from '@work/domain/services/send-back';
import { TaskWaits } from '@work/domain/services/task-waits';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';

const holdToDto = (hold: TaskHoldSummary, viewer: ConversationViewer) => {
  const held = {
    by: UserId.of(hold.by.id),
    chat: hold.chatId === null ? null : ChatId.of(hold.chatId),
  };

  return {
    ...hold,
    startedAt: hold.startedAt.toISOString(),
    viewerDrives: HoldRights.drives(held, viewer),
    viewerEnds: HoldRights.ends(held, viewer),
  };
};

const messagedTaskOf = (
  summary: TaskSummary,
  reading: MessageReading,
): MessagedTask => ({
  running: summary.running,
  finished: summary.finished,
  ...reading.stationOf(summary.stationId),
  hold: summary.hold && {
    chat: summary.hold.chatId === null ? null : ChatId.of(summary.hold.chatId),
  },
  pending: summary.awaitingReview && {
    assignee: summary.assignee ? UserId.of(summary.assignee.id) : null,
    ask: summary.awaitingReview.ask,
  },
});

export const TaskMapper = {
  summaryToDto(summary: TaskSummary, reading: MessageReading): TaskDto {
    const { viewer } = reading;

    return {
      id: summary.id,
      stationId: summary.stationId,
      revision: summary.revision,
      title: summary.title,
      description: summary.description,
      attachments: summary.attachments,
      createdAt: summary.createdAt.toISOString(),
      progress: summary.progress,
      awaitingReview: summary.awaitingReview && {
        conversationId: summary.awaitingReview.conversationId,
      },
      ...TaskWaits.forViewer(messagedTaskOf(summary, reading), viewer),
      finished: summary.finished,
      sendsBackTo: SendBack.targets(
        {
          stationId: StationId.of(summary.stationId),
          finished: summary.finished,
        },
        reading.lineOf(summary.stationId),
      ).map((id) => id.value),
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
