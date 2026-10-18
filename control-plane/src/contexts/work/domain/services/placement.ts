import { TaskRank } from '@work/domain/value-objects/task-rank.vo';

export const Placement = {
  atTheTop(ranks: readonly TaskRank[]): TaskRank {
    return Placement.below(ranks, null);
  },

  atTheBack(ranks: readonly TaskRank[]): TaskRank {
    return TaskRank.between(ranks[ranks.length - 1] ?? null, null);
  },

  below(ranks: readonly TaskRank[], after: TaskRank | null): TaskRank {
    const under = after
      ? (ranks.find((each) => each.value > after.value) ?? null)
      : (ranks[0] ?? null);

    return TaskRank.between(after, under);
  },
};
