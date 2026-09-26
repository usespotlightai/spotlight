import { randomUUID } from 'node:crypto';
import {
  HOOK_FIRINGS,
  type HookFiringsPort,
  type NewFiring,
} from '@integrations/application/ports/hook-firings.port';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { eq } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { openApp } from './support/app';
import * as schema from './support/schema';

describe('hook firings, kept in the database (e2e)', () => {
  let app: INestApplication;
  let firings: HookFiringsPort;
  let db: DrizzleDatabase;
  let hookId: string;

  const NOW = new Date('2126-09-26T10:00:00.000Z');

  const firing = (occurrence: string): NewFiring => ({
    id: randomUUID(),
    hookId,
    workspaceId: 'workspace_1',
    teamId: 'team_1',
    taskId: 'task_1',
    runId: null,
    on: 'task.opened',
    occurrence,
    at: NOW,
    event: {},
    matched: true,
  });

  beforeAll(async () => {
    app = await openApp();
    firings = app.get<HookFiringsPort>(HOOK_FIRINGS);
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    hookId = randomUUID();
    await db.insert(schema.hookDefinition).values({
      id: hookId,
      workspaceId: 'workspace_1',
      teamId: `team_${hookId}`,
      key: 'opened',
      on: 'task.opened',
      definition: {},
      tools: [],
    });
  });

  afterEach(async () => {
    await db
      .delete(schema.hookDefinition)
      .where(eq(schema.hookDefinition.id, hookId));
  });

  it('fires each hook once per occurrence', async () => {
    await expect(firings.fire(firing('occurrence_1'))).resolves.toBe(true);
    await expect(firings.fire(firing('occurrence_1'))).resolves.toBe(false);
  });

  it('lets only the worker that holds a firing write to it', async () => {
    await firings.fire(firing('occurrence_2'));
    const first = await firings.claimNext(NOW);
    const later = new Date(NOW.getTime() + 11 * 60 * 1000);
    const second = await firings.claimNext(later);

    expect(first?.id).toBe(second?.id);

    await firings.worked(first as NonNullable<typeof first>, later);
    const [kept] = await db
      .select()
      .from(schema.hookFiring)
      .where(eq(schema.hookFiring.id, first?.id ?? ''));

    expect(kept?.state).toBe('working');

    await firings.worked(second as NonNullable<typeof second>, later);
    const [done] = await db
      .select()
      .from(schema.hookFiring)
      .where(eq(schema.hookFiring.id, first?.id ?? ''));

    expect(done?.state).toBe('done');
  });

  it('forgets finished firings once they are old, and nothing still owed', async () => {
    await firings.fire(firing('occurrence_3'));
    await firings.fire(firing('occurrence_4'));
    const finished = await firings.claimNext(NOW);

    await firings.worked(finished as NonNullable<typeof finished>, NOW);

    await expect(
      firings.forgetFinished(new Date(NOW.getTime() + 1), 10),
    ).resolves.toBeGreaterThanOrEqual(1);

    const left = await db
      .select()
      .from(schema.hookFiring)
      .where(eq(schema.hookFiring.hookId, hookId));

    expect(left.map((each) => each.state)).toEqual(['pending']);
  });
});
