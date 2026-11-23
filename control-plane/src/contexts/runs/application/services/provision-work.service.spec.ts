import type {
  HostOfferAtWork,
  PoolAtWork,
  RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import type {
  ProvisionedRunner,
  ProvisionRequest,
  RunnersPort,
} from '@runners/application/ports/runners.port';
import type { SandboxesPort } from '@runners/application/ports/sandboxes.port';
import type {
  ReviewWorkProvisioningPort,
  ExpiredReviewWork,
  WaitingReviewWork,
} from '@runs/application/ports/review-work-provisioning.port';
import type { ReviewWork } from '@runs/application/ports/review-work.port';
import type { RunWaitsPort } from '@runs/application/ports/run-waits.port';
import { ProvisionFailures } from '@runs/application/services/provision-failures.service';
import { ProvisionWork } from '@runs/application/services/provision-work.service';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import { RunReservationDropped } from '@runs/domain/events/run-reservation-dropped.event';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { ClaimCursor } from '@runs/domain/services/claim-order';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { RunTags } from '@runs/domain/value-objects/run-tags.vo';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { ReviewWorkId } from '@shared-kernel/domain/value-objects/review-work-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOON = new Date('2026-09-24T12:00:00.000Z');
const LATER = new Date('2026-09-24T12:05:00.000Z');

const waiting = (
  id: string,
  placement: string[] = [],
  workspace = 'ws_1',
  image: RunnerImage | null = null,
  injectedSecrets: string[] = [],
) =>
  Run.enqueue({
    id: RunId.of(id),
    workspaceId: WorkspaceId.of(workspace),
    harness: HarnessId.of('dev'),
    ...orderedFor.holdingTurn('task_1', 0),
    tags: RunTags.of({ taskId: 'task_1' }),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      resume: {},
      ...(injectedSecrets.length > 0 ? { injectedSecrets } : {}),
    }),
    placement: RunnerPlacement.of(placement).in(image),
  });

const checkWork = (id: string): ReviewWork => ({
  kind: 'check',
  id: ReviewWorkId.of(id),
  recheck: false,
});

const diffWork = (id: string): ReviewWork => ({
  kind: 'diff',
  id: ReviewWorkId.of(id),
});

const aWaitingCheck = (
  checkId: string,
  placement: string[] = [],
  image: RunnerImage | null = null,
) => ({
  work: checkWork(checkId),
  runId: RunId.of(`run_of_${checkId}`),
  placement: RunnerPlacement.of(placement).in(image),
});

const WIDGETS = RunnerImage.of('ghcr.io/acme/widgets:1');

type BoundedPool = PoolAtWork & { readonly maxRuns: number | null };

const aPool = (
  key: string,
  labels: string[] = [],
  egress = false,
  platform = false,
  allows = { allowsSecrets: true, allowsReviewWork: true },
  images: readonly RunnerImage[] | null = null,
): BoundedPool => ({
  poolId: `pool_${key}`,
  workspaceId: WorkspaceId.of('ws_1'),
  key,
  labels: RunnerOffer.of(labels),
  egress,
  platform,
  ...allows,
  images,
  maxRuns: null,
});

// A platform pool with egress here is one the operator allows secrets.
const aPlatformPool = (
  labels: string[] = [],
  egress = false,
  allowsReviewWork = false,
): BoundedPool =>
  aPool('spotlight', labels, egress, true, {
    allowsSecrets: egress,
    allowsReviewWork,
  });

const hostsServing = (labels: string[] = []): HostOfferAtWork => ({
  workspaceId: WorkspaceId.of('ws_1'),
  labels: RunnerOffer.of(labels),
  egress: true,
  images: null,
  allowsSecrets: true,
  allowsReviewWork: true,
});

