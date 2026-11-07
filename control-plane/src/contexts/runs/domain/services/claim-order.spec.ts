import { Run } from '@runs/domain/aggregates/run.aggregate';
import { claimer, orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import { ClaimOrder } from '@runs/domain/services/claim-order';
import type { Claimant } from '@runs/domain/value-objects/claimant';
import { RunPriority } from '@runs/domain/value-objects/run-priority.vo';
import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { WorkspaceKey } from '@runs/domain/value-objects/workspace-key.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
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
    createdAt?: string;
    harness?: string;
    workspace?: string;
    placement?: string[];
    ordering?: ReturnType<typeof orderedFor.spec>;
  } = {},
) =>
  Run.enqueue({
    id: RunId.of(id),
    workspaceId: WorkspaceId.of(over.workspace ?? 'ws_1'),
    harness: HarnessId.of(over.harness ?? 'dev'),
    ...(over.ordering ?? orderedFor.spec()),
    priority: RunPriority.of(over.priority ?? 0),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
    }),
    placement: RunnerPlacement.of(over.placement ?? []),
    now: new Date(over.createdAt ?? '2026-09-17T09:00:00.000Z'),
  });

const inOrder = (
  runs: readonly Run[],
  by: Claimant = BY,
  now: Date = NOW,
  leasedRequesters: readonly RunRequester[] = [],
) => ClaimOrder.inOrder({ waiting: runs, leasedRequesters }, by, now);

const next = (...runs: Run[]) => inOrder(runs)[0]?.id.value ?? null;

const reservedFor = (entry: Run, runner: string, at = NOW) =>
  entry.reservedFor(RunnerId.of(runner), PoolId.of('burst'), at);

describe('ClaimOrder', () => {
  it('hands out the station nearest the end of the line first', () => {
    expect(
      next(
        waiting('near_front', { priority: 1 }),
        waiting('further', { priority: 3 }),
      ),
    ).toBe('further');
  });

  it('among equals, hands out the one ordered first', () => {
    expect(
      next(
        waiting('newer', { createdAt: '2026-09-17T10:00:00.000Z' }),
        waiting('older', { createdAt: '2026-09-17T08:00:00.000Z' }),
      ),
    ).toBe('older');
  });

  it('keeps the place of a run that went back on the queue', () => {
    const lost = waiting('lost', { createdAt: '2026-09-17T08:00:00.000Z' })
      .claim(claimer(BY.runner), NOW)
      .expireLease(new Date(NOW.getTime() + 3_600_000));
    const later = new Date(NOW.getTime() + 3_600_000);

    expect(lost.queuedAt).toEqual(later);
    expect(
      inOrder(
        [waiting('newer', { createdAt: '2026-09-17T10:00:00.000Z' }), lost],
        BY,
        later,
      )[0]?.id.value,
    ).toBe('lost');
  });

  it('hands out another waiting run while one requeued waits out its back-off', () => {
    const requeued = waiting('requeued', {
      priority: 3,
      createdAt: '2026-09-17T08:00:00.000Z',
    });
    const backingOff = requeued
      .claim(claimer(BY.runner), NOW)
      .requeue(BY.runner, NOW, 'connect ECONNREFUSED');

    expect(next(backingOff, waiting('other', { priority: 1 }))).toBe('other');
    expect(
      inOrder([backingOff], BY, new Date(NOW.getTime() + 5_000))[0]?.id.value,
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
      inOrder([taken.claim(claimer(RunnerId.of('runner_2')), NOW)]),
    ).toEqual([]);
  });

  it('holds back a run while another run of its requester holds a lease', () => {
    const held = waiting('held', {
      priority: 9,
      ordering: orderedFor.task('task_9'),
    });

    expect(
      inOrder([held, waiting('free')], BY, NOW, [held.requester]).map(
        (each) => each.id.value,
      ),
    ).toEqual(['free']);
    expect(next(held, waiting('free'))).toBe('held');
  });

  it('routes into the sandbox of its key, and away from the sandboxes held', () => {
    const ordering = orderedFor.spec('keyed', 'sandboxed');
    const keyed = waiting('keyed', { ordering });
    const key = WorkspaceKey.of('workspace', 'sandboxed');

    expect(inOrder([keyed], { ...BY, sandbox: { avoiding: [key] } })).toEqual(
      [],
    );
    expect(
      inOrder([keyed, waiting('other', { priority: 9 })], {
        ...BY,
        sandbox: { into: key },
      }).map((each) => each.id.value),
    ).toEqual(['keyed']);
  });

  describe('with runs reserved for a provisioned runner', () => {
    const FIVE_MINUTES_AGO = new Date(NOW.getTime() - 5 * 60_000);

    it('hands a provisioned runner only the run reserved for it', () => {
      expect(
        inOrder(
          [
            waiting('open', { priority: 9 }),
            reservedFor(waiting('theirs', { priority: 5 }), 'pooled_2'),
            reservedFor(waiting('mine'), 'pooled_1'),
          ],
          POOLED,
        )[0]?.id.value,
      ).toBe('mine');
    });

    it('hands a provisioned runner nothing once its reservation expired', () => {
      expect(
        inOrder(
          [reservedFor(waiting('mine'), 'pooled_1', FIVE_MINUTES_AGO)],
          POOLED,
        ),
      ).toEqual([]);
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

  describe('for a sandbox an editor requested', () => {
    it('starts it when its key has no run, or its newest run is not queued', () => {
      expect(ClaimOrder.forRequested(null, BY)).toBe('start');
      expect(
        ClaimOrder.forRequested(
          waiting('taken').claim(claimer(RunnerId.of('runner_2')), NOW),
          BY,
        ),
      ).toBe('start');
    });

    it('takes the queued run of its key first, which then starts in it', () => {
      expect(ClaimOrder.forRequested(waiting('queued'), BY)).toBe(
        'run-of-its-key',
      );
    });

    it('leaves it to another runner when the newest run of its key does not fit this one', () => {
      expect(
        ClaimOrder.forRequested(waiting('other', { harness: 'other' }), BY),
      ).toBe('skip');
      expect(
        ClaimOrder.forRequested(waiting('placed', { placement: ['gpu'] }), BY),
      ).toBe('skip');
    });
  });
});
