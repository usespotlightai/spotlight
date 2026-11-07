import type {
  TaskRunDto,
  TeamRunDto,
} from '@work/application/dto/task-run.dto';
import type {
  TaskRunSummary,
  TeamRunSummary,
} from '@work/application/ports/run-reader.port';
import {
  type Progress,
  progressOfCurrentRun,
} from '@work/domain/value-objects/run-state';
import type { TaskRunState } from '@work/domain/value-objects/task-run-state';

const progressOfTaskRun = (
  run: { readonly state: TaskRunState; readonly stopRequested: boolean },
  takenUp: boolean,
): Progress | null =>
  run.state === 'superseded'
    ? null
    : progressOfCurrentRun({ ...run, state: run.state }, takenUp);

export const TaskRunMapper = {
  summaryToDto(summary: TaskRunSummary): TaskRunDto {
    return {
      id: summary.id,
      state: summary.state,
      attempt: summary.attempt,
      exitCode: summary.exitCode,
      startedAt: summary.startedAt.toISOString(),
      updatedAt: summary.updatedAt.toISOString(),
      harness: summary.harness,
      image: summary.image,
      station: summary.station,
      review: summary.review && {
        state: summary.review.state,
        conversationId: summary.review.conversationId,
      },
      progress: progressOfTaskRun(summary, summary.takenUpOnAnswer),
    };
  },

  teamSummaryToDto(summary: TeamRunSummary): TeamRunDto {
    return {
      ...TaskRunMapper.summaryToDto(summary),
      taskId: summary.taskId,
      taskTitle: summary.taskTitle,
      taskDescription: summary.taskDescription,
    };
  },
};
