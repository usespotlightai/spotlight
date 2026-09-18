import { randomUUID } from 'node:crypto';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DrizzleRunRepository } from '@work/infrastructure/persistence/drizzle/repositories/run.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

const NOW = new Date('2026-01-02T03:04:05.000Z');

let held: TestDatabase;
let db: DrizzleDatabase;
let runs: DrizzleRunRepository;

beforeAll(async () => {
  held = await openDatabase('runner_claim');
  db = held.db;
  runs = new DrizzleRunRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
}, 60_000);

afterAll(async () => {
  await held?.close();
});

const queue = async (workspaceId: string) => {
  const id = randomUUID();

  await db.insert(schema.run).values({
    id,
    workspaceId,
    harness: 'dev',
    state: 'queued',
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task:station', keep: true },
    },
  });

  return id;
};

const claimant = (workspaceId: string) => ({
  runner: RunnerId.of(randomUUID()),
  workspaceId: WorkspaceId.of(workspaceId),
  harnesses: [HarnessId.of('dev')],
});

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
