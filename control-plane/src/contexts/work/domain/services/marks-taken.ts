import type { Task } from '@work/domain/aggregates/task.aggregate';

export const marksTakenFrom = (
  wearers: readonly Task[],
  taker: Task,
): readonly Task[] =>
  [...new Map(wearers.map((each) => [each.id.value, each])).values()].flatMap(
    (wearer) => {
      const given = taker.marks.reduce(
        (task, mark) => task.markTakenBy(mark, taker.id),
        wearer,
      );

      return given === wearer ? [] : [given];
    },
  );
