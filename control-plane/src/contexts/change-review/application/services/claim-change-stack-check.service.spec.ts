import type { PatchWriterPort } from '@change-review/application/ports/patch-writer.port';
import { ClaimChangeStackCheck } from '@change-review/application/services/claim-change-stack-check.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import { UnknownChangeStackError } from '@change-review/domain/exceptions/unknown-change-stack.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { MAX_LEASE_MS } from '@change-review/domain/value-objects/check-claim.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import {
  skipOf,
  WAITING_LIMIT_MS,
} from '@change-review/domain/value-objects/stack-check.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-23T09:00:00.000Z');
const LAPTOP = RunnerTerms.of(['laptop']);
const RUNNER = RunnerId.of('pooled_1');

const completed = () =>
  ChangeStack.draft({
    id: ChangeStackId.of('stack_1'),
    runId: RunId.of('run_1'),
    taskId: null,
    replay: false,
    isSearch: false,
    workspaceId: WorkspaceId.of('ws_1'),
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
    facts: StackFacts.none(),
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
            ranges: [{ hunk: HunkId.of('h1') }],
            notes: [{ path: 'schema.ts', note: 'Why' }],
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
    replay: false,
    workspaceId: stack.workspaceId,
    request: CheckRequest.of('npm test', null, placement),
    entries: stack.entries(),
    now: NOW,
  });
};

const reservedFor = (runner: RunnerId) =>
  waitingCheck().reservedFor(runner, PoolId.of('pool_burst'), NOW);

const claimingReserved = (found: StackCheck | null) => {
  const saved: StackCheck[] = [];
  const reservedTo = vi.fn(async () => found);

  return {
    saved,
    reservedTo,
    service: new ClaimChangeStackCheck(
      {
        reservedTo,
        save: async (check: StackCheck) => {
          saved.push(check);
        },
      } as unknown as StackCheckRepository,
      { find: async () => completed() } as unknown as ChangeStackRepository,
      { patchOf: () => 'diff' } as PatchWriterPort,
      { inTransaction: (work) => work() } as TransactionPort,
    ),
  };
};

