import type {
  PoolRunnersPort,
  ProvisionedRunner,
  ProvisionRequest,
} from '@runners/application/ports/pool-runners.port';
import type {
  PoolAtWork,
  RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
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
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { describe, expect, it, vi } from 'vitest';

const NOON = new Date('2026-09-24T12:00:00.000Z');
const LATER = new Date('2026-09-24T12:05:00.000Z');

const waiting = (id: string, placement: string[] = [], workspace = 'ws_1') =>
  Run.enqueue({
    id: RunId.of(id),
    workspaceId: WorkspaceId.of(workspace),
    harness: HarnessId.of('dev'),
    subject: RunSubject.task(TaskId.of('task_1'), null),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station', keep: true },
    }),
    placement: RunnerPlacement.of(placement),
  });

const aWaitingCheck = (stackId: string, placement: string[] = []) => ({
  stackId,
  runId: `run_of_${stackId}`,
  placement: RunnerPlacement.of(placement),
});

const aPool = (key: string, labels: string[] = []): PoolAtWork => ({
  poolId: `pool_${key}`,
  workspaceId: WorkspaceId.of('ws_1'),
  key,
  labels: RunnerTerms.of(labels),
  maxRuns: null,
});

const provisioning = (
  queue: readonly Run[],
  pools: readonly PoolAtWork[],
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
      page: { readonly skip: number; readonly most: number },
    ) =>
      [...held.values()]
        .filter(
          (each) =>
            each.workspaceId.equals(workspaceId) && each.provisionableAt(at),
        )
        .slice(page.skip, page.skip + page.most),
  );
  const runs = {
    findById: async (id: RunId) => held.get(id.value) ?? null,
    save: async (run: Run) => {
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
    { append: async () => {} },
    { publish: () => {}, subscribe: () => () => {} },
  );

  return {
    provision,
    letGo,
    checks,
    awaitingProvision,
    run: (id: string) => held.get(id) as Run,
    provisioner: new ProvisionWork(
      runs,
      checks,
      {
        provisioning: async () => pools,
        running: async () => running,
      } as unknown as RunnerPoolsPort,
      { provision, letGo } as unknown as PoolRunnersPort,
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
        claimBy: LATER,
      },
      NOON,
    );
    expect(run('run_1').reservation?.runner.value).toBe('pooled_1');
    expect(run('run_1').reservation?.pool).toBe('pool_burst');
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
    expect(run('run_1').reservation?.pool).toBe('pool_b-spare');
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

  it('fails a reservation nobody claimed in time and lets its runner go', async () => {
    const lapsing = waiting('run_1').reservedFor(
      RunnerId.of('pooled_9'),
      'pool_burst',
      NOON,
    );
    const { provisioner, provision, letGo, run } = provisioning(
      [lapsing],
      [],
      {},
      LATER,
    );

    await provisioner.due();

    expect(run('run_1').reservation).toBeNull();
    expect(run('run_1').provisioning.failures).toBe(1);
    expect(letGo).toHaveBeenCalledWith(RunnerId.of('pooled_9'), LATER);
    expect(provision).not.toHaveBeenCalled();
  });

  it('keeps a reservation that still holds', async () => {
    const { provisioner, letGo, run } = provisioning(
      [
        waiting('run_1').reservedFor(
          RunnerId.of('pooled_9'),
          'pool_burst',
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
        'pool_burst',
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
          claimBy: LATER,
        },
        NOON,
      );
      expect(checks.failed).not.toHaveBeenCalled();
      expect(checks.unreserve).not.toHaveBeenCalled();
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
          most: 200,
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
        'pool_a-burst',
        'pool_b-spare',
      ]);
      expect(checks.failed).not.toHaveBeenCalled();
    });

    it('fails a check reservation nobody claimed in time and lets its runner go', async () => {
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
      expect(letGo).toHaveBeenCalledWith(RunnerId.of('pooled_9'), LATER);
    });
  });
});
