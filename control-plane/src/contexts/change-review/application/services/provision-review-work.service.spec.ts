import { ProvisionReviewWork } from '@change-review/application/services/provision-review-work.service';
import { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import { skipOf } from '@change-review/domain/value-objects/stack-check.vo';
import type { ReviewWork } from '@runs/application/ports/review-work.port';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { ReviewWorkId } from '@shared-kernel/domain/value-objects/review-work-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T12:00:00.000Z');

const UNTIL = new Date('2026-09-24T12:05:00.000Z');

const RUNNER = RunnerId.of('pooled_1');

const OTHER = RunnerId.of('pooled_2');

const HTTP_ERROR = ProvisionFailure.of('http-error', 'answered 503');

const checkOf = (stack: string): ReviewWork => ({
  kind: 'check',
  id: ReviewWorkId.of(stack),
  recheck: false,
});

const diffOf = (id: string): ReviewWork => ({
  kind: 'diff',
  id: ReviewWorkId.of(id),
});

const waiting = (stack: string, placement: string[] = []) =>
  StackCheck.begin({
    stackId: ChangeStackId.of(stack),
    runId: RunId.of(`run_of_${stack}`),
    taskId: null,
    teamId: TeamId.of('team_1'),
    trial: false,
    workspaceId: WorkspaceId.of('ws_1'),
    request: CheckRequest.of('npm test', null, RunnerPlacement.of(placement)),
    entries: [],
    now: NOW,
  });

const sha = (digit: string) => CommitSha.parsed(digit.repeat(40)) as CommitSha;

const pushDiff = (id: string, placement: string[] = []) =>
  PushDiff.record({
    id: PushDiffId.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    taskId: TaskId.of('task_1'),
    pullRequest: PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
    push: {
      head: sha('b'),
      baseTip: sha('a'),
      pushedBy: Pusher.of('octocat'),
      pushedAt: NOW,
    },
    placement: RunnerPlacement.of(placement),
    now: NOW,
  });

const provisioning = (
  checks: readonly StackCheck[],
  conflicts = 0,
  listed: readonly StackCheck[] = checks,
  pushDiffs: readonly PushDiff[] = [],
) => {
  const storedDiffs = new Map(pushDiffs.map((each) => [each.id.value, each]));
  const savedDiffs: PushDiff[] = [];
  const diffs = {
    find: vi.fn(async (id: PushDiffId) => storedDiffs.get(id.value) ?? null),
    save: vi.fn(async (diff: PushDiff) => {
      savedDiffs.push(diff);
      storedDiffs.set(diff.id.value, diff);
    }),
    waitingIn: vi.fn(async () => pushDiffs),
    reserved: vi.fn(async () => pushDiffs),
  };
  const stored = new Map(checks.map((each) => [each.id.toString(), each]));
  let conflicting = conflicts;
  const find = vi.fn(
    async (id: StackCheckId) => stored.get(id.toString()) ?? null,
  );
  const ofStack = vi.fn(async (id: ChangeStackId) =>
    [...stored.values()].filter((each) => each.stackId.equals(id)),
  );
  const save = vi.fn(async (check: StackCheck) => {
    if (conflicting > 0) {
      conflicting -= 1;
      throw new StackCheckVersionConflictError(check.id);
    }
    stored.set(check.id.toString(), check);
  });
  const waitingIn = vi.fn(async () => listed);
  const reserved = vi.fn(async () => listed);

  return {
    find,
    save,
    waitingIn,
    savedDiffs,
    check: (stack: string) =>
      stored.get(
        StackCheckId.first(ChangeStackId.of(stack)).toString(),
      ) as StackCheck,
    diff: (id: string) => storedDiffs.get(id) as PushDiff,
    service: new ProvisionReviewWork(
      {
        find,
        ofStack,
        save,
        waitingIn,
        reserved,
      } as unknown as StackCheckRepository,
      diffs as unknown as PushDiffRepository,
    ),
  };
};

