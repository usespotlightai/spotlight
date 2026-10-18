import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { marksReassignedFrom } from '@work/domain/services/marks-reassigned';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';

export const reassignTaskMarks = async (
  tasks: TaskRepository,
  newTask: Task,
): Promise<void> => {
  const markedTasks: Task[] = [];

  for (const mark of newTask.marks) {
    const correlationKeys = CorrelationKeys.of({ marks: [mark] });
    const markedTask = correlationKeys
      ? await tasks.findByMarks(newTask.workspaceId, correlationKeys)
      : null;

    if (markedTask && !markedTask.equals(newTask)) {
      markedTasks.push(markedTask);
    }
  }

  for (const marked of marksReassignedFrom(markedTasks, newTask)) {
    await tasks.save(marked);
  }
};
