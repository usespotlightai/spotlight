import { TaskRank } from '@work/domain/value-objects/task-rank.vo';

export const Placement = {
  atTheTop(standing: readonly TaskRank[]): TaskRank {
    return Placement.below(standing, null);
  },

  atTheBack(standing: readonly TaskRank[]): TaskRank {
    return TaskRank.between(standing[standing.length - 1] ?? null, null);
  },

  below(standing: readonly TaskRank[], after: TaskRank | null): TaskRank {
    const under = after
      ? (standing.find((each) => each.value > after.value) ?? null)
      : (standing[0] ?? null);

    return TaskRank.between(after, under);
  },
};
