import type { TaskRunDto } from '@application/dto/task-run.dto';
import type { TaskRunSummary } from '@application/ports/run-reader.port';

export const TaskRunMapper = {
  summaryToDto(summary: TaskRunSummary): TaskRunDto {
    return {
      id: summary.id,
      state: summary.state,
      attempt: summary.attempt,
      exitCode: summary.exitCode,
      startedAt: summary.startedAt.toISOString(),
      updatedAt: summary.updatedAt.toISOString(),
    };
  },
};
