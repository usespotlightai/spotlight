import type { Task } from '@work/domain/aggregates/task.aggregate';

export const marksTakenFrom = (
  markedTasks: readonly Task[],
  taker: Task,
): readonly Task[] =>
  [
    ...new Map(markedTasks.map((each) => [each.id.value, each])).values(),
  ].flatMap((markedTask) => {
    const marked = taker.marks.reduce(
      (task, mark) => task.markTakenBy(mark, taker.id),
      markedTask,
    );

    return marked === markedTask ? [] : [marked];
  });
