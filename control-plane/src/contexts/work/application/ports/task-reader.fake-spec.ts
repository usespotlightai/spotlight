import type {
  TaskReaderPort,
  TaskSummary,
} from '@work/application/ports/task-reader.port';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Progress } from '@work/domain/value-objects/run-state';

const person = (id: string) => ({ id, name: 'Ada', image: null });

const summaryOf = (task: Task, progress: Progress | null): TaskSummary => ({
  id: task.id.value,
  stationId: task.stationId.value,
  revision: task.revision.value,
  title: task.title.value,
  description: task.description?.value ?? null,
  attachments: [],
  createdAt: task.createdAt,
  progress,
  awaitingReview: null,
  pullRequest: null,
  note: null,
  createdBy: task.createdBy ? person(task.createdBy.value) : null,
  assignee: task.assignee ? person(task.assignee.value) : null,
});

export const taskReaderOver = (
  latest: () => Task | undefined,
  progress: Progress | null = null,
): TaskReaderPort => ({
  listForTeamMember: async () => {
    const found = latest();
    return found ? [summaryOf(found, progress)] : [];
  },
  findForTeamMember: async (_teamId, _userId, taskId) => {
    const found = latest();
    return found?.id.equals(taskId) ? summaryOf(found, progress) : null;
  },
});
