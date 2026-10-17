import { randomUUID } from 'node:crypto';
import { CheckAccess } from '@change-review/application/services/check-access.service';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { DrizzleStackCheckRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/stack-check.repository';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

const NOW = new Date('2026-01-02T03:04:05.000Z');

let database: TestDatabase;
let db: DrizzleDatabase;
let runs: DrizzleRunRepository;
let checks: DrizzleStackCheckRepository;

beforeAll(async () => {
  database = await openDatabase('runner_claim');
  db = database.db;
  runs = new DrizzleRunRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  checks = new DrizzleStackCheckRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const queue = async (workspaceId: string, placement: string[][] = []) => {
  const id = randomUUID();

  await db.insert(schema.run).values({
    id,
    workspaceId,
    harness: 'dev',
    state: 'queued',
    placement,
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task:station' },
    },
  });

  return id;
};

const claimant = (
  workspaceId: string,
  terms = ['runner-1'],
  claims: 'any' | 'reserved' = 'any',
  runner = RunnerId.of(randomUUID()),
) => ({
  runner,
  workspaceId: WorkspaceId.of(workspaceId),
  harnesses: [HarnessId.of('dev')],
  terms: RunnerTerms.of(terms),
  claims,
});

const reserve = async (runId: string, runner: RunnerId, until: Date) => {
  await db
    .update(schema.run)
    .set({
      reservedFor: runner.value,
      reservedPool: 'pool_1',
      reservedUntil: until,
    })
    .where(eq(schema.run.id, runId));
};

const awaitingCheck = async (workspaceId: string, placement: string[][]) => {
  const stackId = randomUUID();

  await db.insert(schema.stackCheck).values({
    stackId,
    runId: randomUUID(),
    workspaceId,
    command: 'npm test',
    placement,
    phase: 'waiting',
    waitingSince: NOW,
  });

  return stackId;
};

describe('claiming a run', () => {
  it('never hands a runner a run queued in another workspace', async () => {
    await queue('ws_theirs');

    await expect(runs.claimNext(claimant('ws_mine'), NOW)).resolves.toBeNull();
  });

  it('hands a runner a run queued in its own workspace', async () => {
    const mine = await queue('ws_own');

    const claimed = await runs.claimNext(claimant('ws_own'), NOW);

    expect(claimed?.id.value).toBe(mine);
  });
});

describe('claiming a requeued run', () => {
  it('hands out another waiting run while a requeued one waits out its back-off, and counts the requeue without a new attempt', async () => {
    const workspaceId = randomUUID();
    const first = await queue(workspaceId);
    const runner = RunnerId.of(randomUUID());

    const claimed = await runs.claimNext(
      claimant(workspaceId, ['runner-1'], 'any', runner),
      NOW,
    );
    expect(claimed?.id.value).toBe(first);
    const stored = await runs.findById(
      (claimed as NonNullable<typeof claimed>).id,
    );
    await runs.save(
      (stored as NonNullable<typeof stored>).requeue(
        runner,
        NOW,
        'connect ECONNREFUSED',
      ),
    );
    const other = await queue(workspaceId);

    expect((await runs.claimNext(claimant(workspaceId), NOW))?.id.value).toBe(
      other,
    );
    expect(await runs.claimNext(claimant(workspaceId), NOW)).toBeNull();

    const again = await runs.claimNext(
      claimant(workspaceId),
      new Date(NOW.getTime() + 5_000),
    );
    expect(again?.id.value).toBe(first);
    expect(again?.attempt).toBe(1);
    expect(again?.requeueCount.count).toBe(1);
  });
});

describe('claiming placed work', () => {
  it('hands a run placed by several lines only to a runner every one of them matches', async () => {
    const placed = await queue('ws_placed', [['vpc-a', 'build-1'], ['gpu']]);

    await expect(
      runs.claimNext(claimant('ws_placed', ['vpc-a']), NOW),
    ).resolves.toBeNull();
    await expect(
      runs.claimNext(claimant('ws_placed', ['gpu']), NOW),
    ).resolves.toBeNull();

    const claimed = await runs.claimNext(
      claimant('ws_placed', ['build-1', 'gpu']),
      NOW,
    );

    expect(claimed?.id.value).toBe(placed);
  });

  it('offers a check placed on a label only to a runner that carries it', async () => {
    const placed = await awaitingCheck('ws_checked', [['vpc-internal']]);
    const by = (terms: string[]) => ({
      workspaceId: WorkspaceId.of('ws_checked'),
      runner: RunnerId.of(randomUUID()),
      terms: RunnerTerms.of(terms),
    });

    await expect(checks.dueForCheck(by(['laptop']), NOW)).resolves.toBeNull();

    const due = await checks.dueForCheck(by(['laptop', 'vpc-internal']), NOW);

    expect(due?.stackId.value).toBe(placed);
    expect(due?.request.placement.clauses).toEqual([['vpc-internal']]);
  });
});
describe('claiming a run reserved for a provisioned runner', () => {
  const LATER = new Date(NOW.getTime() + 60_000);

  it('hands it only to the runner it was reserved for, while the reservation is active', async () => {
    const workspaceId = randomUUID();
    const provisioned = RunnerId.of(randomUUID());
    const runId = await queue(workspaceId);
    await reserve(runId, provisioned, LATER);

    expect(await runs.claimNext(claimant(workspaceId), NOW)).toBeNull();

    const claimed = await runs.claimNext(
      claimant(workspaceId, ['runner-1'], 'reserved', provisioned),
      NOW,
    );

    expect(claimed?.id.value).toBe(runId);
    expect(claimed?.reservation).toBeNull();
  });

  it('lets any runner claim it once the reservation has expired', async () => {
    const workspaceId = randomUUID();
    const runId = await queue(workspaceId);
    await reserve(runId, RunnerId.of(randomUUID()), NOW);

    expect((await runs.claimNext(claimant(workspaceId), LATER))?.id.value).toBe(
      runId,
    );
  });

  it('gives a provisioned runner nothing but its own reservation', async () => {
    const workspaceId = randomUUID();
    await queue(workspaceId);

    expect(
      await runs.claimNext(
        claimant(workspaceId, ['runner-1'], 'reserved'),
        NOW,
      ),
    ).toBeNull();
  });
});
describe('claiming a check reserved for a provisioned runner', () => {
  const LATER = new Date(NOW.getTime() + 60_000);

  const reserveCheck = async (
    stackId: string,
    runner: RunnerId,
    until: Date,
  ) => {
    await db
      .update(schema.stackCheck)
      .set({
        reservedFor: runner.value,
        reservedPool: 'pool_1',
        reservedUntil: until,
      })
      .where(eq(schema.stackCheck.stackId, stackId));
  };

  const by = (workspaceId: string, runner = RunnerId.of(randomUUID())) => ({
    workspaceId: WorkspaceId.of(workspaceId),
    runner,
    terms: RunnerTerms.none(),
  });

  it('hides it from every other runner while the reservation is active', async () => {
    const provisioned = RunnerId.of(randomUUID());
    const workspaceId = randomUUID();
    const stackId = await awaitingCheck(workspaceId, []);
    await reserveCheck(stackId, provisioned, LATER);

    await expect(checks.dueForCheck(by(workspaceId), NOW)).resolves.toBeNull();
    expect((await checks.reservedTo(provisioned, NOW))?.stackId.value).toBe(
      stackId,
    );
    expect(
      (await checks.dueForCheck(by(workspaceId, provisioned), NOW))?.stackId
        .value,
    ).toBe(stackId);
  });

  it('lets any runner claim it once the reservation has expired', async () => {
    const workspaceId = randomUUID();
    const stackId = await awaitingCheck(workspaceId, []);
    await reserveCheck(stackId, RunnerId.of(randomUUID()), NOW);

    expect(
      (await checks.dueForCheck(by(workspaceId), LATER))?.stackId.value,
    ).toBe(stackId);
  });
});
describe('deleting the checks of a deleted task', () => {
  const dispatched: DomainEvent[] = [];
  const deleting = () =>
    new DrizzleStackCheckRepository(new DrizzleContext(db), {
      dispatch: async (events) => {
        dispatched.push(...events);
      },
    });

  const begun = (taskId: TaskId) =>
    StackCheck.begin({
      stackId: ChangeStackId.of(randomUUID()),
      runId: RunId.of(randomUUID()),
      taskId,
      replay: false,
      workspaceId: WorkspaceId.of(randomUUID()),
      request: CheckRequest.of('npm test', null),
      entries: [],
      now: NOW,
    });

  it('finds every check of the task and removes each, and releases its reserved runner', async () => {
    const repository = deleting();
    const task = TaskId.of(randomUUID());
    const runner = RunnerId.of(randomUUID());
    const reserved = begun(task).reservedFor(runner, PoolId.of('pool_1'), NOW);
    const other = begun(TaskId.of(randomUUID()));
    await repository.add(reserved);
    await repository.add(other);

    const found = await repository.ofTask(task);
    const [check] = found;

    expect(found).toHaveLength(1);
    if (!check) {
      throw new Error('the task’s check was not found');
    }
    expect(check.stackId).toEqual(reserved.stackId);
    expect(check.taskId).toEqual(task);

    await repository.remove(check.delete(NOW));

    await expect(repository.ofTask(task)).resolves.toEqual([]);
    await expect(repository.find(other.stackId, false)).resolves.not.toBeNull();
    expect(dispatched.map((each) => each.kind)).toContain(
      'change-stack.check-reservation-dropped',
    );
  });

  it('does not remove a check that changed since it was read', async () => {
    const repository = deleting();
    const task = TaskId.of(randomUUID());
    await repository.add(begun(task));
    const [stale] = await repository.ofTask(task);
    if (!stale) {
      throw new Error('the task’s check was not found');
    }
    await repository.save(
      stale.reservedFor(RunnerId.of(randomUUID()), PoolId.of('pool_1'), NOW),
    );

    await expect(repository.remove(stale.delete(NOW))).rejects.toThrow(
      StackCheckVersionConflictError,
    );
  });
});

describe('a runner reaching git for a run whose check it leases', () => {
  const checkOf = (runId: RunId) =>
    StackCheck.begin({
      stackId: ChangeStackId.of(randomUUID()),
      runId,
      taskId: null,
      replay: false,
      workspaceId: WorkspaceId.of(randomUUID()),
      request: CheckRequest.of('npm test', null),
      entries: [],
      now: NOW,
    });

  it('leases the check only while its lease runs and only to the runner that claimed it', async () => {
    const runId = RunId.of(randomUUID());
    const runner = RunnerId.of(randomUUID());
    const waiting = checkOf(runId);
    await checks.add(waiting);
    await checks.add(checkOf(RunId.of(randomUUID())));
    const claimed = waiting.claimedFor(runner, RunnerTerms.none(), NOW);
    await checks.save(claimed);
    const access = new CheckAccess(checks);
    const expired = new Date(
      (claimed.claim.leaseExpiresAt?.getTime() ?? 0) + 1,
    );

    await expect(access.isCheckOfRunLeasedBy(runId, runner, NOW)).resolves.toBe(
      true,
    );
    await expect(
      access.isCheckOfRunLeasedBy(runId, RunnerId.of(randomUUID()), NOW),
    ).resolves.toBe(false);
    await expect(
      access.isCheckOfRunLeasedBy(RunId.of(randomUUID()), runner, NOW),
    ).resolves.toBe(false);
    await expect(
      access.isCheckOfRunLeasedBy(runId, runner, expired),
    ).resolves.toBe(false);
  });
});
