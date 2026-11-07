import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { deleteRunsOf } from './support/runners';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

let app: INestApplication;
let db: DrizzleDatabase;
let seated: Awaited<ReturnType<typeof seatTeam>>;
const WORKSPACE = `raw-${randomUUID().slice(0, 8)}`;

const SPEC = {
  briefing: 'Tidy the queue.',
  handover: { options: [], noteLimit: 0 },
};

const ordered = (spec: object) =>
  served(app)
    .post(`/api/workspaces/${WORKSPACE}/runs`)
    .set(TEST_USER_HEADER, seated.owner)
    .send({ harness: 'claude-code', spec: { ...SPEC, ...spec } });

const runRow = async (id: string) => {
  const [row] = await db.select().from(schema.run).where(eq(schema.run.id, id));

  return row;
};

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  seated = await seatTeam(db, WORKSPACE);
}, 60_000);

afterAll(async () => {
  await deleteRunsOf(db, WORKSPACE);
  await seated?.unseat();
  await app?.close();
});

describe('a run ordered with a raw spec (e2e)', () => {
  it('queues it as the workspace’s own run, carrying on in the workspace’s key', async () => {
    const queued = await ordered({ resume: { key: 'nightly' } }).expect(201);
    const again = await ordered({
      resume: { key: 'workspace/nightly' },
    }).expect(201);

    for (const id of [queued.body.id, again.body.id]) {
      expect(await runRow(id)).toMatchObject({
        requesterOwner: 'workspace',
        requesterKind: 'spec',
        requesterId: id,
        workspaceKey: 'workspace/nightly',
        workspaceRejoinable: false,
        exclusive: false,
      });
    }
  });

  it('refuses a key another owner carries on in', async () => {
    const taskKey = `work/task-${randomUUID()}`;

    const refused = await ordered({ resume: { key: taskKey } }).expect(409);

    expect(refused.body.message).toBe(
      `Workspace ${taskKey} belongs to work Spotlight orders. A run you order can only carry on its own workspaces.`,
    );
    expect(
      await db
        .select()
        .from(schema.run)
        .where(eq(schema.run.workspaceKey, taskKey)),
    ).toEqual([]);
  });

  it('refuses what only Spotlight orders', async () => {
    for (const [field, asked] of [
      ['apiGrant', { apiGrant: { scopes: ['plan'] } }],
      ['restore', { restore: { archive: randomUUID() } }],
      ['extensions', { extensions: { replay: {} } }],
      ['injectedSecrets', { injectedSecrets: ['GITHUB_TOKEN'] }],
    ] as const) {
      const refused = await ordered(asked).expect(422);

      expect(refused.body.message).toBe(
        `Run spec must not ask for ${field}, which only Spotlight orders.`,
      );
    }
  });
});
