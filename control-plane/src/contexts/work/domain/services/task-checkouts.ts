import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import type { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';
import {
  REMOTE_VIA_GIT_PROXY,
  type RunCheckout,
} from '@work/domain/value-objects/run-spec.vo';

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

export const repositoriesForTask = (
  task: Task | null,
  line: Line,
): readonly Repository[] =>
  repositoriesReviewedOrAll(task?.reviewedHead?.repository ?? null, line);

export const repositoryForTaskNamed = (
  name: string,
  task: Task | null,
  line: Line,
): Repository | null =>
  repositoriesForTask(task, line).find((each) => each.name === name) ?? null;

export const checkoutsOf = (
  task: Task,
  line: Line,
): readonly TaskCheckout[] => {
  const head = task.reviewedHead;

  return repositoriesForTask(task, line).map((repository) => ({
    repository,
    branch: head ? null : task.branch,
    ref: head?.ref ?? null,
    diffOf: head ? 'commits' : 'worktree',
    setup: line.repositories.setupOf(repository),
  }));
};

export const runCheckoutsFor = (task: Task, line: Line): RunCheckout[] =>
  runCheckoutsOf(checkoutsOf(task, line));

export const runCheckoutsOf = (
  checkouts: readonly TaskCheckout[],
): RunCheckout[] =>
  checkouts.map((checkout) => ({
    remote: REMOTE_VIA_GIT_PROXY,
    path: checkout.repository.name,
    ...(checkout.branch ? { branch: checkout.branch.value } : {}),
    ...(checkout.ref ? { ref: checkout.ref } : {}),
    ...(checkout.diffOf === 'commits' ? { diffOf: checkout.diffOf } : {}),
    ...(checkout.setup ? { setup: checkout.setup.value } : {}),
  }));
