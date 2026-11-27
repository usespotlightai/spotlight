import type {
  TaskRunDto,
  TeamRunDto,
} from '@work/application/dto/task-run.dto';
import { RunWaitingMapper } from '@work/application/mappers/run-waiting.mapper';
import type {
  TaskRunSummary,
  TeamRunSummary,
} from '@work/application/ports/run-reader.port';
import {
  type MessageReading,
  stoppableIn,
  waitingIn,
} from '@work/application/services/message-reading';

export const TaskRunMapper = {
  summaryToDto(summary: TaskRunSummary, reading: MessageReading): TaskRunDto {
    return {
      id: summary.id,
      state: summary.state,
      attempt: summary.attempt,
      exitCode: summary.exitCode,
      startedAt: summary.startedAt.toISOString(),
      updatedAt: summary.updatedAt.toISOString(),
      harness: summary.harness,
      image: summary.image,
      ranOn: summary.ranOn && {
        kind: summary.ranOn.kind,
        key: summary.ranOn.key,
        platform: summary.ranOn.platform,
      },
      waiting: RunWaitingMapper.toDto(summary.waiting),
      station: summary.station,
      review: summary.review && {
        state: summary.review.state,
        conversationId: summary.review.conversationId,
      },
      progress: summary.progress,
      ...waitingIn(summary.audience, reading),
      stoppableByYou: stoppableIn(summary.audience, reading),
      driver: summary.driver,
    };
  },

  teamSummaryToDto(
    summary: TeamRunSummary,
    reading: MessageReading,
  ): TeamRunDto {
    return {
      ...TaskRunMapper.summaryToDto(summary, reading),
      taskId: summary.taskId,
      taskTitle: summary.taskTitle,
      taskDescription: summary.taskDescription,
    };
  },
};
