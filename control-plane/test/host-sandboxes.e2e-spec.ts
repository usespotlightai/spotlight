import { createHash, randomUUID } from 'node:crypto';

import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DrizzleRunnerReader } from '@runners/infrastructure/persistence/drizzle/readers/runner.reader';
import { DrizzleRunnerRepository } from '@runners/infrastructure/persistence/drizzle/repositories/runner.repository';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';

const NOW = new Date('2026-11-14T12:00:00.000Z');

const WORKSPACE = 'ws_host_sandboxes';

const HOST = 'HOSTSANDBOXES0000000000001';

const OTHER_HOST = 'HOSTSANDBOXES0000000000002';

const aTokenHash = () =>
  createHash('sha256').update(randomUUID()).digest('hex');

const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000);

let database: TestDatabase;
let db: DrizzleDatabase;
let reader: DrizzleRunnerReader;
let runners: DrizzleRunnerRepository;
let poolId: string;

const host = (id: string) => ({
  id,
  workspaceId: WORKSPACE,
  poolId,
  name: id,
  release: '0.9.0',
  containerRuntime: 'docker',
  capacity: 4,
  bootId: randomUUID(),
  firstHeartbeatAt: minutesAgo(60),
  onlineSince: minutesAgo(60),
  lastHeartbeatAt: NOW,
});

const sandbox = (over: Partial<typeof schema.sandbox.$inferInsert>) => ({
  id: randomUUID(),
  workspaceId: WORKSPACE,
  hostId: HOST,
  poolId,
  tokenHash: aTokenHash(),
  state: 'open' as const,
  startedAt: minutesAgo(30),
  ...over,
});

const runner = (over: Partial<typeof schema.runner.$inferInsert>) => ({
  id: randomUUID(),
  workspaceId: WORKSPACE,
  poolId,
  hostId: HOST,
  tokenHash: aTokenHash(),
  claimBy: minutesAgo(-1),
  startedAt: minutesAgo(5),
  ...over,
});

beforeAll(async () => {
  database = await openDatabase('host_sandboxes');
  db = database.db;
  reader = new DrizzleRunnerReader(db, { now: () => NOW } as never, false);
  runners = new DrizzleRunnerRepository(new DrizzleContext(db), {
    dispatch: async () => {},
  });
  poolId = randomUUID();

  await db.insert(schema.runnerPool).values({
    id: poolId,
    workspaceId: WORKSPACE,
    key: 'build-farm',
    tokenHash: aTokenHash(),
    tokenVersion: 1,
  });
  await db.insert(schema.runnerHost).values([host(HOST), host(OTHER_HOST)]);
}, 60_000);

afterAll(async () => {
  await database?.close();
});

describe('the sandboxes that wait on a host', () => {
  it('lists the idle sandboxes of the hosts asked for, open or draining, and the working copies they keep', async () => {
    const kept = sandbox({
      key: `work/task-${randomUUID()}`,
      idleSince: minutesAgo(7),
    });
    const warm = sandbox({
      idleSince: minutesAgo(20),
      startedAt: minutesAgo(20),
    });
    const draining = sandbox({
      key: `work/chat-${randomUUID()}`,
      state: 'draining',
      idleSince: minutesAgo(3),
      startedAt: minutesAgo(10),
    });

    await db.insert(schema.sandbox).values([
      kept,
      warm,
      draining,
      sandbox({ key: `work/task-${randomUUID()}` }),
      sandbox({
        key: `work/task-${randomUUID()}`,
        state: 'gone',
        idleSince: minutesAgo(9),
        goneAt: minutesAgo(1),
      }),
      sandbox({
        key: `work/task-${randomUUID()}`,
        hostId: OTHER_HOST,
        idleSince: minutesAgo(2),
      }),
    ]);

    const idle = await reader.idleSandboxesOn([HOST]);

    expect(idle.map((each) => [each.id, each.state])).toEqual([
      [kept.id, 'open'],
      [warm.id, 'open'],
      [draining.id, 'draining'],
    ]);
    await expect(reader.idleSandboxesOn([])).resolves.toEqual([]);

    const keys = await reader.keptIn(WorkspaceId.of(WORKSPACE));

    expect(keys).toEqual(expect.arrayContaining([kept.key, draining.key]));
    expect(keys).toHaveLength(3);
  });
});

describe('the runners alive on hosts', () => {
  it('finds the runners at work with a fresh heartbeat and the ones still inside their claim window, and none that ended or timed out', async () => {
    const working = runner({
      workKind: 'run',
      workId: randomUUID(),
      lastHeartbeatAt: NOW,
    });
    const claiming = runner({});

    await db.insert(schema.runner).values([
      working,
      claiming,
      runner({ claimBy: minutesAgo(1) }),
      runner({
        workKind: 'run',
        workId: randomUUID(),
        lastHeartbeatAt: minutesAgo(60),
      }),
      runner({ endedAt: minutesAgo(1) }),
      runner({ hostId: null }),
      runner({ workspaceId: 'ws_other' }),
    ]);

    const alive = await runners.aliveOnHostsIn(WorkspaceId.of(WORKSPACE), NOW);

    expect(alive.map((each) => each.id.value).sort()).toEqual(
      [working.id, claiming.id].sort(),
    );
  });
});
