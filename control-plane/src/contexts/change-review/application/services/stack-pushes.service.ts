import type { ChangeStackLocksPort } from '@change-review/application/ports/change-stack-locks.port';
import type {
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import type {
  GenerateChangeStack,
  PreparedStack,
} from '@change-review/application/services/generate-change-stack.service';
import { revisedPushDiff } from '@change-review/application/services/revised-push-diff';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import {
  PushDiff,
  type PushSettlement,
} from '@change-review/domain/aggregates/push-diff.aggregate';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { InvalidDiffError } from '@change-review/domain/exceptions/invalid-diff.error';
import { InvalidPushDiffError } from '@change-review/domain/exceptions/invalid-push-diff.error';
import { PushAlreadyWaitingError } from '@change-review/domain/exceptions/push-already-waiting.error';
import { PushDiffNotLeasedError } from '@change-review/domain/exceptions/push-diff-not-leased.error';
import { PushDiffVersionConflictError } from '@change-review/domain/exceptions/push-diff-version-conflict.error';
import { UnknownPushDiffError } from '@change-review/domain/exceptions/unknown-push-diff.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import {
  latestRunStackLike,
  latestStackOf,
  pushPlacement,
  pushRedrafts,
  pushStackOf,
  pushStacking,
  recordsPush,
  supersededBy,
} from '@change-review/domain/services/pushed-stacks';
import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

type Attempt = PushSettlement | { readonly retry: string };

const STACKS_CHANGED =
  'The stacks of the task changed while the diff was made, so the push waits to be diffed again.';

type Preparation = { readonly stack: PreparedStack } | Attempt;

const isPrepared = (
  preparation: Preparation,
): preparation is { readonly stack: PreparedStack } =>
  typeof preparation === 'object' && 'stack' in preparation;

const isRetry = (attempt: Attempt): attempt is { readonly retry: string } =>
  typeof attempt === 'object' && 'retry' in attempt;

const attemptOf = (error: unknown): Attempt => {
  if (
    error instanceof InvalidDiffError ||
    error instanceof InvalidChangeStackError
  ) {
    return { refused: error.message };
  }

  throw error;
};

export interface PushToPullRequest {
  readonly workspaceId: WorkspaceId;
  readonly pullRequest: string;
  readonly head: string;
  readonly baseTip: string;
  readonly pushedBy: string | null;
  readonly byBot: boolean;
  readonly pushedAt: Date;
}

