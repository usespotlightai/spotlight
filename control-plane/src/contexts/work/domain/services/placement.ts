import { TaskRank } from '@work/domain/value-objects/task-rank.vo';

export type QueueEntry = 'opened' | 'passed-on' | 'deferred' | 'reacted';

const atTheTop = (ranks: readonly TaskRank[]): TaskRank =>
  Placement.below(ranks, null);

const atTheBack = (ranks: readonly TaskRank[]): TaskRank =>
  TaskRank.between(ranks[ranks.length - 1] ?? null, null);

export const Placement = {
  entering(entry: QueueEntry, ranks: readonly TaskRank[]): TaskRank {
    return entry === 'opened' || entry === 'passed-on'
      ? atTheBack(ranks)
      : atTheTop(ranks);
  },

  below(ranks: readonly TaskRank[], after: TaskRank | null): TaskRank {
    const under = after
      ? (ranks.find((each) => each.value > after.value) ?? null)
      : (ranks[0] ?? null);

    return TaskRank.between(after, under);
  },
};
