import type { Task } from '@work/domain/aggregates/task.aggregate';

export const marksReassignedFrom = (
  markedTasks: readonly Task[],
  newTask: Task,
): readonly Task[] =>
  [
    ...new Map(markedTasks.map((each) => [each.id.value, each])).values(),
  ].flatMap((markedTask) => {
    const marked = newTask.marks.reduce(
      (task, mark) => task.reassignMark(mark, newTask.id),
      markedTask,
    );

    return marked === markedTask ? [] : [marked];
  });
