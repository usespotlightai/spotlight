import { randomUUID } from 'node:crypto';
import { DrizzleStackCheckRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/stack-check.repository';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

const NOW = new Date('2026-01-02T03:04:05.000Z');

let held: TestDatabase;
let db: DrizzleDatabase;
let runs: DrizzleRunRepository;
let checks: DrizzleStackCheckRepository;

beforeAll(async () => {
  held = await openDatabase('runner_claim');
  db = held.db;
  runs = new DrizzleRunRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  checks = new DrizzleStackCheckRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
}, 60_000);

afterAll(async () => {
  await held?.close();
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

describe('claiming placed work', () => {
  it('hands a run placed by several lines only to a runner every one of them admits', async () => {
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

  it('hands it only to the runner it was reserved for, while the reservation holds', async () => {
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

  it('lets any runner take it once the reservation has lapsed', async () => {
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

  it('hides it from every other runner while the reservation holds', async () => {
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

  it('lets any runner take it once the reservation has lapsed', async () => {
    const workspaceId = randomUUID();
    const stackId = await awaitingCheck(workspaceId, []);
    await reserveCheck(stackId, RunnerId.of(randomUUID()), NOW);

    expect(
      (await checks.dueForCheck(by(workspaceId), LATER))?.stackId.value,
    ).toBe(stackId);
  });
});
