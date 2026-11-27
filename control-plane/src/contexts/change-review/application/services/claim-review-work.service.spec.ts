import type { PatchWriterPort } from '@change-review/application/ports/patch-writer.port';
import { ClaimReviewWork } from '@change-review/application/services/claim-review-work.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { PushDiffVersionConflictError } from '@change-review/domain/exceptions/push-diff-version-conflict.error';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { commitSha as sha } from '@change-review/domain/value-objects/commit-sha.fake-spec';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { RepositoryStack } from '@change-review/domain/value-objects/repository-stack.vo';
import { WAITING_LIMIT_MS } from '@change-review/domain/value-objects/runner-assignment.vo';
import { MAX_LEASE_MS } from '@change-review/domain/value-objects/runner-claim.vo';
import { skipOf } from '@change-review/domain/value-objects/stack-check.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import type { ReviewWork } from '@runs/application/ports/review-work.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
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

const NOW = new Date('2026-09-23T09:00:00.000Z');
const LAPTOP = RunnerOffer.of(['laptop']);
const RUNNER = RunnerId.of('pooled_1');
const STACK_WORK: ReviewWork = {
  kind: 'check',
  id: ReviewWorkId.of('stack_1'),
  recheck: false,
};
const DIFF_WORK: ReviewWork = { kind: 'diff', id: ReviewWorkId.of('diff_1') };

const completed = () =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of('stack_1'),
    origin: StackOrigin.run(RunId.of('run_1')),
    taskId: null,
    teamOfRun: TeamId.of('team_1'),
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of('ws_1'),
    owner: 'acme',
    repository: null,
    base: null,
    diff: Diff.of([
      {
        path: 'schema.ts',
        previousPath: null,
        status: 'modified',
        binary: false,
        hunks: [
          {
            id: HunkId.at(1),
            oldStart: 1,
            oldLines: 1,
            newStart: 1,
            newLines: 1,
            patch: '@@ -1 +1 @@\n-before\n+after',
          },
        ],
      },
    ]),
    facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
    request: CheckRequest.of('npm test', null),
    now: NOW,
  }).propose(
    [
      {
        kind: 'change',
        title: 'Schema',
        intent: 'Schema',
        layers: [
          {
            title: 'Schema',
            summary: 'Schema',
            dependsOn: [],
            hunks: [{ hunk: HunkId.of('h1') }],
            notes: [{ path: 'schema.ts', note: 'Why' }],
            questions: [],
          },
        ],
      },
    ],
    NOW,
  );

const waitingCheck = (placement = RunnerPlacement.anywhere()) => {
  const stack = completed();

  return StackCheck.begin({
    stackId: stack.id,
    runId: stack.runId,
    taskId: null,
    teamId: TeamId.of('team_1'),
    trial: false,
    workspaceId: stack.workspaceId,
    request: CheckRequest.of('npm test', null, placement),
    stack: RepositoryStack.of({ repository: null, startedAt: NOW }),
    entries: stack.entries(),
    now: NOW,
  });
};

const pushDiff = (id = 'diff_1', placement = RunnerPlacement.anywhere()) =>
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
    placement,
    now: NOW,
  });

const diffsOf = (
  found: readonly PushDiff[],
  conflicts: readonly string[] = [],
) => {
  const stored = new Map(found.map((each) => [each.id.value, each]));
  const saved: PushDiff[] = [];

  return {
    saved,
    repository: partial<PushDiffRepository>({
      waitingIn: () => Promise.resolve([...stored.values()]),
      reservedFor: (runner: RunnerId) =>
        Promise.resolve(
          [...stored.values()].filter(
            (each) => each.reservation?.isFor(runner) === true,
          ),
        ),
      find: (id: PushDiffId) => Promise.resolve(stored.get(id.value) ?? null),
      save: (diff: PushDiff) => {
        if (conflicts.includes(diff.id.value)) {
          return Promise.reject(new PushDiffVersionConflictError(diff.id));
        }
        saved.push(diff);
        stored.set(diff.id.value, diff);
        return Promise.resolve();
      },
    }),
  };
};