export class StackPushes {
  constructor(
    private readonly diffs: PushDiffRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly work: WorkPort,
    private readonly generating: GenerateChangeStack,
    private readonly locks: ChangeStackLocksPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async pushed(push: PushToPullRequest): Promise<void> {
    if (!pushRedrafts(push)) {
      return;
    }

    const pullRequest = PullRequestUrl.of(push.pullRequest);
    const head = CommitSha.parsed(push.head);
    const baseTip = CommitSha.parsed(push.baseTip);
    const task = await this.work.taskWithPullRequest(
      push.workspaceId,
      pullRequest,
    );

    if (!head || !baseTip || !task) {
      return;
    }

    const taskStacks = await this.stacks.ofTask(task.id);
    const followed = latestStackOf(task, taskStacks, pullRequest);
    const next = this.recorded({
      id: PushDiffId.of(this.ids.generate()),
      workspaceId: task.workspaceId,
      taskId: task.id,
      pullRequest,
      push: {
        head,
        baseTip,
        pushedBy: Pusher.of(push.pushedBy),
        pushedAt: push.pushedAt,
      },
      placement: pushPlacement(
        followed,
        await this.placementOfRun(followed, taskStacks),
      ),
      now: this.clock.now(),
    });

    if (
      !next ||
      !recordsPush(await this.diffs.ofTask(task.id), next, followed)
    ) {
      return;
    }

    try {
      await this.diffs.add(next);
    } catch (error) {
      if (!(error instanceof PushAlreadyWaitingError)) {
        throw error;
      }
    }
  }

  private recorded(
    input: Parameters<typeof PushDiff.record>[0],
  ): PushDiff | null {
    try {
      return PushDiff.record(input);
    } catch (error) {
      if (error instanceof InvalidPushDiffError) {
        return null;
      }

      throw error;
    }
  }

  async supersedeEarlier(diffId: PushDiffId): Promise<void> {
    const recorded = await this.diffs.find(diffId);

    if (!recorded) {
      return;
    }

    const earlier = supersededBy(
      await this.diffs.ofTask(recorded.taskId),
      recorded,
    );

    for (const each of earlier) {
      await revisedPushDiff(this.diffs, each.id, (found) =>
        found.supersededAt(this.clock.now()),
      );
    }
  }

  async diffed(
    diffId: string,
    runner: RunnerId,
    input: { readonly diff: string; readonly base: string },
  ): Promise<void> {
    const found = await this.leased(PushDiffId.of(diffId), runner);

    if (!found.beingDiffedBy(runner, this.clock.now())) {
      return;
    }

    const task = await this.work.task(found.taskId);

    if (!task) {
      await revisedPushDiff(this.diffs, found.id, (each) =>
        each.settledBy(runner, 'task-gone', this.clock.now()),
      );
      return;
    }

    const prepared = await this.prepared(found, task, input);

    for (let attempt = 1; ; attempt++) {
      try {
        await this.locks.stackingFor(task.id, () =>
          this.settled(found, runner, task, prepared),
        );
        return;
      } catch (error) {
        if (
          !(error instanceof PushDiffVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }

  async failed(
    diffId: string,
    runner: RunnerId,
    reason: string,
  ): Promise<void> {
    const found = await this.leased(PushDiffId.of(diffId), runner);

    await revisedPushDiff(this.diffs, found.id, (each) =>
      each.failedFor(runner, reason, this.clock.now()),
    );
  }

  private async prepared(
    diff: PushDiff,
    task: ReviewedTask,
    input: { readonly diff: string; readonly base: string },
  ): Promise<Preparation> {
    const followed = latestStackOf(
      task,
      await this.stacks.ofTask(task.id),
      diff.pullRequest,
    );
    const stacking = pushStacking(
      await this.diffs.ofTask(task.id),
      diff,
      followed,
    );

    if (stacking !== 'wanted') {
      return stacking;
    }

    const shape = pushStackOf(diff, followed);

    try {
      return {
        stack: await this.generating.prepare(
          {
            origin: shape.origin,
            taskId: shape.taskId,
            teamOfRun: shape.teamOfRun,
            trial: shape.trial,
            checkouts: shape.checkouts,
            workspaceId: shape.workspaceId,
          },
          {
            diff: input.diff,
            owner: shape.owner,
            repository: shape.repository?.value ?? null,
            base: input.base,
            request: shape.request,
          },
        ),
      };
    } catch (error) {
      return attemptOf(error);
    }
  }

  private async settled(
    diff: PushDiff,
    runner: RunnerId,
    task: ReviewedTask,
    prepared: Preparation,
  ): Promise<void> {
    const current = await this.leased(diff.id, runner);

    if (!current.beingDiffedBy(runner, this.clock.now())) {
      return;
    }

    const taskStacks = await this.stacks.ofTask(task.id);
    const stacking = pushStacking(
      await this.diffs.ofTask(task.id),
      current,
      latestStackOf(task, taskStacks, current.pullRequest),
    );
    const attempt =
      stacking === 'wanted'
        ? await this.stackedFrom(prepared, taskStacks)
        : stacking;
    const now = this.clock.now();

    await this.diffs.save(
      isRetry(attempt)
        ? current.failedFor(runner, attempt.retry, now)
        : current.settledBy(runner, attempt, now),
    );
  }

  private async stackedFrom(
    prepared: Preparation,
    taskStacks: readonly ChangeStack[],
  ): Promise<Attempt> {
    if (!isPrepared(prepared)) {
      return typeof prepared === 'string'
        ? { retry: STACKS_CHANGED }
        : prepared;
    }

    try {
      await this.generating.start(prepared.stack, taskStacks);

      return 'stacked';
    } catch (error) {
      return attemptOf(error);
    }
  }

  private async placementOfRun(
    followed: ChangeStack | null,
    taskStacks: readonly ChangeStack[],
  ): Promise<RunnerPlacement | null> {
    const runId = followed
      ? (latestRunStackLike(taskStacks, followed)?.runId ?? null)
      : null;
    const run = runId ? await this.work.run(runId) : null;

    return run?.placement ?? null;
  }

  private async leased(id: PushDiffId, runner: RunnerId): Promise<PushDiff> {
    const found = await this.diffs.find(id);

    if (!found) {
      throw new UnknownPushDiffError(id);
    }

    if (!found.answerableBy(runner, this.clock.now())) {
      throw new PushDiffNotLeasedError(id);
    }

    return found;
  }
}
