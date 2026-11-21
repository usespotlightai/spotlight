import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type {
  PushDiff,
  PushSettlement,
} from '@change-review/domain/aggregates/push-diff.aggregate';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import {
  latestPerPullRequest,
  type TaskPullRequests,
} from '@change-review/domain/services/pull-request-routing';
import {
  latestShownPerRepository,
  newestFirst,
  type ShownStack,
} from '@change-review/domain/services/shown-stacks';
import type { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import type { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const shownOf = (stack: ChangeStack): ShownStack => ({
  id: stack.id.value,
  startedAt: stack.startedAt,
  repository: stack.repository,
  state: stack.state,
});

export const latestStackOf = (
  task: TaskPullRequests,
  stacks: readonly ChangeStack[],
  pullRequest: PullRequestUrl,
): ChangeStack | null =>
  latestPerPullRequest(
    task,
    latestShownPerRepository(stacks, shownOf),
    (stack) => stack.repository,
  ).find((share) => share.pullRequest.equals(pullRequest))?.items[0] ?? null;

export const latestRunStackLike = (
  stacks: readonly ChangeStack[],
  like: ChangeStack,
): ChangeStack | null =>
  newestFirst(stacks, shownOf).find(
    (each) =>
      each.runId !== null &&
      RepositoryName.same(each.repository, like.repository),
  ) ?? null;

export const showsPush = (
  latest: ChangeStack | null,
  head: CommitSha,
): boolean => latest?.origin.kind === 'push' && latest.origin.head.equals(head);

const pushOrder = (a: PushDiff, b: PushDiff): number =>
  a.push.pushedAt.getTime() - b.push.pushedAt.getTime() ||
  a.recordedAt.getTime() - b.recordedAt.getTime() ||
  a.id.value.localeCompare(b.id.value);

const otherPushes = (diffs: readonly PushDiff[], diff: PushDiff): PushDiff[] =>
  diffs.filter(
    (each) =>
      !each.id.equals(diff.id) &&
      RepositoryName.same(each.repository, diff.repository),
  );

export const pushSuperseded = (
  diffs: readonly PushDiff[],
  next: PushDiff,
): boolean =>
  otherPushes(diffs, next).some(
    (each) =>
      (each.status === 'waiting' &&
        (each.push.head.equals(next.push.head) || pushOrder(each, next) > 0)) ||
      (each.status === 'diffed' && pushOrder(each, next) > 0),
  );

export const supersededBy = (
  diffs: readonly PushDiff[],
  next: PushDiff,
): PushDiff[] =>
  otherPushes(diffs, next).filter(
    (each) => each.status === 'waiting' && pushOrder(each, next) < 0,
  );

export const stackedLater = (
  diffs: readonly PushDiff[],
  diff: PushDiff,
  latest: ChangeStack | null,
): boolean =>
  otherPushes(diffs, diff).some(
    (each) =>
      pushOrder(each, diff) > 0 &&
      (each.status === 'diffed' || showsPush(latest, each.push.head)),
  );

const waitingBefore = (diffs: readonly PushDiff[], next: PushDiff): boolean =>
  supersededBy(diffs, next).length > 0;

export const pushPlacement = (
  followed: ChangeStack | null,
  ranAt: RunnerPlacement | null,
): RunnerPlacement =>
  followed?.request?.placement ?? ranAt ?? RunnerPlacement.anywhere();

export const pushRedrafts = (push: { readonly byBot: boolean }): boolean =>
  !push.byBot;

export const recordsPush = (
  diffs: readonly PushDiff[],
  next: PushDiff,
  followed: ChangeStack | null,
): boolean =>
  followed !== null &&
  !pushSuperseded(diffs, next) &&
  (!showsPush(followed, next.push.head) || waitingBefore(diffs, next));

export type PushStacking =
  | 'wanted'
  | Extract<PushSettlement, 'shown' | 'superseded'>;

export const pushStacking = (
  diffs: readonly PushDiff[],
  diff: PushDiff,
  latest: ChangeStack | null,
): PushStacking => {
  if (showsPush(latest, diff.push.head)) {
    return 'shown';
  }

  return stackedLater(diffs, diff, latest) ? 'superseded' : 'wanted';
};

export interface PushStack {
  readonly origin: StackOrigin;
  readonly taskId: TaskId;
  readonly workspaceId: WorkspaceId;
  readonly teamOfRun: null;
  readonly trial: false;
  readonly checkouts: 1;
  readonly owner: string;
  readonly repository: RepositoryName | null;
  readonly request: CheckRequest | null;
}

const ownerOf = (diff: PushDiff): string => {
  const repository = diff.pullRequest.repository;

  if (!repository) {
    throw InvalidChangeStackError.because(
      'needs a pull request that names its repository',
    );
  }

  return repository.owner;
};

export const pushStackOf = (
  diff: PushDiff,
  followed: ChangeStack | null,
): PushStack => ({
  origin: StackOrigin.push(diff.push.head, diff.push.pushedBy),
  owner: ownerOf(diff),
  taskId: diff.taskId,
  workspaceId: diff.workspaceId,
  teamOfRun: null,
  trial: false,
  checkouts: 1,
  repository: followed ? followed.repository : diff.repository,
  request: followed?.request ?? null,
});
