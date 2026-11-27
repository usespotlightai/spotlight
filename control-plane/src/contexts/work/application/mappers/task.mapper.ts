import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskDto } from '@work/application/dto/task.dto';
import type {
  TaskHoldSummary,
  TaskSummary,
} from '@work/application/ports/task-reader.port';
import type { MessageReading } from '@work/application/services/message-reading';
import type { ConversationViewer } from '@work/domain/services/conversation-audience';
import { HandMoves, mayWaitAt } from '@work/domain/services/hand-moves';
import { type HeldFor, HoldRights } from '@work/domain/services/hold-rights';
import type { MessagedTask } from '@work/domain/services/message-effect';
import { TaskWaits } from '@work/domain/services/task-waits';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

const heldOf = (hold: TaskHoldSummary): HeldFor => ({
  by: UserId.of(hold.by.id),
  chat: hold.chatId === null ? null : ChatId.of(hold.chatId),
});

const holdToDto = (hold: TaskHoldSummary, viewer: ConversationViewer) => {
  const held = heldOf(hold);

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

const blockableAt = (line: LineMap | null, summary: TaskSummary): boolean => {
  const station = line?.stationAt(StationId.of(summary.stationId));

  return station ? mayWaitAt(station) : false;
};

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
      pullRequests: summary.pullRequests,
      createdBy: summary.createdBy,
      assignee: summary.assignee,
      source: summary.source,
      hold: summary.hold ? holdToDto(summary.hold, viewer) : null,
      runNotStarted: summary.runNotStarted,
      handMoves: HandMoves.of(
        {
          stationId: StationId.of(summary.stationId),
          hold: summary.hold && heldOf(summary.hold),
          awaiting: summary.awaitingReview,
          finished: summary.finished,
          blocked: summary.blockedBy.length > 0,
        },
        reading.lineOf(summary.stationId),
        viewer,
      ).map((move) => ({
        stationId: move.to.id.value,
        denial: move.denial,
        skips: move.skips.map((each) => each.id.value),
        sendsBack: move.sendsBack,
      })),
      blockedBy: summary.blockedBy,
      blockable: blockableAt(reading.lineOf(summary.stationId), summary),
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