describe('ClaimChangeStackCheck', () => {
  it('hands a runner no check placed on runners it does not answer to', async () => {
    const dueForCheck = vi.fn(async () =>
      waitingCheck(RunnerPlacement.of(['vpc-internal'])),
    );
    const find = vi.fn();

    const claimed = await new ClaimChangeStackCheck(
      { dueForCheck } as unknown as StackCheckRepository,
      { find } as unknown as ChangeStackRepository,
      {} as PatchWriterPort,
      { inTransaction: (work) => work() } as TransactionPort,
    ).claimNext(WorkspaceId.of('ws_1'), RunnerId.of('runner_1'), LAPTOP, NOW);

    expect(claimed).toBeNull();
    expect(find).not.toHaveBeenCalled();
    expect(dueForCheck).toHaveBeenCalledWith(
      expect.objectContaining({ terms: LAPTOP }),
      NOW,
    );
  });

  describe('for a runner started for a reserved check', () => {
    it('claims the check reserved for it and drops the reservation', async () => {
      const { service, saved, reservedTo } = claimingReserved(
        reservedFor(RUNNER),
      );

      const claimed = await service.claimReserved(RUNNER, LAPTOP, NOW);

      expect(claimed).toMatchObject({
        stackId: 'stack_1',
        runId: 'run_1',
        command: 'npm test',
      });
      expect(reservedTo).toHaveBeenCalledWith(RUNNER, NOW);
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
        service: new ClaimChangeStackCheck(
          {
            dueForCheck: async () => check,
            reservedTo: async () => check,
            save: async (each: StackCheck) => {
              saved.push(each);
            },
            remove: async (each: StackCheck) => {
              removed.push(each);
            },
          } as unknown as StackCheckRepository,
          { find: async () => null } as unknown as ChangeStackRepository,
          { patchOf: () => 'diff' } as PatchWriterPort,
          { inTransaction: (work) => work() } as TransactionPort,
        ),
      };
    };

    it('forgets the check so it no longer heads the queue', async () => {
      const { service, removed, saved } = orphaned(waitingCheck());

      await expect(
        service.claimNext(WorkspaceId.of('ws_1'), RUNNER, LAPTOP, NOW),
      ).resolves.toBeNull();
      expect(removed.map((each) => each.stackId.value)).toEqual(['stack_1']);
      expect(saved).toEqual([]);
    });

    it('releases the runner reserved for it as it forgets it', async () => {
      const { service, removed } = orphaned(reservedFor(RUNNER));

      await expect(
        service.claimReserved(RUNNER, LAPTOP, NOW),
      ).resolves.toBeNull();
      expect(removed[0]?.reservation).toBeNull();
      expect(removed[0]?.pullEvents().map((each) => each.kind)).toEqual([
        'change-stack.check-reservation-dropped',
      ]);
    });
  });

  describe('unclaiming a check its runner could not take', () => {
    const unclaiming = (stored: StackCheck | null, clashes = 0) => {
      const saved: StackCheck[] = [];
      let left = clashes;

      return {
        saved,
        service: new ClaimChangeStackCheck(
          {
            find: async () => stored,
            save: async (check: StackCheck) => {
              if (left > 0) {
                left -= 1;
                throw new StackCheckVersionConflictError(check.stackId.value);
              }
              saved.push(check);
            },
          } as unknown as StackCheckRepository,
          {} as ChangeStackRepository,
          {} as PatchWriterPort,
          { inTransaction: (work) => work() } as TransactionPort,
        ),
      };
    };

    it('puts the check back to be claimed, the claim not counted', async () => {
      const { service, saved } = unclaiming(
        waitingCheck().claimedFor(RUNNER, LAPTOP, NOW),
      );

      await service.unclaim('stack_1', false, RUNNER, NOW);

      expect(saved[0]?.claim.claimedBy).toBeNull();
      expect(saved[0]?.claim.attempts).toBe(0);
    });

    it('leaves a check that another runner leases, or that nobody leases, as it is', async () => {
      const unclaimed = unclaiming(
        waitingCheck().claimedFor(RunnerId.of('runner_9'), LAPTOP, NOW),
      );
      const free = unclaiming(waitingCheck());

      await unclaimed.service.unclaim('stack_1', false, RUNNER, NOW);
      await free.service.unclaim('stack_1', false, RUNNER, NOW);

      expect(unclaimed.saved).toEqual([]);
      expect(free.saved).toEqual([]);
    });

    it('tries again when the check changed while it was unclaimed', async () => {
      const { service, saved } = unclaiming(
        waitingCheck().claimedFor(RUNNER, LAPTOP, NOW),
        1,
      );

      await service.unclaim('stack_1', false, RUNNER, NOW);

      expect(saved).toHaveLength(1);
    });
  });

  describe('renewing the lease of a check its runner is still working', () => {
    const RUN = RunId.of('run_1');

    const renewing = (found: StackCheck | null, clashes = 0) => {
      const saved: StackCheck[] = [];
      let left = clashes;

      return {
        saved,
        service: new ClaimChangeStackCheck(
          {
            find: async () => found,
            save: async (check: StackCheck) => {
              if (left > 0) {
                left -= 1;
                throw new StackCheckVersionConflictError(check.stackId.value);
              }
              saved.push(check);
            },
          } as unknown as StackCheckRepository,
          {} as ChangeStackRepository,
          {} as PatchWriterPort,
          { inTransaction: (work) => work() } as TransactionPort,
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
        service.renewLease(RUN, 'stack_1', false, RUNNER, nearlyExpired),
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
          RUN,
          'stack_1',
          false,
          RUNNER,
          new Date(NOW.getTime() + WAITING_LIMIT_MS + 1),
        ),
      ).resolves.toBe('renewed');
      expect(saved).toHaveLength(1);
    });

    it('tries again when the check changed while it was renewed', async () => {
      const { service, saved } = renewing(leased(), 2);

      await expect(
        service.renewLease(RUN, 'stack_1', false, RUNNER, NOW),
      ).resolves.toBe('renewed');
      expect(saved).toHaveLength(1);
    });

    it('gives up once the check keeps moving on', async () => {
      const { service, saved } = renewing(leased(), 3);

      await expect(
        service.renewLease(RUN, 'stack_1', false, RUNNER, NOW),
      ).rejects.toThrow(StackCheckVersionConflictError);
      expect(saved).toEqual([]);
    });

    it('tells the runner to stop once the check was forgotten with its task', async () => {
      const { service, saved } = renewing(null);

      await expect(
        service.renewLease(RUN, 'stack_1', false, RUNNER, NOW),
      ).resolves.toBe('stop');
      expect(saved).toEqual([]);
    });

    it('tells the runner to stop once the check ended, or its lease expired past the hour', async () => {
      const skipped = renewing(
        leased().skip(RUNNER, skipOf('no-room', null), NOW),
      );
      const expired = renewing(leased());

      await expect(
        skipped.service.renewLease(RUN, 'stack_1', false, RUNNER, NOW),
      ).resolves.toBe('stop');
      await expect(
        expired.service.renewLease(
          RUN,
          'stack_1',
          false,
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
        elsewhere.service.renewLease(
          RunId.of('run_other'),
          'stack_1',
          false,
          RunnerId.of('runner_9'),
          NOW,
        ),
      ).resolves.toBe('stop');
      await expect(
        expiring.service.renewLease(RUN, 'stack_1', false, RUNNER, expired),
      ).resolves.toBe('stop');
      await expect(
        missing.service.renewLease(
          RunId.of('run_other'),
          'stack_1',
          false,
          RunnerId.of('runner_9'),
          NOW,
        ),
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
        service.renewLease(RUN, 'stack_1', false, RUNNER, new Date(ceiling)),
      ).resolves.toBe('stop');
      expect(saved).toEqual([]);
    });

    it('rejects the runner with the lease on the check a stack another run drafted', async () => {
      await expect(
        renewing(leased()).service.renewLease(
          RunId.of('run_2'),
          'stack_1',
          false,
          RUNNER,
          NOW,
        ),
      ).rejects.toThrow(UnknownChangeStackError);
    });
  });
});