const provisioning = (
  queue: readonly Run[],
  pools: readonly BoundedPool[],
  answers: Record<string, ProvisionedRunner> = {},
  now = NOON,
  running = 0,
  waitingChecks: {
    readonly awaiting?: readonly WaitingReviewWork[];
    readonly expired?: readonly ExpiredReviewWork[];
    readonly reserves?: boolean;
  } = {},
  liveKeys: readonly string[] = [],
  hostOffers: readonly HostOfferAtWork[] = [],
) => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const stored = new Map(queue.map((each) => [each.id.value, each]));
  const awaitingProvision = vi.fn(
    async (
      workspaceId: WorkspaceId,
      at: Date,
      page: {
        readonly after: ClaimCursor | null;
        readonly max: number;
        readonly withSecrets: boolean;
        readonly avoiding: readonly WorkingCopyKey[];
      },
    ) => {
      const order = [...stored.keys()];
      const from = page.after ? order.indexOf(page.after.id) + 1 : 0;

      return {
        waiting: [...stored.values()]
          .filter(
            (each) =>
              order.indexOf(each.id.value) >= from &&
              each.workspaceId.equals(workspaceId) &&
              each.provisionableAt(at, page.withSecrets),
          )
          .slice(0, page.max),
        leasedRequesters: [],
      };
    },
  );
  const recorded: DomainEvent[] = [];
  const waits = {
    note: vi.fn<RunWaitsPort['note']>(async () => {}),
  } satisfies RunWaitsPort;
  const runs = {
    findById: async (id: RunId) => stored.get(id.value) ?? null,
    save: async (run: Run) => {
      recorded.push(...run.pullEvents());
      stored.set(run.id.value, run);
    },
    awaitingProvision,
    workspacesAwaitingProvision: async (at: Date) => [
      ...new Map(
        [...stored.values()]
          .filter((each) => each.provisionableAt(at, true))
          .map((each) => [each.workspaceId.value, each.workspaceId]),
      ).values(),
    ],
    withExpiredReservations: async (at: Date) =>
      [...stored.values()].filter((each) => each.reservationExpiredAt(at)),
  } as unknown as RunRepository;
  const provision = vi.fn(
    async (request: ProvisionRequest): Promise<ProvisionedRunner> =>
      answers[request.poolId] ?? { outcome: 'provisioned' },
  );
  const release = vi.fn(async () => {});
  const checks = {
    awaiting: vi.fn<ReviewWorkProvisioningPort['awaiting']>(
      async (_workspaceId, _at, page) =>
        page.after === null
          ? { waiting: waitingChecks.awaiting ?? [], next: 'cursor_1' }
          : { waiting: [], next: null },
    ),
    reserve: vi.fn<ReviewWorkProvisioningPort['reserve']>(
      async (_check, _runner, _pool, at) =>
        waitingChecks.reserves === false
          ? null
          : new Date(at.getTime() + 5 * 60_000),
    ),
    unreserve: vi.fn(async () => {}),
    failed: vi.fn(async () => {}),
    expired: vi.fn(async () => waitingChecks.expired ?? []),
    workspacesAwaiting: vi.fn(async () =>
      (waitingChecks.awaiting ?? []).length > 0 ? [WorkspaceId.of('ws_1')] : [],
    ),
  } satisfies ReviewWorkProvisioningPort;
  let generated = 0;
  const failures = new ProvisionFailures(runs);
  const inWorkspaces =
    (workspaceIds: readonly WorkspaceId[]) =>
    <Each extends { readonly workspaceId: WorkspaceId }>(
      all: readonly Each[],
    ) =>
      all.filter((each) =>
        workspaceIds.some((id) => id.equals(each.workspaceId)),
      );
  const offering = vi.fn(async (workspaceIds: readonly WorkspaceId[]) => ({
    pools: inWorkspaces(workspaceIds)(pools),
    hostOffers: inWorkspaces(workspaceIds)(hostOffers),
  }));

  return {
    provision,
    offering,
    release,
    recorded,
    checks,
    awaitingProvision,
    run: (id: string) => stored.get(id) as Run,
    provisioner: new ProvisionWork(
      runs,
      checks,
      {
        offersIn: offering,
        roomIn: async (poolId: string) => {
          const maxRuns =
            pools.find((each) => each.poolId === poolId)?.maxRuns ?? null;

          return maxRuns === null ? null : Math.max(0, maxRuns - running);
        },
      } as unknown as RunnerPoolsPort,
      { provision, release } as unknown as RunnersPort,
      {
        liveKeysIn: vi.fn(async () => liveKeys),
      } as unknown as SandboxesPort,
      failures,
      {
        generate: () => {
          generated += 1;
          return `pooled_${generated}`;
        },
      },
      { now: () => now } as ClockPort,
      logger,
      waits,
    ),
    logger,
    waits,
  };
};

