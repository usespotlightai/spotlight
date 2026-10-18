import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Run } from '@work/domain/aggregates/run.aggregate';
import type { Claimant } from '@work/domain/repositories/run.repository';
import { ClaimOrder } from '@work/domain/services/claim-order';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it } from 'vitest';

const DEV = HarnessId.of('dev');
const NOW = new Date('2026-09-17T12:00:00.000Z');
const BY: Claimant = {
  runner: RunnerId.of('runner_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  harnesses: [DEV],
  offer: RunnerOffer.of(['runner-1', 'laptop']),
  claims: 'any',
};
const POOLED: Claimant = {
  ...BY,
  runner: RunnerId.of('pooled_1'),
  claims: 'reserved',
};

const waiting = (
  id: string,
  over: {
    priority?: number;
    queuedAt?: string;
    harness?: string;
    workspace?: string;
    placement?: string[];
  } = {},
) => ({
  run: Run.enqueue({
    id: RunId.of(id),
    workspaceId: WorkspaceId.of(over.workspace ?? 'ws_1'),
    harness: HarnessId.of(over.harness ?? 'dev'),
    priority: RunPriority.of(over.priority ?? 0),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      resume: { key: 'task:station' },
    }),
    placement: RunnerPlacement.of(over.placement ?? []),
  }),
  queuedAt: new Date(over.queuedAt ?? '2026-09-17T09:00:00.000Z'),
});

const next = (...runs: ReturnType<typeof waiting>[]) =>
  ClaimOrder.next(runs, BY, NOW)?.id.value ?? null;

const reservedFor = (
  entry: ReturnType<typeof waiting>,
  runner: string,
  at = NOW,
) => ({
  ...entry,
  run: entry.run.reservedFor(RunnerId.of(runner), PoolId.of('burst'), at),
});

describe('ClaimOrder', () => {
  it('hands out the station nearest the end of the line first', () => {
    expect(
      next(
        waiting('near_front', { priority: 1 }),
        waiting('further', { priority: 3 }),
      ),
    ).toBe('further');
  });

  it('among equals, hands out the one that has waited longest', () => {
    expect(
      next(
        waiting('newer', { queuedAt: '2026-09-17T10:00:00.000Z' }),
        waiting('older', { queuedAt: '2026-09-17T08:00:00.000Z' }),
      ),
    ).toBe('older');
  });

  it('hands out another waiting run while one requeued waits out its back-off', () => {
    const requeued = waiting('requeued', {
      priority: 3,
      queuedAt: '2026-09-17T08:00:00.000Z',
    });
    const backingOff = {
      ...requeued,
      run: requeued.run
        .claim(BY.runner, NOW)
        .requeue(BY.runner, NOW, 'connect ECONNREFUSED'),
    };

    expect(next(backingOff, waiting('other', { priority: 1 }))).toBe('other');
    expect(
      ClaimOrder.next([backingOff], BY, new Date(NOW.getTime() + 5_000))?.id
        .value,
    ).toBe('requeued');
  });

  it('never hands a runner a harness it does not have', () => {
    expect(next(waiting('elsewhere', { harness: 'cursor' }))).toBeNull();
  });

  it('never hands a runner a run of another workspace', () => {
    expect(
      next(
        waiting('theirs', { workspace: 'ws_2', priority: 9 }),
        waiting('ours'),
      ),
    ).toBe('ours');
  });

  it('never hands a runner a run placed on runners it does not answer to', () => {
    expect(
      next(
        waiting('placed', { placement: ['vpc-internal'], priority: 9 }),
        waiting('open'),
      ),
    ).toBe('open');
  });

  it('hands a runner a run placed on a label it carries', () => {
    expect(
      next(waiting('placed', { placement: ['vpc-internal', 'laptop'] })),
    ).toBe('placed');
  });

  it('hands out nothing already claimed', () => {
    const taken = waiting('taken');

    expect(
      ClaimOrder.next(
        [{ ...taken, run: taken.run.claim(RunnerId.of('runner_2'), NOW) }],
        BY,
        NOW,
      ),
    ).toBeNull();
  });

  describe('with runs reserved for a provisioned runner', () => {
    const FIVE_MINUTES_AGO = new Date(NOW.getTime() - 5 * 60_000);

    it('hands a provisioned runner only the run reserved for it', () => {
      expect(
        ClaimOrder.next(
          [
            waiting('open', { priority: 9 }),
            reservedFor(waiting('theirs', { priority: 5 }), 'pooled_2'),
            reservedFor(waiting('mine'), 'pooled_1'),
          ],
          POOLED,
          NOW,
        )?.id.value,
      ).toBe('mine');
    });

    it('hands a provisioned runner nothing once its reservation expired', () => {
      expect(
        ClaimOrder.next(
          [reservedFor(waiting('mine'), 'pooled_1', FIVE_MINUTES_AGO)],
          POOLED,
          NOW,
        ),
      ).toBeNull();
    });

    it('never hands another runner a run while it is reserved for someone else', () => {
      expect(
        next(
          reservedFor(waiting('reserved', { priority: 9 }), 'pooled_1'),
          waiting('open'),
        ),
      ).toBe('open');
    });

    it('hands another runner a run whose reservation expired', () => {
      expect(
        next(reservedFor(waiting('expired'), 'pooled_1', FIVE_MINUTES_AGO)),
      ).toBe('expired');
    });
  });
});
