import { randomUUID } from 'node:crypto';
import { DrizzleStackCheckRepository } from '@change-review/infrastructure/persistence/drizzle/repositories/stack-check.repository';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
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
      continuity: { key: 'task:station', keep: true },
    },
  });

  return id;
};

const claimant = (workspaceId: string, terms = ['runner-1']) => ({
  runner: RunnerId.of(randomUUID()),
  workspaceId: WorkspaceId.of(workspaceId),
  harnesses: [HarnessId.of('dev')],
  terms: RunnerTerms.of(terms),
});

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