describe('ProvisionWork', () => {
  it('says once in 10 minutes why it provisions no runner for a run', async () => {
    const { provisioner, provision, logger } = provisioning(
      [waiting('run_1', ['gpu'])],
      [aPool('burst', ['arm'])],
    );

    await provisioner.due();
    await provisioner.due();

    expect(provision).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ runId: 'run_1', reason: 'no-pool-matches' }),
      'Did not provision a runner',
    );
  });

  it('notes on the run why it waits at each tick, in one write, with the queueing it belongs to', async () => {
    const queued = waiting('run_1', ['gpu']);
    const { provisioner, waits, logger } = provisioning(
      [queued],
      [aPool('burst', ['arm'])],
    );

    await provisioner.due();
    await provisioner.due();

    const noted = [
      [
        {
          runId: RunId.of('run_1'),
          reason: 'no-pool-matches',
          queuedAt: queued.queuedAt,
        },
      ],
      NOON,
    ];

    expect(waits.note.mock.calls).toEqual([noted, noted]);
    expect(logger.info).toHaveBeenCalledOnce();
  });

  it('says a run with secrets waits for the operator when only the platform pool could take it', async () => {
    const { provisioner, waits } = provisioning(
      [waiting('run_1', [], 'ws_1', null, ['LINEAR_API_KEY'])],
      [
        aPool('spotlight', [], true, true, {
          allowsSecrets: false,
          allowsReviewWork: false,
        }),
      ],
    );

    await provisioner.due();

    expect(
      waits.note.mock.calls.flatMap(([noted]) =>
        noted.map((each) => each.reason),
      ),
    ).toEqual(['platform-pool-not-allowed']);
  });

  it('keeps why a run waits for a full pool or for hosts', async () => {
    const { provisioner, waits } = provisioning(
      [waiting('run_1', ['gpu']), waiting('run_2', ['on-premises'])],
      [{ ...aPool('burst', ['gpu']), maxRuns: 1 }, aPlatformPool(['gpu'])],
      {},
      NOON,
      1,
      {},
      [],
      [hostsServing(['on-premises'])],
    );

    await provisioner.due();

    expect(
      waits.note.mock.calls.flatMap(([noted]) =>
        noted.map((each) => [each.runId.value, each.reason]),
      ),
    ).toEqual([
      ['run_1', 'no-pool-has-room'],
      ['run_2', 'hosts-pull'],
    ]);
  });

  it('keeps no reason for a check that waits', async () => {
    const { provisioner, waits, logger } = provisioning(
      [],
      [aPlatformPool(['arm'])],
      {},
      NOON,
      0,
      { awaiting: [aWaitingCheck('stack_1', ['arm'])] },
    );

    await provisioner.due();

    expect(logger.info).toHaveBeenCalledOnce();
    expect(waits.note.mock.calls.flatMap(([noted]) => noted)).toEqual([]);
  });

  it('releases what it reserved when provisioning throws, still provisions the rest, and says why', async () => {
    const { provisioner, provision, run } = provisioning(
      [waiting('run_1', ['broken']), waiting('run_2', ['gpu'])],
      [aPool('broken', ['broken']), aPool('burst', ['gpu'])],
    );
    provision.mockImplementation(async (request: ProvisionRequest) => {
      if (request.poolId === 'pool_broken') {
        throw new Error('the provision secret does not open here');
      }

      return { outcome: 'provisioned' };
    });

    await expect(provisioner.due()).rejects.toThrow(
      'the provision secret does not open here',
    );

    expect(run('run_1').reservation).toBeNull();
    expect(run('run_1').provisioning.attempts).toBe(0);
    expect(run('run_2').reservation?.pool.value).toBe('pool_burst');
  });

  it('releases a check it reserved when provisioning throws', async () => {
    const { provisioner, provision, checks } = provisioning(
      [],
      [aPool('burst', ['gpu'])],
      {},
      NOON,
      0,
      {
        awaiting: [
          {
            work: checkWork('stack_1'),
            runId: RunId.of('run_9'),
            placement: RunnerPlacement.of(['gpu']),
          },
        ],
      },
    );
    provision.mockRejectedValue(
      new Error('the provision secret does not open here'),
    );

    await expect(provisioner.due()).rejects.toThrow(
      'the provision secret does not open',
    );

    expect(checks.unreserve).toHaveBeenCalledWith(
      checkWork('stack_1'),
      RunnerId.of('pooled_1'),
    );
    expect(checks.failed).not.toHaveBeenCalled();
  });

  it('looks past runs no push pool fits, however many wait ahead of one it does', async () => {
    const { provisioner, provision } = provisioning(
      [
        ...Array.from({ length: 30 }, (_, at) =>
          waiting(`pulled_${at}`, ['on-premises']),
        ),
        waiting('run_1', ['gpu']),
      ],
      [aPool('burst', ['gpu'])],
    );

    await provisioner.due();

    expect(provision.mock.calls.map(([request]) => request.work.id)).toEqual([
      'run_1',
    ]);
  });

  it('reserves nothing for a pool already at maxRuns', async () => {
    const { provisioner, provision, run } = provisioning(
      [waiting('run_1', ['gpu'])],
      [{ ...aPool('burst', ['gpu']), maxRuns: 2 }],
      {},
      NOON,
      2,
    );

    await provisioner.due();

    expect(provision).not.toHaveBeenCalled();
    expect(run('run_1').reservation).toBeNull();
  });

  it('provisions no more runs in a turn than the pool has room for', async () => {
    const { provisioner, provision } = provisioning(
      [waiting('run_1', ['gpu']), waiting('run_2', ['gpu'])],
      [{ ...aPool('burst', ['gpu']), maxRuns: 2 }],
      {},
      NOON,
      1,
    );

    await provisioner.due();

    expect(provision).toHaveBeenCalledOnce();
  });

  it('reads no further pages once no pool has room left', async () => {
    const { provisioner, provision, awaitingProvision, checks } = provisioning(
      Array.from({ length: 450 }, (_, at) => waiting(`run_${at}`)),
      [{ ...aPool('burst'), maxRuns: 2 }],
    );

    await provisioner.due();

    expect(provision).toHaveBeenCalledTimes(2);
    expect(awaitingProvision).toHaveBeenCalledOnce();
    expect(checks.awaiting).not.toHaveBeenCalled();
  });

  it('provisions no runner for the runs of keys that ready host sandboxes keep', async () => {
    const { provisioner, awaitingProvision } = provisioning(
      [waiting('run_1')],
      [aPool('burst')],
      {},
      NOON,
      0,
      {},
      ['requester/subject-task_1'],
    );

    await provisioner.due();

    expect(awaitingProvision).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      NOON,
      expect.objectContaining({
        avoiding: [WorkingCopyKey.parse('requester/subject-task_1')],
      }),
    );
  });

  it('reads the next page while a pool still has room', async () => {
    const { provisioner, provision, awaitingProvision } = provisioning(
      [
        ...Array.from({ length: 200 }, (_, at) =>
          waiting(`pulled_${at}`, ['on-premises']),
        ),
        waiting('run_1', ['gpu']),
      ],
      [{ ...aPool('burst', ['gpu']), maxRuns: 1 }],
    );

    await provisioner.due();

    expect(awaitingProvision).toHaveBeenCalledTimes(2);
    expect(provision.mock.calls.map(([request]) => request.work.id)).toEqual([
      'run_1',
    ]);
  });

  it('reserves a waiting run for a new runner and requests a fitting pool to start it', async () => {
    const { provisioner, provision, run } = provisioning(
      [waiting('run_1', ['gpu'])],
      [aPool('burst', ['gpu'])],
    );

    await provisioner.due();

    expect(provision).toHaveBeenCalledWith(
      {
        poolId: 'pool_burst',
        runnerId: RunnerId.of('pooled_1'),
        work: { kind: 'run', id: 'run_1' },
        tags: { taskId: 'task_1' },
        labels: ['gpu'],
        image: null,
        needsEgress: false,
        claimBy: LATER,
      },
      NOON,
    );
    expect(run('run_1').reservation?.runner.value).toBe('pooled_1');
    expect(run('run_1').reservation?.pool.value).toBe('pool_burst');
  });

  it('requests the pool to start its runner in the image the run is placed in', async () => {
    const { provisioner, provision } = provisioning(
      [waiting('run_1', ['gpu'], 'ws_1', WIDGETS)],
      [aPool('burst', ['gpu'])],
    );

    await provisioner.due();

    expect(provision).toHaveBeenCalledWith(
      expect.objectContaining({
        work: { kind: 'run', id: 'run_1' },
        image: WIDGETS.value,
      }),
      NOON,
    );
  });

  it('records a failed provision on the run and backs off', async () => {
    const { provisioner, run } = provisioning(
      [waiting('run_1')],
      [aPool('burst')],
      {
        pool_burst: {
          outcome: 'failed',
          kind: 'unreachable',
          detail: 'connect ECONNREFUSED',
        },
      },
    );

    await provisioner.due();

    expect(run('run_1').reservation).toBeNull();
    expect(run('run_1').provisioning.attempts).toBe(1);
    expect(run('run_1').provisionableAt(NOON)).toBe(false);
  });

  it('tries the next fitting pool when the first fails, and counts nothing when it provisions', async () => {
    const { provisioner, provision, run } = provisioning(
      [waiting('run_1')],
      [aPool('a-dead'), aPool('b-burst')],
      {
        'pool_a-dead': {
          outcome: 'failed',
          kind: 'unreachable',
          detail: 'connect ECONNREFUSED',
        },
      },
    );

    await provisioner.due();

    expect(provision.mock.calls.map(([request]) => request.poolId)).toEqual([
      'pool_a-dead',
      'pool_b-burst',
    ]);
    expect(run('run_1').reservation?.pool.value).toBe('pool_b-burst');
    expect(run('run_1').provisioning.attempts).toBe(0);
  });

  it('counts one failure, the last, when every fitting pool fails', async () => {
    const { provisioner, run } = provisioning(
      [waiting('run_1')],
      [aPool('a-dead'), aPool('b-unusable')],
      {
        'pool_a-dead': {
          outcome: 'failed',
          kind: 'unreachable',
          detail: 'connect ECONNREFUSED',
        },
        'pool_b-unusable': {
          outcome: 'failed',
          kind: 'unusable',
          detail: 'the pool’s provision secret does not open',
        },
      },
    );

    await provisioner.due();

    expect(run('run_1').reservation).toBeNull();
    expect(run('run_1').provisioning.attempts).toBe(1);
  });

  it('provisions on the next fitting pool when the first throws, and still says why', async () => {
    const { provisioner, provision, run } = provisioning(
      [waiting('run_1')],
      [aPool('a-broken'), aPool('b-burst')],
    );
    provision.mockImplementation(async (request: ProvisionRequest) => {
      if (request.poolId === 'pool_a-broken') {
        throw new Error('the provision secret does not open here');
      }

      return { outcome: 'provisioned' };
    });

    await expect(provisioner.due()).rejects.toThrow(
      'the provision secret does not open here',
    );

    expect(run('run_1').reservation?.pool.value).toBe('pool_b-burst');
    expect(run('run_1').provisioning.attempts).toBe(0);
  });

  it('says both when provisioning throws and releasing its reservation does too', async () => {
    const { provisioner, provision, checks } = provisioning(
      [],
      [aPool('burst', ['gpu'])],
      {},
      NOON,
      0,
      {
        awaiting: [
          {
            work: checkWork('stack_1'),
            runId: RunId.of('run_9'),
            placement: RunnerPlacement.of(['gpu']),
          },
        ],
      },
    );
    provision.mockRejectedValue(
      new Error('the provision secret does not open'),
    );
    checks.unreserve.mockRejectedValue(new Error('the database went away'));

    await expect(provisioner.due()).rejects.toBeInstanceOf(AggregateError);
  });

  it('tries the next fitting pool when the first is full', async () => {
    const { provisioner, provision, run } = provisioning(
      [waiting('run_1')],
      [aPool('b-spare'), aPool('a-burst')],
      { 'pool_a-burst': { outcome: 'full' } },
    );

    await provisioner.due();

    expect(provision.mock.calls.map(([request]) => request.poolId)).toEqual([
      'pool_a-burst',
      'pool_b-spare',
    ]);
    expect(run('run_1').reservation?.pool.value).toBe('pool_b-spare');
    expect(run('run_1').provisioning.attempts).toBe(0);
  });

  it('counts nothing when a failing pool is followed by one that filled up meanwhile', async () => {
    const { provisioner, run } = provisioning(
      [waiting('run_1')],
      [aPool('a-dead'), aPool('b-burst')],
      {
        'pool_a-dead': {
          outcome: 'failed',
          kind: 'unreachable',
          detail: 'connect ECONNREFUSED',
        },
        'pool_b-burst': { outcome: 'full' },
      },
    );

    await provisioner.due();

    expect(run('run_1').reservation).toBeNull();
    expect(run('run_1').provisioning.attempts).toBe(0);
  });

  it('leaves the run unreserved and unfailed when every fitting pool is gone', async () => {
    const { provisioner, run } = provisioning(
      [waiting('run_1')],
      [aPool('burst')],
      { pool_burst: { outcome: 'gone' } },
    );

    await provisioner.due();

    expect(run('run_1').reservation).toBeNull();
    expect(run('run_1').provisioning.attempts).toBe(0);
  });

  it('hands a run with injected secrets only to a pool that names an egress', async () => {
    const { provisioner, provision, run, awaitingProvision } = provisioning(
      [waiting('run_1', [], 'ws_1', null, ['LINEAR_API_KEY'])],
      [aPool('burst'), aPool('shared', [], true)],
    );

    await provisioner.due();

    expect(awaitingProvision).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      NOON,
      expect.objectContaining({ withSecrets: true }),
    );
    expect(provision).toHaveBeenCalledTimes(1);
    expect(provision).toHaveBeenCalledWith(
      expect.objectContaining({ poolId: 'pool_shared' }),
      NOON,
    );
    expect(run('run_1').reservation?.pool.value).toBe('pool_shared');
  });

  it('leaves alone a run with injected secrets where no pool names an egress', async () => {
    const { provisioner, provision, awaitingProvision } = provisioning(
      [waiting('run_1', [], 'ws_1', null, ['LINEAR_API_KEY'])],
      [aPool('burst')],
    );

    await provisioner.due();

    expect(awaitingProvision).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      NOON,
      expect.objectContaining({ withSecrets: false }),
    );
    expect(provision).not.toHaveBeenCalled();
  });

  it('leaves alone a run no pool that provisions could take', async () => {
    const { provisioner, provision, run } = provisioning(
      [waiting('run_1', ['vpc-internal'])],
      [aPool('burst', ['gpu'])],
    );

    await provisioner.due();

    expect(provision).not.toHaveBeenCalled();
    expect(run('run_1').reservation).toBeNull();
  });

  it('leaves alone a run of a workspace with no pool that provisions', async () => {
    const { provisioner, provision } = provisioning(
      [waiting('run_1', [], 'ws_2')],
      [aPool('burst')],
    );

    await provisioner.due();

    expect(provision).not.toHaveBeenCalled();
  });

  it('hands a run to the platform pool when no pool of the workspace fits it', async () => {
    const { provisioner, provision } = provisioning(
      [waiting('run_1', ['gpu']), waiting('run_2', ['arm'])],
      [aPool('burst', ['gpu']), aPlatformPool(['arm'])],
    );

    await provisioner.due();

    expect(
      provision.mock.calls.map(([request]) => [
        request.work.id,
        request.poolId,
      ]),
    ).toEqual([
      ['run_1', 'pool_burst'],
      ['run_2', 'pool_spotlight'],
    ]);
  });

  it('keeps a check off the platform pool until the operator allows it review work', async () => {
    const check = { awaiting: [aWaitingCheck('stack_1', ['arm'])] };
    const kept = provisioning([], [aPlatformPool(['arm'])], {}, NOON, 0, check);
    const allowed = provisioning(
      [],
      [aPlatformPool(['arm'], false, true)],
      {},
      NOON,
      0,
      check,
    );

    await kept.provisioner.due();
    await allowed.provisioner.due();

    expect(kept.provision).not.toHaveBeenCalled();
    expect(
      allowed.provision.mock.calls.map(([request]) => request.work.id),
    ).toEqual(['stack_1']);
  });

  it('keeps a run off the platform pool while a full pool of the workspace fits it', async () => {
    const { provisioner, provision, run } = provisioning(
      [waiting('run_1', ['gpu'])],
      [{ ...aPool('burst', ['gpu']), maxRuns: 1 }, aPlatformPool(['gpu'])],
      {},
      NOON,
      1,
    );

    await provisioner.due();

    expect(provision).not.toHaveBeenCalled();
    expect(run('run_1').reservation).toBeNull();
  });

  it('keeps a run that the hosts of a pull pool or a trust fit off the platform pool, and says why', async () => {
    const { provisioner, provision, run, logger } = provisioning(
      [waiting('run_1', ['on-premises']), waiting('run_2', ['vpc'])],
      [aPlatformPool(['on-premises', 'vpc'])],
      {},
      NOON,
      0,
      {},
      [],
      [hostsServing(['on-premises']), hostsServing(['vpc'])],
    );

    await provisioner.due();

    expect(provision).not.toHaveBeenCalled();
    expect(run('run_1').reservation).toBeNull();
    expect(run('run_2').reservation).toBeNull();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run_1', reason: 'hosts-pull' }),
      'Did not provision a runner',
    );
  });

  it('visits no workspace that only hosts serve', async () => {
    const { provisioner, awaitingProvision } = provisioning(
      [waiting('run_1', ['on-premises'])],
      [],
      {},
      NOON,
      0,
      {},
      [],
      [hostsServing(['on-premises'])],
    );

    await provisioner.due();

    expect(awaitingProvision).not.toHaveBeenCalled();
  });

  const ticksUntilProvisioned = async (
    tick: () => Promise<void>,
    provisioned: () => boolean,
    reads: () => number,
  ): Promise<{ ticks: number; mostReads: number }> => {
    let mostReads = 0;

    for (let ticks = 1; ticks <= 10; ticks++) {
      const before = reads();
      await tick();
      mostReads = Math.max(mostReads, reads() - before);

      if (provisioned()) {
        return { ticks, mostReads };
      }
    }

    return { ticks: Infinity, mostReads };
  };

  const blockedAhead = (count: number, labels: string[], at: number) => [
    ...Array.from({ length: at }, (_, index) =>
      waiting(`blocked_${index}`, labels),
    ),
    waiting('arm_1', ['arm']),
    ...Array.from({ length: count - at }, (_, index) =>
      waiting(`blocked_${at + index}`, labels),
    ),
  ];

  it('reaches work that only the platform pool fits behind 450 runs that wait for a full pool, reading at most two pages a tick', async () => {
    const { provisioner, provision, awaitingProvision } = provisioning(
      blockedAhead(450, ['gpu'], 300),
      [{ ...aPool('burst', ['gpu']), maxRuns: 1 }, aPlatformPool(['arm'])],
      {},
      NOON,
      1,
    );

    const reached = await ticksUntilProvisioned(
      () => provisioner.due(),
      () =>
        provision.mock.calls.some(([request]) => request.work.id === 'arm_1'),
      () => awaitingProvision.mock.calls.length,
    );

    expect(reached.ticks).toBeLessThanOrEqual(10);
    expect(reached.mostReads).toBeLessThanOrEqual(2);
    expect(provision.mock.calls.map(([request]) => request.poolId)).toEqual([
      'pool_spotlight',
    ]);
  });

  it('reaches work that only the platform pool fits behind 450 runs that wait for hosts that are down, reading at most two pages a tick', async () => {
    const { provisioner, provision, awaitingProvision } = provisioning(
      blockedAhead(450, ['on-premises'], 300),
      [aPlatformPool(['arm'])],
      {},
      NOON,
      0,
      {},
      [],
      [hostsServing(['on-premises'])],
    );

    const reached = await ticksUntilProvisioned(
      () => provisioner.due(),
      () =>
        provision.mock.calls.some(([request]) => request.work.id === 'arm_1'),
      () => awaitingProvision.mock.calls.length,
    );

    expect(reached.ticks).toBeLessThanOrEqual(10);
    expect(reached.mostReads).toBeLessThanOrEqual(2);
  });

  it('sweeps one page further each tick, and starts at the head again after a short page', async () => {
    const { provisioner, provision, awaitingProvision } = provisioning(
      blockedAhead(1_000, ['gpu'], 900),
      [{ ...aPool('burst', ['gpu']), maxRuns: 1 }, aPlatformPool(['arm'])],
      {},
      NOON,
      1,
    );

    const reached = await ticksUntilProvisioned(
      () => provisioner.due(),
      () =>
        provision.mock.calls.some(([request]) => request.work.id === 'arm_1'),
      () => awaitingProvision.mock.calls.length,
    );

    expect(reached.ticks).toBe(4);
    expect(reached.mostReads).toBe(2);
  });

  it('visits only the workspaces with work that waits', async () => {
    const ws2 = { ...aPlatformPool(), workspaceId: WorkspaceId.of('ws_2') };
    const { provisioner, provision, offering } = provisioning(
      [waiting('run_1')],
      [aPlatformPool(), ws2],
    );

    await provisioner.due();

    expect(offering).toHaveBeenCalledExactlyOnceWith([WorkspaceId.of('ws_1')]);
    expect(provision).toHaveBeenCalledOnce();
  });

  it('fails a reservation nobody claimed in time, saving that its runner is to be released', async () => {
    const expiring = waiting('run_1').reservedFor(
      RunnerId.of('pooled_9'),
      PoolId.of('pool_burst'),
      NOON,
    );
    const { provisioner, provision, release, recorded, run } = provisioning(
      [expiring],
      [],
      {},
      LATER,
    );

    await provisioner.due();

    expect(run('run_1').reservation).toBeNull();
    expect(run('run_1').provisioning.attempts).toBe(1);
    expect(recorded).toContainEqual(
      new RunReservationDropped(
        RunId.of('run_1'),
        WorkspaceId.of('ws_1'),
        RunnerId.of('pooled_9'),
      ),
    );
    expect(release).not.toHaveBeenCalled();
    expect(provision).not.toHaveBeenCalled();
  });

  it('keeps a reservation that is still active', async () => {
    const { provisioner, release, run } = provisioning(
      [
        waiting('run_1').reservedFor(
          RunnerId.of('pooled_9'),
          PoolId.of('pool_burst'),
          NOON,
        ),
      ],
      [aPool('burst')],
    );

    await provisioner.due();

    expect(release).not.toHaveBeenCalled();
    expect(run('run_1').reservation?.runner.value).toBe('pooled_9');
  });

  describe('for change-stack checks', () => {
    it('reads the checks behind a full head page from the cursor of the head, and goes on from the cursor of that page in the next tick', async () => {
      const { provisioner, provision, checks } = provisioning(
        [],
        [aPlatformPool(['arm'], false, true)],
        {},
        NOON,
        0,
        { awaiting: [aWaitingCheck('stack_1', ['gpu'])] },
      );
      const blocked = (from: number) =>
        Array.from({ length: 200 }, (_, index) =>
          aWaitingCheck(`blocked_${from + index}`, ['gpu']),
        );
      checks.awaiting.mockImplementation(async (_workspaceId, _at, page) =>
        page.after === null
          ? { waiting: blocked(0), next: 'after_head' }
          : {
              waiting: [
                ...blocked(200).slice(1),
                aWaitingCheck('arm_1', ['arm']),
              ],
              next: `after_${page.after}`,
            },
      );

      await provisioner.due();
      await provisioner.due();

      expect(
        checks.awaiting.mock.calls.map(([, , page]) => page.after),
      ).toEqual([null, 'after_head', null, 'after_after_head']);
      expect(
        provision.mock.calls.some(([request]) => request.work.id === 'arm_1'),
      ).toBe(true);
    });

    it('reserves a waiting check for a new runner and requests a fitting pool to start it for that check', async () => {
      const { provisioner, provision, checks } = provisioning(
        [],
        [aPool('burst', ['gpu'])],
        {},
        NOON,
        0,
        { awaiting: [aWaitingCheck('stack_1', ['gpu'])] },
      );

      await provisioner.due();

      expect(checks.reserve).toHaveBeenCalledWith(
        checkWork('stack_1'),
        RunnerId.of('pooled_1'),
        PoolId.of('pool_burst'),
        NOON,
      );
      expect(provision).toHaveBeenCalledWith(
        {
          poolId: 'pool_burst',
          runnerId: RunnerId.of('pooled_1'),
          work: {
            kind: 'check',
            id: 'stack_1',
            runId: RunId.of('run_of_stack_1'),
          },
          tags: {},
          labels: ['gpu'],
          image: null,
          needsEgress: false,
          claimBy: LATER,
        },
        NOON,
      );
      expect(checks.failed).not.toHaveBeenCalled();
      expect(checks.unreserve).not.toHaveBeenCalled();
    });

    it('requests a runner for a push diff of no run, naming no run', async () => {
      const { provisioner, provision, checks } = provisioning(
        [],
        [aPool('burst', ['gpu'])],
        {},
        NOON,
        0,
        {
          awaiting: [
            {
              ...aWaitingCheck('diff_1', ['gpu']),
              work: diffWork('diff_1'),
              runId: null,
            },
          ],
        },
      );

      await provisioner.due();

      expect(checks.reserve).toHaveBeenCalledWith(
        diffWork('diff_1'),
        RunnerId.of('pooled_1'),
        PoolId.of('pool_burst'),
        NOON,
      );
      expect(provision).toHaveBeenCalledWith(
        expect.objectContaining({
          work: { kind: 'diff', id: 'diff_1' },
        }),
        NOON,
      );
    });

    it('requests the pool to start its runner in the image the check is placed in', async () => {
      const { provisioner, provision } = provisioning(
        [],
        [aPool('burst', ['gpu'])],
        {},
        NOON,
        0,
        { awaiting: [aWaitingCheck('stack_1', ['gpu'], WIDGETS)] },
      );

      await provisioner.due();

      expect(provision).toHaveBeenCalledWith(
        expect.objectContaining({
          work: {
            kind: 'check',
            id: 'stack_1',
            runId: RunId.of('run_of_stack_1'),
          },
          image: WIDGETS.value,
        }),
        NOON,
      );
    });

    it('requests only checks in a workspace whose pools provision', async () => {
      const { provisioner, checks } = provisioning(
        [],
        [aPool('burst')],
        {},
        NOON,
        0,
        { awaiting: [aWaitingCheck('stack_1')] },
      );

      await provisioner.due();

      expect(checks.awaiting).toHaveBeenCalledWith(
        WorkspaceId.of('ws_1'),
        NOON,
        {
          after: null,
          max: 200,
        },
      );
    });

    it('gives the runs the room before the checks when there is not enough for both', async () => {
      const { provisioner, provision, checks } = provisioning(
        [waiting('run_1')],
        [{ ...aPool('burst'), maxRuns: 2 }],
        {},
        NOON,
        1,
        { awaiting: [aWaitingCheck('stack_1')] },
      );

      await provisioner.due();

      expect(provision.mock.calls.map(([request]) => request.work)).toEqual([
        { kind: 'run', id: 'run_1' },
      ]);
      expect(checks.reserve).not.toHaveBeenCalled();
    });

    it('shares what room is left after the runs with the checks', async () => {
      const { provisioner, provision } = provisioning(
        [waiting('run_1')],
        [{ ...aPool('burst'), maxRuns: 2 }],
        {},
        NOON,
        0,
        { awaiting: [aWaitingCheck('stack_1'), aWaitingCheck('stack_2')] },
      );

      await provisioner.due();

      expect(
        provision.mock.calls.map(([request]) => request.work),
      ).toHaveLength(2);
      expect(provision.mock.calls.map(([request]) => request.work)).toEqual(
        expect.arrayContaining([
          { kind: 'run', id: 'run_1' },
          { kind: 'check', id: 'stack_1', runId: RunId.of('run_of_stack_1') },
        ]),
      );
    });

    it('leaves alone a check no pool that provisions could take', async () => {
      const { provisioner, provision, checks } = provisioning(
        [],
        [aPool('burst', ['gpu'])],
        {},
        NOON,
        0,
        { awaiting: [aWaitingCheck('stack_1', ['vpc-internal'])] },
      );

      await provisioner.due();

      expect(checks.reserve).not.toHaveBeenCalled();
      expect(provision).not.toHaveBeenCalled();
    });

    it('provisions nothing for a check that could no longer be reserved', async () => {
      const { provisioner, provision } = provisioning(
        [],
        [aPool('burst')],
        {},
        NOON,
        0,
        { awaiting: [aWaitingCheck('stack_1')], reserves: false },
      );

      await provisioner.due();

      expect(provision).not.toHaveBeenCalled();
    });

    it('records a failed provision on the check', async () => {
      const { provisioner, checks } = provisioning(
        [],
        [aPool('burst')],
        {
          pool_burst: {
            outcome: 'failed',
            kind: 'http-error',
            detail: 'answered 503',
          },
        },
        NOON,
        0,
        { awaiting: [aWaitingCheck('stack_1')] },
      );

      await provisioner.due();

      expect(checks.failed).toHaveBeenCalledWith(
        checkWork('stack_1'),
        RunnerId.of('pooled_1'),
        ProvisionFailure.of('http-error', 'answered 503'),
        NOON,
      );
      expect(checks.unreserve).not.toHaveBeenCalled();
    });

    it('records only the last fitting pool’s failure on the check', async () => {
      const { provisioner, checks } = provisioning(
        [],
        [aPool('a-dead'), aPool('b-unusable')],
        {
          'pool_a-dead': {
            outcome: 'failed',
            kind: 'unreachable',
            detail: 'connect ECONNREFUSED',
          },
          'pool_b-unusable': {
            outcome: 'failed',
            kind: 'unusable',
            detail: 'the pool’s provision secret does not open',
          },
        },
        NOON,
        0,
        { awaiting: [aWaitingCheck('stack_1')] },
      );

      await provisioner.due();

      expect(checks.failed).toHaveBeenCalledOnce();
      expect(checks.failed).toHaveBeenCalledWith(
        checkWork('stack_1'),
        RunnerId.of('pooled_2'),
        ProvisionFailure.of(
          'unusable',
          'the pool’s provision secret does not open',
        ),
        NOON,
      );
      expect(checks.unreserve).toHaveBeenCalledOnce();
      expect(checks.unreserve).toHaveBeenCalledWith(
        checkWork('stack_1'),
        RunnerId.of('pooled_1'),
      );
    });

    it('drops the reservation and tries the next fitting pool when the first is full', async () => {
      const { provisioner, provision, checks } = provisioning(
        [],
        [aPool('b-spare'), aPool('a-burst')],
        { 'pool_a-burst': { outcome: 'full' } },
        NOON,
        0,
        { awaiting: [aWaitingCheck('stack_1')] },
      );

      await provisioner.due();

      expect(provision.mock.calls.map(([request]) => request.poolId)).toEqual([
        'pool_a-burst',
        'pool_b-spare',
      ]);
      expect(checks.unreserve).toHaveBeenCalledOnce();
      expect(checks.unreserve).toHaveBeenCalledWith(
        checkWork('stack_1'),
        RunnerId.of('pooled_1'),
      );
      expect(checks.reserve.mock.calls.map(([, , pool]) => pool)).toEqual([
        PoolId.of('pool_a-burst'),
        PoolId.of('pool_b-spare'),
      ]);
      expect(checks.failed).not.toHaveBeenCalled();
    });

    it('fails a check reservation nobody claimed in time', async () => {
      const { provisioner, checks, release } = provisioning(
        [],
        [],
        {},
        LATER,
        0,
        {
          expired: [
            {
              work: checkWork('stack_1'),
              runner: RunnerId.of('pooled_9'),
              until: LATER,
            },
          ],
        },
      );

      await provisioner.due();

      expect(checks.failed).toHaveBeenCalledWith(
        checkWork('stack_1'),
        RunnerId.of('pooled_9'),
        ProvisionFailure.expired(LATER),
        LATER,
      );
      expect(release).not.toHaveBeenCalled();
    });
  });
});
