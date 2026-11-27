import { ExpireWaitingReviewWork } from '@change-review/application/services/expire-waiting-review-work.service';
import { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { StackCheckReservationDropped } from '@change-review/domain/events/stack-check-reservation-dropped.event';
import { PushDiffVersionConflictError } from '@change-review/domain/exceptions/push-diff-version-conflict.error';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { commitSha } from '@change-review/domain/value-objects/commit-sha.fake-spec';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { RepositoryStack } from '@change-review/domain/value-objects/repository-stack.vo';
import { WAITING_LIMIT_MS } from '@change-review/domain/value-objects/runner-assignment.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const BEGAN = new Date('2026-09-24T12:00:00.000Z');

const NOW = new Date(BEGAN.getTime() + WAITING_LIMIT_MS + 1);

const waiting = (stack: string) =>
  StackCheck.begin({
    stackId: ChangeStackId.of(stack),
    runId: RunId.of(`run_of_${stack}`),
    taskId: null,
    teamId: TeamId.of('team_1'),
    trial: false,
    workspaceId: WorkspaceId.of('ws_1'),
    request: CheckRequest.of('npm test', null),
    stack: RepositoryStack.of({ repository: null, startedAt: BEGAN }),
    entries: [],
    now: BEGAN,
  });

const NO_DIFFS = partial<PushDiffRepository>({
  waiting: async () => [],
});

const pushDiff = (id: string, at: Date) =>
  PushDiff.record({
    id: PushDiffId.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TaskId.of('task_1'),
    pullRequest: PullRequestUrl.of(`https://github.com/acme/${id}/pull/7`),
    push: {
      head: commitSha('b'),
      baseTip: commitSha('a'),
      pushedBy: Pusher.of('octocat'),
      pushedAt: at,
    },
    placement: RunnerPlacement.anywhere(),
    now: at,
  });

const expiring = (
  expired: readonly StackCheck[],
  conflicting: readonly string[] = [],
) => {
  const saved: StackCheck[] = [];
  const save = vi.fn(async (check: StackCheck) => {
    if (conflicting.includes(check.stackId.value)) {
      throw new StackCheckVersionConflictError(check.id);
    }
    saved.push(check);
  });
  const listed = vi.fn(async () => expired);
  const logged = vi.fn();

  return {
    saved,
    save,
    listed,
    logged,
    expire: new ExpireWaitingReviewWork(
      partial<StackCheckRepository>({ waiting: listed, save }),
      NO_DIFFS,
      { now: () => NOW, sleep: async () => {} },
      partial<LoggerPort>({ error: logged }),
    ),
  };
};

describe('ExpireWaitingReviewWork', () => {
  it('leaves a check that still waits within its limit', async () => {
    const fresh = StackCheck.begin({
      stackId: ChangeStackId.of('stack_9'),
      runId: RunId.of('run_of_stack_9'),
      taskId: null,
      teamId: TeamId.of('team_1'),
      trial: false,
      workspaceId: WorkspaceId.of('ws_1'),
      request: CheckRequest.of('npm test', null),
      stack: RepositoryStack.of({ repository: null, startedAt: NOW }),
      entries: [],
      now: NOW,
    });
    const { expire, save } = expiring([fresh]);

    await expire.processDue();

    expect(save).not.toHaveBeenCalled();
  });

  it('skips every check nobody claimed in time as a queue timeout', async () => {
    const { expire, saved, listed } = expiring([
      waiting('stack_1'),
      waiting('stack_2'),
    ]);

    await expire.processDue();

    expect(listed).toHaveBeenCalled();
    expect(saved.map((each) => each.stackId.value)).toEqual([
      'stack_1',
      'stack_2',
    ]);
    expect(saved.map((each) => each.skippedAt(NOW))).toEqual([
      { code: 'queue-timeout', detail: null },
      { code: 'queue-timeout', detail: null },
    ]);
  });

  it('leaves alone a check a runner claimed since it was listed', async () => {
    const taken = waiting('stack_1').claimedFor(
      RunnerId.of('runner_1'),
      RunnerOffer.none(),
      new Date(NOW.getTime() - 1_000),
    );
    const { expire, save } = expiring([taken]);

    await expire.processDue();

    expect(save).not.toHaveBeenCalled();
  });

  it('carries on past a check that changed while it was being expired', async () => {
    const reserved = waiting('stack_1').reservedFor(
      RunnerId.of('pooled_1'),
      PoolId.of('pool_1'),
      new Date(BEGAN.getTime() + WAITING_LIMIT_MS - 60_000),
    );
    const { expire, saved } = expiring(
      [reserved, waiting('stack_2')],
      ['stack_1'],
    );

    await expire.processDue();

    expect(saved.map((each) => each.stackId.value)).toEqual(['stack_2']);
  });

  it('saves the runner provisioned for a check it expires as released, together with the expired check', async () => {
    const reserved = waiting('stack_1').reservedFor(
      RunnerId.of('pooled_1'),
      PoolId.of('pool_1'),
      new Date(BEGAN.getTime() + WAITING_LIMIT_MS - 60_000),
    );
    const { expire, saved } = expiring([reserved]);

    await expire.processDue();

    expect(saved[0]?.pullEvents()).toContainEqual(
      new StackCheckReservationDropped(
        StackCheckId.first(ChangeStackId.of('stack_1')),
        RunnerId.of('pooled_1'),
      ),
    );
  });

  it('logs any other failure and carries on with the rest', async () => {
    const saved: string[] = [];
    const logged = vi.fn();
    const expire = new ExpireWaitingReviewWork(
      partial<StackCheckRepository>({
        waiting: async () => [waiting('stack_1'), waiting('stack_2')],
        save: async (check: StackCheck) => {
          if (check.stackId.value === 'stack_1') {
            throw new Error('the database went away');
          }
          saved.push(check.stackId.value);
        },
      }),
      NO_DIFFS,
      { now: () => NOW, sleep: async () => {} },
      partial<LoggerPort>({ error: logged }),
    );

    await expire.processDue();

    expect(logged).toHaveBeenCalledOnce();
    expect(saved).toEqual(['stack_2']);
  });

  it('fails a push diff nobody read in time, and leaves a fresh one waiting', async () => {
    const saved: PushDiff[] = [];
    const stale = pushDiff('diff_1', BEGAN);
    const fresh = pushDiff('diff_2', NOW);
    const expire = new ExpireWaitingReviewWork(
      partial<StackCheckRepository>({ waiting: async () => [] }),
      partial<PushDiffRepository>({
        waiting: async () => [stale, fresh],
        save: async (diff: PushDiff) => {
          saved.push(diff);
        },
      }),
      { now: () => NOW, sleep: async () => {} },
      partial<LoggerPort>({ error: vi.fn() }),
    );

    await expire.processDue();

    expect(saved.map((each) => [each.id.value, each.status])).toEqual([
      ['diff_1', 'failed'],
    ]);
    expect(saved[0]?.failure).toBe('No runner made the diff in time.');
  });

  it('takes a push diff another writer changed first as handled', async () => {
    const logged = vi.fn();
    const expire = new ExpireWaitingReviewWork(
      partial<StackCheckRepository>({ waiting: async () => [] }),
      partial<PushDiffRepository>({
        waiting: async () => [pushDiff('diff_1', BEGAN)],
        save: async (diff: PushDiff) => {
          throw new PushDiffVersionConflictError(diff.id);
        },
      }),
      { now: () => NOW, sleep: async () => {} },
      partial<LoggerPort>({ error: logged }),
    );

    await expire.processDue();

    expect(logged).not.toHaveBeenCalled();
  });
});
