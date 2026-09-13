import type { TaskPlacement } from '@domain/repositories/task.repository';
import { TaskRank } from '@domain/value-objects/task-rank.vo';

export const Placement = {
  atTheTop(standing: readonly TaskPlacement[]): TaskRank {
    return Placement.below(standing, null);
  },

  atTheBack(standing: readonly TaskPlacement[]): TaskRank {
    return TaskRank.between(standing[standing.length - 1]?.rank ?? null, null);
  },

  below(
    standing: readonly TaskPlacement[],
    after: TaskPlacement | null,
  ): TaskRank {
    const under = standing[after ? standing.indexOf(after) + 1 : 0] ?? null;

    return TaskRank.between(after?.rank ?? null, under?.rank ?? null);
  },
};
