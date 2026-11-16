import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type { ChangeStackState } from '@change-review/domain/value-objects/stack-progress.vo';
import { isShownForTask } from '@change-review/domain/value-objects/stack-progress.vo';

export interface StackStart {
  readonly id: string;
  readonly startedAt: Date;
}

export interface ShownStack extends StackStart {
  readonly repository: RepositoryName | null;
  readonly state: ChangeStackState;
}

export const newestFirst = <T>(
  stacks: readonly T[],
  startOf: (item: T) => StackStart,
): T[] =>
  [...stacks].sort((a, b) => {
    const one = startOf(a);
    const other = startOf(b);

    return (
      other.startedAt.getTime() - one.startedAt.getTime() ||
      other.id.localeCompare(one.id)
    );
  });

export const latestShownPerRepository = <T>(
  stacks: readonly T[],
  shownOf: (item: T) => ShownStack,
): T[] =>
  newestFirst(stacks, shownOf).reduce<T[]>((latest, item) => {
    const { repository, state } = shownOf(item);

    return isShownForTask(state) &&
      !latest.some((each) =>
        RepositoryName.same(shownOf(each).repository, repository),
      )
      ? [...latest, item]
      : latest;
  }, []);
