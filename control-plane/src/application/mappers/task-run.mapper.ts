import type { TaskRunDto, TeamRunDto } from '@application/dto/task-run.dto';
import type {
  TaskRunSummary,
  TeamRunSummary,
} from '@application/ports/run-reader.port';

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
      station: summary.station,
      review: summary.review && {
        state: summary.review.state,
        conversationId: summary.review.conversationId,
      },
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
