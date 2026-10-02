import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import type { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';

type CheckoutDiff = 'worktree' | 'commits';

export interface TaskCheckout {
  readonly repository: Repository;
  readonly branch: Branch | null;
  readonly ref: string | null;
  readonly diffOf: CheckoutDiff;
  readonly setup: RepositorySetup | null;
}

export const repositoriesReviewedOrAll = (
  reviewing: Repository | null,
  line: Line,
): readonly Repository[] => (reviewing ? [reviewing] : line.repositories.all);

export const repositoriesWorkedOn = (
  task: Task | null,
  line: Line,
): readonly Repository[] =>
  repositoriesReviewedOrAll(task?.reviewedHead?.repository ?? null, line);

export const repositoryWorkedOnNamed = (
  name: string,
  task: Task | null,
  line: Line,
): Repository | null =>
  repositoriesWorkedOn(task, line).find((each) => each.name === name) ?? null;

export const checkoutsOf = (
  task: Task,
  line: Line,
): readonly TaskCheckout[] => {
  const head = task.reviewedHead;

  return repositoriesWorkedOn(task, line).map((repository) => ({
    repository,
    branch: head ? null : task.branch,
    ref: head?.ref ?? null,
    diffOf: head ? 'commits' : 'worktree',
    setup: line.repositories.setupOf(repository),
  }));
};
