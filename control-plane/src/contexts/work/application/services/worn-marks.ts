import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { marksTakenFrom } from '@work/domain/services/marks-taken';
import { Concerns } from '@work/domain/value-objects/concerns.vo';

export const takeWornMarks = async (
  tasks: TaskRepository,
  taker: Task,
): Promise<void> => {
  const wearers: Task[] = [];

  for (const mark of taker.marks) {
    const concerns = Concerns.of({ marks: [mark] });
    const wearer = concerns
      ? await tasks.holding(taker.workspaceId, concerns)
      : null;

    if (wearer && !wearer.equals(taker)) {
      wearers.push(wearer);
    }
  }

  for (const given of marksTakenFrom(wearers, taker)) {
    await tasks.save(given);
  }
};
