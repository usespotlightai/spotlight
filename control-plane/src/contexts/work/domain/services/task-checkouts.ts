import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { RepositoryName } from '@work/domain/value-objects/repository-name.vo';

type CheckoutDiff = 'worktree' | 'commits';

export interface TaskCheckout {
  readonly repository: Repository;
  readonly branch: Branch | null;
  readonly base: Branch | null;
  readonly ref: string | null;
  readonly diffOf: CheckoutDiff;
  readonly setup: string | null;
}

const reviewedOrAll = <T extends object | string>(
  reviewing: T | null,
  all: readonly T[],
): readonly T[] => (reviewing !== null && reviewing !== '' ? [reviewing] : all);

export const repositoriesReviewedOrAll = (
  reviewing: Repository | null,
  line: LineMap,
): readonly Repository[] => reviewedOrAll(reviewing, line.repositories.all);

export const repositoriesForTask = (
  task: Task | null,
  line: LineMap,
): readonly Repository[] =>
  repositoriesReviewedOrAll(task?.reviewedHead?.repository ?? null, line);

// A run names each repository it checks out by its full owner/name, spelled as its line spells it.
export const repositoriesRunIn = (
  task: Task,
  line: LineMap,
): readonly Repository[] =>
  repositoriesForTask(task, line).map(
    (repository) =>
      line.repositories.all.find((each) => each.equals(repository)) ??
      repository,
  );

export const repositoryForTaskNamed = (
  name: RepositoryName,
  task: Task | null,
  line: LineMap,
): Repository | null =>
  repositoriesForTask(task, line).find((each) => name.names(each)) ?? null;

export const checkoutsOf = (
  task: Task,
  line: LineMap,
): readonly TaskCheckout[] => {
  const head = task.reviewedHead;

  return repositoriesForTask(task, line).map((repository) => ({
    repository,
    branch: head ? null : task.branch,
    base: head ? null : task.base,
    ref: head?.ref ?? null,
    diffOf: head ? 'commits' : 'worktree',
    setup: line.repositories.setupOf(repository),
  }));
};
