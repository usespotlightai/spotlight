import type {
  PoolAtWork,
  RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import type {
  ProvisionedRunner,
  ProvisionRequest,
  RunnersPort,
} from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  CheckProvisioningPort,
  LapsedCheck,
  WaitingCheck,
} from '@work/application/ports/check-provisioning.port';
import { ProvisionFailures } from '@work/application/services/provision-failures.service';
import { ProvisionWork } from '@work/application/services/provision-work.service';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it, vi } from 'vitest';

const NOON = new Date('2026-09-24T12:00:00.000Z');
const LATER = new Date('2026-09-24T12:05:00.000Z');

const waiting = (
  id: string,
  placement: string[] = [],
  workspace = 'ws_1',
  image: RunnerImage | null = null,
  wears: string[] = [],
) =>
  Run.enqueue({
    id: RunId.of(id),
    workspaceId: WorkspaceId.of(workspace),
    harness: HarnessId.of('dev'),
    subject: RunSubject.task(TaskId.of('task_1'), null, TaskRevision.of(0)),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station' },
      ...(wears.length > 0 ? { wears } : {}),
    }),
    placement: RunnerPlacement.of(placement).in(image),
  });

const aWaitingCheck = (
  stackId: string,
  placement: string[] = [],
  image: RunnerImage | null = null,
) => ({
  stackId,
  runId: `run_of_${stackId}`,
  placement: RunnerPlacement.of(placement).in(image),
});

const WIDGETS = RunnerImage.of('ghcr.io/acme/widgets:1');

type BoundedPool = PoolAtWork & { readonly maxRuns: number | null };

const aPool = (
  key: string,
  labels: string[] = [],
  egress = false,
): BoundedPool => ({
  poolId: `pool_${key}`,
  workspaceId: WorkspaceId.of('ws_1'),
  key,
  labels: RunnerTerms.of(labels),
  egress,
  maxRuns: null,
});

const provisioning = (
  queue: readonly Run[],
  pools: readonly BoundedPool[],
  answers: Record<string, ProvisionedRunner> = {},
  now = NOON,
  running = 0,
  waitingChecks: {
    readonly awaiting?: readonly WaitingCheck[];
    readonly lapsed?: readonly LapsedCheck[];
    readonly reserves?: boolean;
  } = {},
) => {
  const held = new Map(queue.map((each) => [each.id.value, each]));
  const awaitingProvision = vi.fn(
    async (
      workspaceId: WorkspaceId,
      at: Date,
      page: {
        readonly skip: number;
        readonly max: number;
        readonly withSecrets: boolean;
      },
    ) =>
      [...held.values()]
        .filter(
          (each) =>
            each.workspaceId.equals(workspaceId) &&
            each.provisionableAt(at, page.withSecrets),
        )
        .slice(page.skip, page.skip + page.max),
  );
  const recorded: DomainEvent[] = [];
  const runs = {
    findById: async (id: RunId) => held.get(id.value) ?? null,
    save: async (run: Run) => {
      recorded.push(...run.pullEvents());
      held.set(run.id.value, run);
    },
    awaitingProvision,
    withLapsedReservations: async (at: Date) =>
      [...held.values()].filter((each) => each.reservationLapsedAt(at)),
  } as unknown as RunRepository;
  const provision = vi.fn(
    async (request: ProvisionRequest): Promise<ProvisionedRunner> =>
      answers[request.poolId] ?? { outcome: 'provisioned' },
  );
  const letGo = vi.fn(async () => {});
  const checks = {
    awaiting: vi.fn(async (_workspaceId: WorkspaceId, _at: Date, page) =>
      page.skip === 0 ? (waitingChecks.awaiting ?? []) : [],
    ),
    reserve: vi.fn(async (_stackId: string, _runner: RunnerId, _pool, at) =>
      waitingChecks.reserves === false
        ? null
        : new Date(at.getTime() + 5 * 60_000),
    ),
    unreserve: vi.fn(async () => {}),
    failed: vi.fn(async () => {}),
    lapsed: vi.fn(async () => waitingChecks.lapsed ?? []),
  } satisfies CheckProvisioningPort;
  let generated = 0;
  const failures = new ProvisionFailures(
    runs,
    { append: async () => {}, appendAside: async () => -1_000_000 },
    { publish: () => {}, subscribe: () => () => {} },
  );

  return {
    provision,
    letGo,
    recorded,
    checks,
    awaitingProvision,
    run: (id: string) => held.get(id) as Run,
    provisioner: new ProvisionWork(
      runs,
      checks,
      {
        provisioning: async () => pools,
        roomIn: async (poolId: string) => {
          const maxRuns =
            pools.find((each) => each.poolId === poolId)?.maxRuns ?? null;

          return maxRuns === null ? null : Math.max(0, maxRuns - running);
        },
      } as unknown as RunnerPoolsPort,
      { provision, letGo } as unknown as RunnersPort,
      failures,
      {
        generate: () => {
          generated += 1;
          return `pooled_${generated}`;
        },
      },
      { now: () => now } as ClockPort,
    ),
  };
};

