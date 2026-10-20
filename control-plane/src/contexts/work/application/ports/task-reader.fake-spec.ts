import type {
  TaskReaderPort,
  TaskSummary,
} from '@work/application/ports/task-reader.port';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Work } from '@work/domain/value-objects/run-state';

const person = (id: string) => ({ id, name: 'Ada', image: null });

const summaryOf = (task: Task, work: Work | null): TaskSummary => ({
  id: task.id.value,
  stationId: task.stationId.value,
  revision: task.revision.value,
  title: task.title.value,
  description: task.description?.value ?? null,
  attachments: [],
  createdAt: task.createdAt,
  work,
  awaitingReview: null,
  pullRequest: null,
  note: null,
  createdBy: task.createdBy ? person(task.createdBy.value) : null,
  assignee: task.assignee ? person(task.assignee.value) : null,
});

export const taskReaderOver = (
  latest: () => Task | undefined,
  work: Work | null = null,
): TaskReaderPort => ({
  listForTeamMember: async () => {
    const found = latest();
    return found ? [summaryOf(found, work)] : [];
  },
  findForTeamMember: async (_teamId, _userId, taskId) => {
    const found = latest();
    return found?.id.equals(taskId) ? summaryOf(found, work) : null;
  },
});