describe('ProvisionReviewWork', () => {
  it('offers only the checks still waiting for a runner to be provisioned', async () => {
    const retryScheduled = waiting('stack_3')
      .reservedFor(RUNNER, PoolId.of('pool_burst'), NOW)
      .provisionFailed(RUNNER, HTTP_ERROR, NOW);
    const { service, waitingIn } = provisioning([
      waiting('stack_1', ['gpu']),
      waiting('stack_2').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
      retryScheduled,
      waiting('stack_4')
        .claimedFor(OTHER, RunnerOffer.none(), NOW)
        .skip(OTHER, skipOf('working-copy-failed', null), NOW),
    ]);

    const offered = await service.awaiting(WorkspaceId.of('ws_1'), NOW, {
      after: null,
      max: 200,
    });

    expect(offered.waiting).toEqual([
      {
        work: checkOf('stack_1'),
        runId: RunId.of('run_of_stack_1'),
        placement: RunnerPlacement.of(['gpu']),
      },
    ]);
    expect(waitingIn).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
  });

  it('offers one page of the checks waiting to be provisioned at a time, and the page after its cursor next', async () => {
    const { service } = provisioning([
      waiting('stack_1'),
      waiting('stack_2'),
      waiting('stack_3'),
    ]);

    const first = await service.awaiting(WorkspaceId.of('ws_1'), NOW, {
      after: null,
      max: 1,
    });
    const second = await service.awaiting(WorkspaceId.of('ws_1'), NOW, {
      after: first.next,
      max: 1,
    });

    expect(first.waiting.map((each) => each.work.id.value)).toEqual([
      'stack_1',
    ]);
    expect(second.waiting.map((each) => each.work.id.value)).toEqual([
      'stack_2',
    ]);
  });

  it('keeps its place when work before the cursor leaves the queue, so no waiting check is passed over', async () => {
    const stacks = [waiting('stack_1'), waiting('stack_2'), waiting('stack_3')];
    const before = provisioning(stacks);
    const first = await before.service.awaiting(WorkspaceId.of('ws_1'), NOW, {
      after: null,
      max: 2,
    });
    const after = provisioning([
      stacks[0].reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
      stacks[1].reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
      stacks[2],
    ]);

    const next = await after.service.awaiting(WorkspaceId.of('ws_1'), NOW, {
      after: first.next,
      max: 2,
    });

    expect(next.waiting.map((each) => each.work.id.value)).toEqual(['stack_3']);
    expect(next.next).not.toBeNull();
  });

  it.each(['not a cursor', '[1,2]', '{}', '[1,2,"stack_1"]', '[1,2,[3]]'])(
    'reads from the head with a cursor it did not give: %s',
    async (cursor) => {
      const { service } = provisioning([waiting('stack_1')]);

      const offered = await service.awaiting(WorkspaceId.of('ws_1'), NOW, {
        after: cursor,
        max: 10,
      });

      expect(offered.waiting.map((each) => each.work.id.value)).toEqual([
        'stack_1',
      ]);
    },
  );

  it('goes on from the last push diff to the first check across a page boundary', async () => {
    const { service } = provisioning(
      [waiting('stack_1')],
      0,
      [waiting('stack_1')],
      [pushDiff('diff_1')],
    );

    const first = await service.awaiting(WorkspaceId.of('ws_1'), NOW, {
      after: null,
      max: 1,
    });
    const second = await service.awaiting(WorkspaceId.of('ws_1'), NOW, {
      after: first.next,
      max: 1,
    });
    const third = await service.awaiting(WorkspaceId.of('ws_1'), NOW, {
      after: second.next,
      max: 1,
    });

    expect(first.waiting.map((each) => each.work)).toEqual([diffOf('diff_1')]);
    expect(second.waiting.map((each) => each.work)).toEqual([
      checkOf('stack_1'),
    ]);
    expect(third).toEqual({ waiting: [], next: null });
  });

  it('gives no cursor for an empty page', async () => {
    const { service } = provisioning([]);

    await expect(
      service.awaiting(WorkspaceId.of('ws_1'), NOW, { after: null, max: 10 }),
    ).resolves.toEqual({ waiting: [], next: null });
  });

  it('reserves a waiting check for the runner and says until when', async () => {
    const { service, check } = provisioning([waiting('stack_1')]);

    await expect(
      service.reserve(checkOf('stack_1'), RUNNER, PoolId.of('pool_burst'), NOW),
    ).resolves.toEqual(UNTIL);
    expect(check('stack_1').reservation?.runner).toEqual(RUNNER);
    expect(check('stack_1').reservation?.pool.value).toBe('pool_burst');
  });

  it('reserves the round of the check the work names, and no other', async () => {
    const { service, find, check } = provisioning([waiting('stack_1')]);

    await expect(
      service.reserve(
        { kind: 'check', id: ReviewWorkId.of('stack_1'), recheck: true },
        RUNNER,
        PoolId.of('pool_burst'),
        NOW,
      ),
    ).resolves.toBeNull();
    expect(find).toHaveBeenCalledWith(
      StackCheckId.recheckOf(ChangeStackId.of('stack_1')),
    );
    expect(check('stack_1').reservation).toBeNull();
  });

  it('reserves nothing for a check already reserved, or one it cannot find', async () => {
    const { service, save } = provisioning([
      waiting('stack_1').reservedFor(
        RunnerId.of('pooled_9'),
        PoolId.of('pool_a'),
        NOW,
      ),
    ]);

    await expect(
      service.reserve(checkOf('stack_1'), RUNNER, PoolId.of('pool_burst'), NOW),
    ).resolves.toBeNull();
    await expect(
      service.reserve(checkOf('stack_2'), RUNNER, PoolId.of('pool_burst'), NOW),
    ).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('reserves nothing once it keeps finding the check changed', async () => {
    const { service, find } = provisioning([waiting('stack_1')], 3);

    await expect(
      service.reserve(checkOf('stack_1'), RUNNER, PoolId.of('pool_burst'), NOW),
    ).resolves.toBeNull();
    expect(find).toHaveBeenCalledTimes(3);
  });

  it('drops a reservation, and leaves alone a check that has none', async () => {
    const { service, save, check } = provisioning([
      waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
      waiting('stack_2'),
    ]);

    await service.unreserve(checkOf('stack_1'), RUNNER);
    await service.unreserve(checkOf('stack_2'), RUNNER);

    expect(check('stack_1').reservation).toBeNull();
    expect(save).toHaveBeenCalledOnce();
  });

  it('keeps a reservation another runner drops', async () => {
    const { service, save, check } = provisioning([
      waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
    ]);

    await service.unreserve(checkOf('stack_1'), OTHER);

    expect(save).not.toHaveBeenCalled();
    expect(check('stack_1').reservation?.runner).toEqual(RUNNER);
  });

  it('reads the check again and retries when it changed since it was read', async () => {
    const { service, find, check } = provisioning(
      [waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW)],
      2,
    );

    await service.unreserve(checkOf('stack_1'), RUNNER);

    expect(find).toHaveBeenCalledTimes(3);
    expect(check('stack_1').reservation).toBeNull();
  });

  it('records a failed provision on the check and schedules a retry', async () => {
    const { service, check } = provisioning(
      [waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW)],
      1,
    );

    await service.failed(checkOf('stack_1'), RUNNER, HTTP_ERROR, NOW);

    expect(check('stack_1').reservation).toBeNull();
    expect(check('stack_1').provisioning.attempts).toBe(1);
    expect(check('stack_1').provisionableAt(NOW)).toBe(false);
  });

  it('gives up after it keeps finding the check changed', async () => {
    const { service, find } = provisioning(
      [waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW)],
      3,
    );

    await expect(
      service.failed(checkOf('stack_1'), RUNNER, HTTP_ERROR, NOW),
    ).rejects.toThrow(StackCheckVersionConflictError);
    expect(find).toHaveBeenCalledTimes(3);
  });

  it('records no failure on a check that is no longer waiting', async () => {
    const { service, save } = provisioning([
      waiting('stack_1')
        .claimedFor(OTHER, RunnerOffer.none(), NOW)
        .skip(OTHER, skipOf('working-copy-failed', null), NOW),
    ]);

    await service.failed(checkOf('stack_1'), RUNNER, HTTP_ERROR, NOW);

    expect(save).not.toHaveBeenCalled();
  });

  it('records no failure another runner reports', async () => {
    const { service, save, check } = provisioning([
      waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
    ]);

    await service.failed(checkOf('stack_1'), OTHER, HTTP_ERROR, NOW);

    expect(save).not.toHaveBeenCalled();
    expect(check('stack_1').provisioning.attempts).toBe(0);
  });

  it('lists only the reservations that expired, with the runner each was for', async () => {
    const expiring = waiting('stack_1').reservedFor(
      RUNNER,
      PoolId.of('pool_burst'),
      NOW,
    );
    const later = new Date(UNTIL.getTime() + 1);
    const { service } = provisioning([
      expiring,
      waiting('stack_2').reservedFor(
        RunnerId.of('pooled_9'),
        PoolId.of('pool_a'),
        later,
      ),
      waiting('stack_3'),
    ]);

    await expect(service.expired(later)).resolves.toEqual([
      { work: checkOf('stack_1'), runner: RUNNER, until: UNTIL },
    ]);
  });

  describe('for a push waiting to be diffed', () => {
    it('offers it first, with no run, beside the checks waiting', async () => {
      const { service } = provisioning(
        [waiting('stack_1')],
        0,
        [waiting('stack_1')],
        [
          pushDiff('diff_1', ['gpu']),
          pushDiff('diff_2').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
        ],
      );

      await expect(
        service.awaiting(WorkspaceId.of('ws_1'), NOW, {
          after: null,
          max: 200,
        }),
      ).resolves.toMatchObject({
        waiting: [
          {
            work: diffOf('diff_1'),
            runId: null,
            placement: RunnerPlacement.of(['gpu']),
          },
          {
            work: checkOf('stack_1'),
            runId: RunId.of('run_of_stack_1'),
            placement: RunnerPlacement.anywhere(),
          },
        ],
      });
    });

    it('reserves it for the runner and leaves the checks alone', async () => {
      const { service, diff, save } = provisioning(
        [],
        0,
        [],
        [pushDiff('diff_1')],
      );

      await expect(
        service.reserve(diffOf('diff_1'), RUNNER, PoolId.of('pool_burst'), NOW),
      ).resolves.toEqual(UNTIL);
      expect(diff('diff_1').reservation?.runner).toEqual(RUNNER);
      expect(save).not.toHaveBeenCalled();
    });

    it('reserves nothing for a push diff already reserved', async () => {
      const { service, savedDiffs } = provisioning(
        [],
        0,
        [],
        [pushDiff('diff_1').reservedFor(OTHER, PoolId.of('pool_a'), NOW)],
      );

      await expect(
        service.reserve(diffOf('diff_1'), RUNNER, PoolId.of('pool_burst'), NOW),
      ).resolves.toBeNull();
      expect(savedDiffs).toEqual([]);
    });

    it('drops its reservation, and records a failed provision on it', async () => {
      const reserved = () =>
        pushDiff('diff_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW);
      const dropping = provisioning([], 0, [], [reserved()]);
      const failing = provisioning([], 0, [], [reserved()]);

      await dropping.service.unreserve(diffOf('diff_1'), RUNNER);
      await failing.service.failed(diffOf('diff_1'), RUNNER, HTTP_ERROR, NOW);

      expect(dropping.diff('diff_1').reservation).toBeNull();
      expect(failing.diff('diff_1').reservation).toBeNull();
      expect(failing.diff('diff_1').provisioning.attempts).toBe(1);
      expect(failing.diff('diff_1').provisionableAt(NOW)).toBe(false);
    });

    it('touches only the stack checks for a check, and only the push diffs for a push, even when both share an id', async () => {
      const asCheck = provisioning(
        [waiting('shared')],
        0,
        [waiting('shared')],
        [pushDiff('shared')],
      );
      const asDiff = provisioning(
        [waiting('shared')],
        0,
        [waiting('shared')],
        [pushDiff('shared')],
      );

      await expect(
        asCheck.service.reserve(
          checkOf('shared'),
          RUNNER,
          PoolId.of('pool_burst'),
          NOW,
        ),
      ).resolves.toEqual(UNTIL);
      await expect(
        asDiff.service.reserve(
          diffOf('shared'),
          RUNNER,
          PoolId.of('pool_burst'),
          NOW,
        ),
      ).resolves.toEqual(UNTIL);
      await asCheck.service.unreserve(checkOf('shared'), RUNNER);
      await asDiff.service.failed(diffOf('shared'), RUNNER, HTTP_ERROR, NOW);

      expect(asCheck.savedDiffs).toEqual([]);
      expect(asCheck.save).toHaveBeenCalledTimes(2);
      expect(asCheck.diff('shared').reservation).toBeNull();
      expect(asDiff.save).not.toHaveBeenCalled();
      expect(asDiff.savedDiffs).toHaveLength(2);
      expect(asDiff.check('shared').reservation).toBeNull();
      expect(asDiff.diff('shared').provisioning.attempts).toBe(1);
    });

    it('lists its expired reservation with the expired checks', async () => {
      const later = new Date(UNTIL.getTime() + 1);
      const { service } = provisioning(
        [waiting('stack_1').reservedFor(OTHER, PoolId.of('pool_a'), NOW)],
        0,
        undefined,
        [
          pushDiff('diff_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
          pushDiff('diff_2').reservedFor(OTHER, PoolId.of('pool_a'), later),
        ],
      );

      await expect(service.expired(later)).resolves.toEqual([
        { work: diffOf('diff_1'), runner: RUNNER, until: UNTIL },
        { work: checkOf('stack_1'), runner: OTHER, until: UNTIL },
      ]);
    });
  });
});
