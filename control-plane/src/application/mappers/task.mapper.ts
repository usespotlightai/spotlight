import type { TaskDto } from '@application/dto/task.dto';
import type { TaskSummary } from '@application/ports/task-reader.port';
import type { Task } from '@domain/aggregates/task.aggregate';

export const TaskMapper = {
  summaryToDto(summary: TaskSummary): TaskDto {
    return {
      id: summary.id,
      stationId: summary.stationId,
      title: summary.title,
      description: summary.description,
      createdAt: summary.createdAt.toISOString(),
    };
  },

  taskToDto(task: Task): TaskDto {
    return {
      id: task.id.value,
      stationId: task.stationId.value,
      title: task.title.value,
      description: task.description?.value ?? null,
      createdAt: task.createdAt.toISOString(),
    };
  },
};
