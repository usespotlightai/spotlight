import { randomUUID } from 'node:crypto';
import {
  HOOK_FIRINGS,
  type HookFiringsPort,
  type NewFiring,
} from '@integrations/application/ports/hook-firings.port';
import { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
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

const OPENED = {
  kind: 'event' as const,
  key: 'task.opened:task_1:triage',
  saying: 'task.opened of Fix the queue (triage)',
};

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
    stationKey: 'triage',
    on: 'task.opened',
    occurrence,
    at: NOW,
    event: {},
    matched: true,
    cause: CausalChain.none().followedBy(OPENED),
    link: {
      kind: 'hook',
      key: `hook:${hookId}:${OPENED.key}`,
      saying: 'the hook opened',
    },
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

  it('keeps the chain of causes a firing came from, and hands it on with the firing itself', async () => {
    const fired = firing('occurrence_5');
    await firings.fire(fired);

    const claimed = await firings.claimNext(NOW);

    expect(claimed?.cause.saying).toBe(OPENED.saying);
    expect(claimed?.link.key).toBe(`hook:${hookId}:${OPENED.key}`);
    await expect(
      firings.chainOf('workspace_1', fired.id).then((chain) => chain?.saying),
    ).resolves.toBe(`${OPENED.saying} → the hook opened`);
    await expect(firings.chainOf('workspace_2', fired.id)).resolves.toBeNull();
  });

  it('counts the earlier firings of a hook for the same change since a moment, never later ones', async () => {
    const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
    await firings.fire({ ...firing('occurrence_6'), at: at(-30) });
    await firings.fire({ ...firing('occurrence_7'), at: at(-20) });
    await firings.fire({ ...firing('occurrence_8'), at: at(-10) });
    await firings.fire({ ...firing('occurrence_8b'), at: at(0) });
    const first = await firings.claimNext(NOW);
    const second = await firings.claimNext(NOW);
    const third = await firings.claimNext(NOW);

    await expect(
      firings.recentRepeats(
        third as NonNullable<typeof third>,
        new Date(NOW.getTime() - 60_000),
      ),
    ).resolves.toBe(2);
    await expect(
      firings.recentRepeats(third as NonNullable<typeof third>, at(-25)),
    ).resolves.toBe(1);
    await expect(
      firings.recentRepeats(
        first as NonNullable<typeof first>,
        new Date(NOW.getTime() - 60_000),
      ),
    ).resolves.toBe(0);
    expect(second?.occurrence).toBe('occurrence_7');
  });

  it('keeps what kind of failure ended a firing, and a superseded one apart from a failed one', async () => {
    await firings.fire(firing('occurrence_9'));
    await firings.fire(firing('occurrence_10'));
    const first = await firings.claimNext(NOW);
    const second = await firings.claimNext(NOW);

    await firings.failed(
      first as NonNullable<typeof first>,
      HookFailure.of('rejected', 'was answered 404'),
      NOW,
    );
    await firings.failed(
      second as NonNullable<typeof second>,
      HookFailure.of('superseded', 'its task moved on'),
      NOW,
    );

    const ended = await db
      .select()
      .from(schema.hookFiring)
      .where(eq(schema.hookFiring.hookId, hookId));

    expect(ended.map((each) => [each.state, each.failure]).sort()).toEqual([
      ['failed', 'rejected'],
      ['superseded', 'superseded'],
    ]);
  });
});
