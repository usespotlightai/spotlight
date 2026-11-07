import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { RepositoryName } from '@work/domain/value-objects/repository-name.vo';
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
  readonly setup: string | null;
}

export const reviewedOrAll = <T>(
  reviewing: T | null,
  all: readonly T[],
): readonly T[] => (reviewing ? [reviewing] : all);

export const repositoriesReviewedOrAll = (
  reviewing: Repository | null,
  line: LineMap,
): readonly Repository[] => reviewedOrAll(reviewing, line.repositories.all);

export const repositoriesForTask = (
  task: Task | null,
  line: LineMap,
): readonly Repository[] =>
  repositoriesReviewedOrAll(task?.reviewedHead?.repository ?? null, line);

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
    ref: head?.ref ?? null,
    diffOf: head ? 'commits' : 'worktree',
    setup: line.repositories.setupOf(repository),
  }));
};

export const runCheckoutsFor = (task: Task, line: LineMap): RunCheckout[] =>
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
    ...(checkout.setup ? { setup: checkout.setup } : {}),
  }));