const NO_DIFFS = partial<PushDiffRepository>({
  waitingIn: () => Promise.resolve([]),
  reservedFor: () => Promise.resolve([]),
  find: () => Promise.resolve(null),
});

const reservedFor = (runner: RunnerId) =>
  waitingCheck().reservedFor(runner, PoolId.of('pool_burst'), NOW);

const claimingReserved = (found: StackCheck | null) => {
  const saved: StackCheck[] = [];
  const listedFor = vi.fn(() => Promise.resolve(found ? [found] : []));

  return {
    saved,
    listedFor,
    service: new ClaimReviewWork(
      partial<StackCheckRepository>({
        reservedFor: listedFor,
        save: (check: StackCheck) => {
          saved.push(check);
          return Promise.resolve();
        },
      }),
      partial<ChangeStackRepository>({
        find: () => Promise.resolve(completed()),
      }),
      { patchOf: () => 'diff' },
      { inTransaction: (work) => work() },
      NO_DIFFS,
    ),
  };
};

describe('ClaimReviewWork', () => {
  it('hands a runner no check placed on runners it does not answer to', async () => {
    const waitingIn = vi.fn(() =>
      Promise.resolve([waitingCheck(RunnerPlacement.of(['vpc-internal']))]),
    );
    const find = vi.fn();

    const claimed = await new ClaimReviewWork(
      partial<StackCheckRepository>({ waitingIn }),
      partial<ChangeStackRepository>({ find }),
      partial<PatchWriterPort>({}),
      { inTransaction: (work) => work() },
      NO_DIFFS,
    ).claimNext(WorkspaceId.of('ws_1'), RunnerId.of('runner_1'), LAPTOP, NOW);

    expect(claimed).toBeNull();
    expect(find).not.toHaveBeenCalled();
    expect(waitingIn).toHaveBeenCalledWith(WorkspaceId.of('ws_1'));
  });

  it('claims in the order of review work, whatever order the repository gives', async () => {
    const first = waitingCheck();
    const later = StackCheck.begin({
      stackId: ChangeStackId.of('stack_2'),
      runId: first.runId,
      taskId: null,
      teamId: TeamId.of('team_1'),
      trial: false,
      workspaceId: first.workspaceId,
      request: first.request,
      stack: first.stack,
      entries: first.entries,
      now: NOW,
    });
    const saved: StackCheck[] = [];

    await new ClaimReviewWork(
      partial<StackCheckRepository>({
        waitingIn: () => Promise.resolve([later, first]),
        save: (check: StackCheck) => {
          saved.push(check);
          return Promise.resolve();
        },
      }),
      partial<ChangeStackRepository>({
        find: () => Promise.resolve(completed()),
      }),
      { patchOf: () => 'diff' },
      { inTransaction: (work) => work() },
      NO_DIFFS,
    ).claimNext(WorkspaceId.of('ws_1'), RUNNER, LAPTOP, NOW);

    expect(saved.map((each) => each.stackId.value)).toEqual(['stack_1']);
  });

  it('claims the next waiting check when another runner took the first one meanwhile', async () => {
    const first = waitingCheck();
    const second = StackCheck.begin({
      stackId: ChangeStackId.of('stack_2'),
      runId: first.runId,
      taskId: null,
      teamId: TeamId.of('team_1'),
      trial: false,
      workspaceId: first.workspaceId,
      request: first.request,
      stack: first.stack,
      entries: first.entries,
      now: NOW,
    });
    const saved: StackCheck[] = [];

    const claimed = await new ClaimReviewWork(
      partial<StackCheckRepository>({
        waitingIn: () => Promise.resolve([first, second]),
        save: (check: StackCheck) => {
          if (check.stackId.equals(first.stackId)) {
            return Promise.reject(new StackCheckVersionConflictError(check.id));
          }
          saved.push(check);
          return Promise.resolve();
        },
      }),
      partial<ChangeStackRepository>({
        find: () => Promise.resolve(completed()),
      }),
      { patchOf: () => 'diff' },
      { inTransaction: (work) => work() },
      NO_DIFFS,
    ).claimNext(WorkspaceId.of('ws_1'), RUNNER, LAPTOP, NOW);

    expect(claimed).not.toBeNull();
    expect(saved.map((each) => each.stackId.value)).toEqual(['stack_2']);
  });

  describe('for a runner started for a reserved check', () => {
    it('claims the check reserved for it and drops the reservation', async () => {
      const { service, saved, listedFor } = claimingReserved(
        reservedFor(RUNNER),
      );

      const claimed = await service.claimReserved(RUNNER, LAPTOP, NOW);

      expect(claimed).toMatchObject({
        kind: 'check',
        checkId: ReviewWorkId.of('stack_1'),
        command: 'npm test',
      });
      expect(claimed).not.toHaveProperty('runId');
      expect(listedFor).toHaveBeenCalledWith(RUNNER);
      expect(saved[0]?.claim.claimedBy).toEqual(RUNNER);
      expect(saved[0]?.reservation).toBeNull();
    });

    it('claims no check placed on runners it does not answer to', async () => {
      const { service, saved } = claimingReserved(
        waitingCheck(RunnerPlacement.of(['vpc-internal'])).reservedFor(
          RUNNER,
          PoolId.of('pool_burst'),
          NOW,
        ),
      );

      await expect(
        service.claimReserved(RUNNER, LAPTOP, NOW),
      ).resolves.toBeNull();
      expect(saved).toEqual([]);
    });

    it('claims no check reserved for another runner', async () => {
      const { service, saved } = claimingReserved(
        reservedFor(RunnerId.of('pooled_2')),
      );

      await expect(
        service.claimReserved(RUNNER, LAPTOP, NOW),
      ).resolves.toBeNull();
      expect(saved).toEqual([]);
    });

    it('claims nothing where no check is reserved for it', async () => {
      const { service, saved } = claimingReserved(null);

      await expect(
        service.claimReserved(RUNNER, LAPTOP, NOW),
      ).resolves.toBeNull();
      expect(saved).toEqual([]);
    });
  });

  describe('for a check whose stack is gone', () => {
    const orphaned = (check: StackCheck) => {
      const removed: StackCheck[] = [];
      const saved: StackCheck[] = [];

      return {
        removed,
        saved,
        service: new ClaimReviewWork(
          partial<StackCheckRepository>({
            waitingIn: () => Promise.resolve([check]),
            reservedFor: () => Promise.resolve([check]),
            save: (each: StackCheck) => {
              saved.push(each);
              return Promise.resolve();
            },
            remove: (each: StackCheck) => {
              removed.push(each);
              return Promise.resolve();
            },
          }),
          partial<ChangeStackRepository>({ find: () => Promise.resolve(null) }),
          { patchOf: () => 'diff' },
          { inTransaction: (work) => work() },
          NO_DIFFS,
        ),
      };
    };

    it('passes over it and leaves its removal to the deletion reactions', async () => {
      const { service, removed, saved } = orphaned(waitingCheck());

      await expect(
        service.claimNext(WorkspaceId.of('ws_1'), RUNNER, LAPTOP, NOW),
      ).resolves.toBeNull();
      expect(removed).toEqual([]);
      expect(saved).toEqual([]);
    });

    it('does not claim a reserved one either', async () => {
      const { service, removed, saved } = orphaned(reservedFor(RUNNER));

      await expect(
        service.claimReserved(RUNNER, LAPTOP, NOW),
      ).resolves.toBeNull();
      expect(removed).toEqual([]);
      expect(saved).toEqual([]);
    });
  });

  describe('unclaiming a check its runner could not take', () => {
    const unclaiming = (stored: StackCheck | null, clashes = 0) => {
      const saved: StackCheck[] = [];
      let left = clashes;

      return {
        saved,
        service: new ClaimReviewWork(
          partial<StackCheckRepository>({
            find: () => Promise.resolve(stored),
            save: (check: StackCheck) => {
              if (left > 0) {
                left -= 1;
                return Promise.reject(
                  new StackCheckVersionConflictError(check.id),
                );
              }
              saved.push(check);
              return Promise.resolve();
            },
          }),
          partial<ChangeStackRepository>({}),
          partial<PatchWriterPort>({}),
          { inTransaction: (work) => work() },
          NO_DIFFS,
        ),
      };
    };

    it('puts the check back to be claimed, the claim not counted', async () => {
      const { service, saved } = unclaiming(
        waitingCheck().claimedFor(RUNNER, LAPTOP, NOW),
      );

      await service.unclaim(STACK_WORK, RUNNER, NOW);

      expect(saved[0]?.claim.claimedBy).toBeNull();
      expect(saved[0]?.claim.attempts).toBe(0);
    });

    it('leaves a check that another runner leases, or that nobody leases, as it is', async () => {
      const unclaimed = unclaiming(
        waitingCheck().claimedFor(RunnerId.of('runner_9'), LAPTOP, NOW),
      );
      const free = unclaiming(waitingCheck());

      await unclaimed.service.unclaim(STACK_WORK, RUNNER, NOW);
      await free.service.unclaim(STACK_WORK, RUNNER, NOW);

      expect(unclaimed.saved).toEqual([]);
      expect(free.saved).toEqual([]);
    });

    it('tries again when the check changed while it was unclaimed', async () => {
      const { service, saved } = unclaiming(
        waitingCheck().claimedFor(RUNNER, LAPTOP, NOW),
        1,
      );

      await service.unclaim(STACK_WORK, RUNNER, NOW);

      expect(saved).toHaveLength(1);
    });
  });

  describe('renewing the lease of a check its runner is still working', () => {
    const renewing = (found: StackCheck | null, clashes = 0) => {
      const saved: StackCheck[] = [];
      let left = clashes;

      return {
        saved,
        service: new ClaimReviewWork(
          partial<StackCheckRepository>({
            find: () => Promise.resolve(found),
            save: (check: StackCheck) => {
              if (left > 0) {
                left -= 1;
                return Promise.reject(
                  new StackCheckVersionConflictError(check.id),
                );
              }
              saved.push(check);
              return Promise.resolve();
            },
          }),
          partial<ChangeStackRepository>({}),
          partial<PatchWriterPort>({}),
          { inTransaction: (work) => work() },
          NO_DIFFS,
        ),
      };
    };

    const leased = () => waitingCheck().claimedFor(RUNNER, LAPTOP, NOW);

    const leaseOf = (check: StackCheck) =>
      check.claim.leaseExpiresAt?.getTime() ?? 0;

    it('renews the lease of the runner on the check past the first lease period', async () => {
      const check = leased();
      const nearlyExpired = new Date(leaseOf(check) - 1000);
      const { service, saved } = renewing(check);

      await expect(
        service.renewLease(STACK_WORK, RUNNER, nearlyExpired),
      ).resolves.toBe('renewed');
      expect(
        saved[0]?.beingCheckedBy(RUNNER, new Date(leaseOf(check) + 1000)),
      ).toBe(true);
    });

    it('keeps renewing past the hour while the runner still has the lease on the check', async () => {
      const check = waitingCheck().claimedFor(
        RUNNER,
        LAPTOP,
        new Date(NOW.getTime() + WAITING_LIMIT_MS - 60_000),
      );
      const { service, saved } = renewing(check);

      await expect(
        service.renewLease(
          STACK_WORK,
          RUNNER,
          new Date(NOW.getTime() + WAITING_LIMIT_MS + 1),
        ),
      ).resolves.toBe('renewed');
      expect(saved).toHaveLength(1);
    });

    it('tries again when the check changed while it was renewed', async () => {
      const { service, saved } = renewing(leased(), 2);

      await expect(service.renewLease(STACK_WORK, RUNNER, NOW)).resolves.toBe(
        'renewed',
      );
      expect(saved).toHaveLength(1);
    });

    it('gives up once the check keeps moving on', async () => {
      const { service, saved } = renewing(leased(), 3);

      await expect(service.renewLease(STACK_WORK, RUNNER, NOW)).rejects.toThrow(
        StackCheckVersionConflictError,
      );
      expect(saved).toEqual([]);
    });

    it('tells the runner to stop once the check was deleted with its task', async () => {
      const { service, saved } = renewing(null);

      await expect(service.renewLease(STACK_WORK, RUNNER, NOW)).resolves.toBe(
        'stop',
      );
      expect(saved).toEqual([]);
    });

    it('tells the runner to stop once the check ended, or its lease expired past the hour', async () => {
      const skipped = renewing(
        leased().skip(RUNNER, skipOf('working-copy-failed', null), NOW),
      );
      const expired = renewing(leased());

      await expect(
        skipped.service.renewLease(STACK_WORK, RUNNER, NOW),
      ).resolves.toBe('stop');
      await expect(
        expired.service.renewLease(
          STACK_WORK,
          RUNNER,
          new Date(NOW.getTime() + WAITING_LIMIT_MS + 1),
        ),
      ).resolves.toBe('stop');
      expect(skipped.saved).toEqual([]);
      expect(expired.saved).toEqual([]);
    });

    it('answers a runner without the lease on the check as it answers one naming no check at all', async () => {
      const check = leased();
      const expired = new Date(leaseOf(check) + 1000);
      const elsewhere = renewing(check);
      const expiring = renewing(check);
      const missing = renewing(null);

      await expect(
        elsewhere.service.renewLease(STACK_WORK, RunnerId.of('runner_9'), NOW),
      ).resolves.toBe('stop');
      await expect(
        expiring.service.renewLease(STACK_WORK, RUNNER, expired),
      ).resolves.toBe('stop');
      await expect(
        missing.service.renewLease(STACK_WORK, RunnerId.of('runner_9'), NOW),
      ).resolves.toBe('stop');
      expect([...elsewhere.saved, ...expiring.saved]).toEqual([]);
    });

    it('tells a runner that kept renewing past the most a check may be leased to stop', async () => {
      const ceiling = NOW.getTime() + MAX_LEASE_MS;
      let check = leased();
      for (let at = NOW.getTime(); at < ceiling; at += 5 * 60_000) {
        check = check.renewedFor(RUNNER, new Date(at));
      }
      const { service, saved } = renewing(check);

      expect(leaseOf(check)).toBeGreaterThan(ceiling);
      await expect(
        service.renewLease(STACK_WORK, RUNNER, new Date(ceiling)),
      ).resolves.toBe('stop');
      expect(saved).toEqual([]);
    });
  });

  describe('with pushes waiting to be diffed', () => {
    const claiming = (
      diffs: readonly PushDiff[],
      checks: readonly StackCheck[] = [waitingCheck()],
      conflicts: readonly string[] = [],
    ) => {
      const pushes = diffsOf(diffs, conflicts);
      const savedChecks: StackCheck[] = [];

      return {
        savedDiffs: pushes.saved,
        savedChecks,
        service: new ClaimReviewWork(
          partial<StackCheckRepository>({
            waitingIn: () => Promise.resolve(checks),
            reservedFor: () => Promise.resolve(checks),
            find: () => Promise.resolve(checks[0] ?? null),
            ofStack: () => Promise.resolve(checks),
            save: (check: StackCheck) => {
              savedChecks.push(check);
              return Promise.resolve();
            },
          }),
          partial<ChangeStackRepository>({
            find: () => Promise.resolve(completed()),
          }),
          { patchOf: () => 'diff' },
          { inTransaction: (work) => work() },
          pushes.repository,
        ),
      };
    };

    it('hands a runner the push to diff before any check, with what it needs to diff it', async () => {
      const { service, savedDiffs, savedChecks } = claiming([pushDiff()]);

      const claimed = await service.claimNext(
        WorkspaceId.of('ws_1'),
        RUNNER,
        LAPTOP,
        NOW,
      );

      expect(claimed).toEqual({
        kind: 'diff',
        diffId: ReviewWorkId.of('diff_1'),
        repository: 'widgets',
        baseTip: sha('a').value,
        head: sha('b').value,
      });
      expect(savedDiffs[0]?.beingDiffedBy(RUNNER, NOW)).toBe(true);
      expect(savedChecks).toEqual([]);
    });

    it('passes over a push placed on runners it does not answer to, or one another runner took meanwhile, and claims the check', async () => {
      const { service, savedDiffs, savedChecks } = claiming(
        [
          pushDiff('diff_gpu', RunnerPlacement.of(['gpu'])),
          pushDiff('diff_taken'),
        ],
        [waitingCheck()],
        ['diff_taken'],
      );

      const claimed = await service.claimNext(
        WorkspaceId.of('ws_1'),
        RUNNER,
        LAPTOP,
        NOW,
      );

      expect(claimed).toMatchObject({
        kind: 'check',
        checkId: ReviewWorkId.of('stack_1'),
      });
      expect(savedDiffs).toEqual([]);
      expect(savedChecks).toHaveLength(1);
    });

    it('claims the push reserved for a provisioned runner, and none reserved for another', async () => {
      const mine = claiming(
        [pushDiff().reservedFor(RUNNER, PoolId.of('pool_burst'), NOW)],
        [],
      );
      const theirs = claiming(
        [
          pushDiff().reservedFor(
            RunnerId.of('pooled_2'),
            PoolId.of('pool_burst'),
            NOW,
          ),
        ],
        [],
      );

      await expect(
        mine.service.claimReserved(RUNNER, LAPTOP, NOW),
      ).resolves.toMatchObject({
        kind: 'diff',
        diffId: ReviewWorkId.of('diff_1'),
      });
      expect(mine.savedDiffs[0]?.reservation).toBeNull();
      await expect(
        theirs.service.claimReserved(RUNNER, LAPTOP, NOW),
      ).resolves.toBeNull();
      expect(theirs.savedDiffs).toEqual([]);
    });

    it('lists the placements of the pushes still claimable, ahead of the checks', async () => {
      const { service } = claiming(
        [
          pushDiff('diff_gpu', RunnerPlacement.of(['gpu'])),
          pushDiff('diff_leased').claimedFor(RUNNER, LAPTOP, NOW),
        ],
        [waitingCheck(RunnerPlacement.of(['laptop']))],
      );

      await expect(
        service.waitingPlacements(WorkspaceId.of('ws_1'), NOW),
      ).resolves.toEqual([
        RunnerPlacement.of(['gpu']),
        RunnerPlacement.of(['laptop']),
      ]);
    });

    it('puts a push back to be claimed when its runner could not take it, and leaves one another runner leases', async () => {
      const mine = claiming([pushDiff().claimedFor(RUNNER, LAPTOP, NOW)]);
      const theirs = claiming([
        pushDiff().claimedFor(RunnerId.of('runner_9'), LAPTOP, NOW),
      ]);

      await mine.service.unclaim(DIFF_WORK, RUNNER, NOW);
      await theirs.service.unclaim(DIFF_WORK, RUNNER, NOW);

      expect(mine.savedDiffs[0]?.claim.claimedBy).toBeNull();
      expect(mine.savedDiffs[0]?.claim.attempts).toBe(0);
      expect(mine.savedChecks).toEqual([]);
      expect(theirs.savedDiffs).toEqual([]);
    });

    it('renews the lease of the runner diffing a push, and tells any other runner to stop', async () => {
      const leased = pushDiff().claimedFor(RUNNER, LAPTOP, NOW);
      const later = new Date(NOW.getTime() + 60_000);
      const mine = claiming([leased], []);
      const theirs = claiming([leased], []);

      await expect(
        mine.service.renewLease(DIFF_WORK, RUNNER, later),
      ).resolves.toBe('renewed');
      await expect(
        theirs.service.renewLease(DIFF_WORK, RunnerId.of('runner_9'), later),
      ).resolves.toBe('stop');
      expect(
        (mine.savedDiffs[0]?.claim.leaseExpiresAt?.getTime() ?? 0) >
          (leased.claim.leaseExpiresAt?.getTime() ?? 0),
      ).toBe(true);
      expect(theirs.savedDiffs).toEqual([]);
    });

    it('tries again when the push changed while it was unclaimed or renewed', async () => {
      const leased = pushDiff().claimedFor(RUNNER, LAPTOP, NOW);
      const later = new Date(NOW.getTime() + 60_000);
      const savedOnce = () => {
        let refused = false;
        const saved: PushDiff[] = [];

        return {
          saved,
          repository: partial<PushDiffRepository>({
            find: () => Promise.resolve(leased),
            save: (diff: PushDiff) => {
              if (!refused) {
                refused = true;
                return Promise.reject(
                  new PushDiffVersionConflictError(diff.id),
                );
              }
              saved.push(diff);
              return Promise.resolve();
            },
          }),
        };
      };
      const unclaiming = savedOnce();
      const renewing = savedOnce();
      const serviceOf = (diffs: PushDiffRepository) =>
        new ClaimReviewWork(
          partial<StackCheckRepository>({}),
          partial<ChangeStackRepository>({}),
          { patchOf: () => 'diff' },
          { inTransaction: (work) => work() },
          diffs,
        );

      await serviceOf(unclaiming.repository).unclaim(DIFF_WORK, RUNNER, NOW);
      await expect(
        serviceOf(renewing.repository).renewLease(DIFF_WORK, RUNNER, later),
      ).resolves.toBe('renewed');

      expect(unclaiming.saved).toHaveLength(1);
      expect(renewing.saved).toHaveLength(1);
    });

    it('looks for a check only among the stack checks, and for a push only among the push diffs', async () => {
      const checks = {
        find: vi.fn(() =>
          Promise.resolve(waitingCheck().claimedFor(RUNNER, LAPTOP, NOW)),
        ),
        save: vi.fn(async () => {}),
      };
      const diffs = {
        find: vi.fn(() =>
          Promise.resolve(pushDiff().claimedFor(RUNNER, LAPTOP, NOW)),
        ),
        save: vi.fn(async () => {}),
      };
      const service = new ClaimReviewWork(
        partial<StackCheckRepository>(checks),
        partial<ChangeStackRepository>({}),
        partial<PatchWriterPort>({}),
        { inTransaction: (work) => work() },
        partial<PushDiffRepository>(diffs),
      );

      await service.unclaim(STACK_WORK, RUNNER, NOW);
      await expect(service.renewLease(STACK_WORK, RUNNER, NOW)).resolves.toBe(
        'renewed',
      );

      expect(diffs.find).not.toHaveBeenCalled();
      expect(diffs.save).not.toHaveBeenCalled();
      expect(checks.save).toHaveBeenCalledTimes(2);

      checks.find.mockClear();
      checks.save.mockClear();

      await service.unclaim(DIFF_WORK, RUNNER, NOW);
      await expect(service.renewLease(DIFF_WORK, RUNNER, NOW)).resolves.toBe(
        'renewed',
      );

      expect(checks.find).not.toHaveBeenCalled();
      expect(checks.save).not.toHaveBeenCalled();
      expect(diffs.save).toHaveBeenCalledTimes(2);
    });

    it('tells a runner to stop when it names a push as a check, even one it leases', async () => {
      const { service, savedDiffs } = claiming(
        [pushDiff().claimedFor(RUNNER, LAPTOP, NOW)],
        [],
      );

      await expect(
        service.renewLease(
          { kind: 'check', id: ReviewWorkId.of('diff_1'), recheck: false },
          RUNNER,
          NOW,
        ),
      ).resolves.toBe('stop');
      expect(savedDiffs).toEqual([]);
    });

    it('says whether the runner leases the push', async () => {
      const { service } = claiming(
        [pushDiff().claimedFor(RUNNER, LAPTOP, NOW)],
        [],
      );

      await expect(
        service.isLeasedBy(
          { kind: 'diff', id: ReviewWorkId.of('diff_1') },
          RUNNER,
          NOW,
        ),
      ).resolves.toBe(true);
      await expect(
        service.isLeasedBy(
          { kind: 'diff', id: ReviewWorkId.of('diff_1') },
          RunnerId.of('runner_9'),
          NOW,
        ),
      ).resolves.toBe(false);
    });
  });
});
