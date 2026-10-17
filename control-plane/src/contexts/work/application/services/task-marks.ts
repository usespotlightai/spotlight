import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { marksTakenFrom } from '@work/domain/services/marks-taken';
import { Concerns } from '@work/domain/value-objects/concerns.vo';

export const takeTaskMarks = async (
  tasks: TaskRepository,
  taker: Task,
): Promise<void> => {
  const markedTasks: Task[] = [];

  for (const mark of taker.marks) {
    const concerns = Concerns.of({ marks: [mark] });
    const markedTask = concerns
      ? await tasks.findByMarks(taker.workspaceId, concerns)
      : null;

    if (markedTask && !markedTask.equals(taker)) {
      markedTasks.push(markedTask);
    }
  }

  for (const given of marksTakenFrom(markedTasks, taker)) {
    await tasks.save(given);
  }
};
