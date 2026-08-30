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
      running: summary.running,
      awaitingReview: summary.awaitingReview,
      note: summary.note
        ? {
            position: summary.note.position,
            station: summary.note.station,
            body: summary.note.body,
          }
        : null,
    };
  },

  taskToDto(task: Task): TaskDto {
    const last = task.notes[task.notes.length - 1];

    return {
      id: task.id.value,
      stationId: task.stationId.value,
      title: task.title.value,
      description: task.description?.value ?? null,
      createdAt: task.createdAt.toISOString(),
      running: task.running,
      awaitingReview: task.awaitingReview,
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