describe('ProvisionWork', () => {
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
    expect(run('run_1').provisioning.failures).toBe(0);
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
            stackId: 'stack_1',
            runId: 'run_9',
            placement: RunnerPlacement.of(['gpu']),
          },
        ],
      },
    );
    provision.mockRejectedValue(
      new Error('the provision secret does not open here'),
    );

    await expect(provisioner.due()).rejects.toThrow();

    expect(checks.unreserve).toHaveBeenCalledWith(
      'stack_1',
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

    expect(provision.mock.calls.map(([request]) => request.runId)).toEqual([
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
    expect(provision.mock.calls.map(([request]) => request.runId)).toEqual([
      'run_1',
    ]);
  });

  it('reserves a waiting run for a new runner and asks a fitting pool to start it', async () => {
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
        runId: 'run_1',
        taskId: 'task_1',
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

  it('asks the pool to start its runner in the image the run is placed in', async () => {
    const { provisioner, provision } = provisioning(
      [waiting('run_1', ['gpu'], 'ws_1', WIDGETS)],
      [aPool('burst', ['gpu'])],
    );

    await provisioner.due();

    expect(provision).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run_1', image: WIDGETS.value }),
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
    expect(run('run_1').provisioning.failures).toBe(1);
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
    expect(run('run_1').provisioning.failures).toBe(0);
  });

  it('counts one failure, the last, when every fitting pool fails', async () => {
    const { provisioner, run } = provisioning(
      [waiting('run_1')],
      [aPool('a-dead'), aPool('b-refusing')],
      {
        'pool_a-dead': {
          outcome: 'failed',
          kind: 'unreachable',
          detail: 'connect ECONNREFUSED',
        },
        'pool_b-refusing': {
          outcome: 'failed',
          kind: 'unusable',
          detail: 'the pool’s provision secret does not open',
        },
      },
    );

    await provisioner.due();

    expect(run('run_1').reservation).toBeNull();
    expect(run('run_1').provisioning.failures).toBe(1);
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
    expect(run('run_1').provisioning.failures).toBe(0);
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
            stackId: 'stack_1',
            runId: 'run_9',
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
    expect(run('run_1').provisioning.failures).toBe(0);
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
    expect(run('run_1').provisioning.failures).toBe(0);
  });

  it('leaves the run unreserved and unfailed when every fitting pool is gone', async () => {
    const { provisioner, run } = provisioning(
      [waiting('run_1')],
      [aPool('burst')],
      { pool_burst: { outcome: 'gone' } },
    );

    await provisioner.due();

    expect(run('run_1').reservation).toBeNull();
    expect(run('run_1').provisioning.failures).toBe(0);
  });

  it('gives a run that wears secrets only to a pool that names an egress', async () => {
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

  it('leaves alone a run that wears secrets where no pool names an egress', async () => {
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

  it('fails a reservation nobody claimed in time, saving that its runner is to be let go', async () => {
    const lapsing = waiting('run_1').reservedFor(
      RunnerId.of('pooled_9'),
      PoolId.of('pool_burst'),
      NOON,
    );
    const { provisioner, provision, letGo, recorded, run } = provisioning(
      [lapsing],
      [],
      {},
      LATER,
    );

    await provisioner.due();

    expect(run('run_1').reservation).toBeNull();
    expect(run('run_1').provisioning.failures).toBe(1);
    expect(recorded).toContainEqual(
      new RunReservationDropped(
        RunId.of('run_1'),
        WorkspaceId.of('ws_1'),
        RunnerId.of('pooled_9'),
      ),
    );
    expect(letGo).not.toHaveBeenCalled();
    expect(provision).not.toHaveBeenCalled();
  });

  it('keeps a reservation that still holds', async () => {
    const { provisioner, letGo, run } = provisioning(
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

    expect(letGo).not.toHaveBeenCalled();
    expect(run('run_1').reservation?.runner.value).toBe('pooled_9');
  });

  describe('for change-stack checks', () => {
    it('reserves a waiting check for a new runner and asks a fitting pool to start it for that check', async () => {
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
        'stack_1',
        RunnerId.of('pooled_1'),
        PoolId.of('pool_burst'),
        NOON,
      );
      expect(provision).toHaveBeenCalledWith(
        {
          poolId: 'pool_burst',
          runnerId: RunnerId.of('pooled_1'),
          work: { kind: 'check', id: 'stack_1' },
          runId: 'run_of_stack_1',
          taskId: null,
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

    it('asks the pool to start its runner in the image the check is placed in', async () => {
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
          work: { kind: 'check', id: 'stack_1' },
          image: WIDGETS.value,
        }),
        NOON,
      );
    });

    it('asks only for checks in a workspace whose pools provision', async () => {
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
          skip: 0,
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
          { kind: 'check', id: 'stack_1' },
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
            kind: 'refused',
            detail: 'answered 503',
          },
        },
        NOON,
        0,
        { awaiting: [aWaitingCheck('stack_1')] },
      );

      await provisioner.due();

      expect(checks.failed).toHaveBeenCalledWith(
        'stack_1',
        RunnerId.of('pooled_1'),
        ProvisionFailure.of('refused', 'answered 503'),
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
        'stack_1',
        RunnerId.of('pooled_2'),
        ProvisionFailure.of(
          'unusable',
          'the pool’s provision secret does not open',
        ),
        NOON,
      );
      expect(checks.unreserve).toHaveBeenCalledOnce();
      expect(checks.unreserve).toHaveBeenCalledWith(
        'stack_1',
        RunnerId.of('pooled_1'),
      );
    });

    it('lets the reservation go and tries the next fitting pool when the first is full', async () => {
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
        'stack_1',
        RunnerId.of('pooled_1'),
      );
      expect(checks.reserve.mock.calls.map(([, , pool]) => pool)).toEqual([
        PoolId.of('pool_a-burst'),
        PoolId.of('pool_b-spare'),
      ]);
      expect(checks.failed).not.toHaveBeenCalled();
    });

    it('fails a check reservation nobody claimed in time', async () => {
      const { provisioner, checks, letGo } = provisioning(
        [],
        [],
        {},
        LATER,
        0,
        {
          lapsed: [
            {
              stackId: 'stack_1',
              runner: RunnerId.of('pooled_9'),
              until: LATER,
            },
          ],
        },
      );

      await provisioner.due();

      expect(checks.failed).toHaveBeenCalledWith(
        'stack_1',
        RunnerId.of('pooled_9'),
        ProvisionFailure.lapsed(LATER),
        LATER,
      );
      expect(letGo).not.toHaveBeenCalled();
    });
  });
});
