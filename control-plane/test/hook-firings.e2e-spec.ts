import { randomUUID } from 'node:crypto';
import {
  HOOK_FIRING_HISTORY,
  type HookFiringHistoryPort,
} from '@integrations/application/ports/hook-firing-history.port';
import { HookFiring } from '@integrations/domain/aggregates/hook-firing.aggregate';
import { HookFiringVersionConflictError } from '@integrations/domain/exceptions/hook-firing-version-conflict.error';
import {
  HOOK_FIRINGS,
  type HookFiringRepository,
} from '@integrations/domain/repositories/hook-firing.repository';
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
  description: 'task.opened of Fix the queue (triage)',
};

describe('hook firings, stored in the database (e2e)', () => {
  let app: INestApplication;
  let firings: HookFiringRepository;
  let history: HookFiringHistoryPort;
  let db: DrizzleDatabase;
  let hookId: string;

  const NOW = new Date('2126-09-26T10:00:00.000Z');

  const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

  const firing = (occurrence: string, firedAt: Date = NOW): HookFiring =>
    HookFiring.fire({
      id: randomUUID(),
      hookId,
      workspaceId: 'workspace_1',
      teamId: 'team_1',
      taskId: 'task_1',
      runId: null,
      stationKey: 'triage',
      on: 'task.opened',
      occurrence,
      firedAt,
      event: {},
      matched: true,
      cause: CausalChain.none().append(OPENED),
      link: {
        kind: 'hook',
        key: `hook:${hookId}:${OPENED.key}`,
        description: 'the hook opened',
      },
    });

  const claimed = async (now: Date = NOW): Promise<HookFiring> => {
    const next = await firings.claimNext(now);

    if (!next) {
      throw new Error('nothing was due');
    }

    return next;
  };

  const stateOf = async (id: string) => {
    const [row] = await db
      .select()
      .from(schema.hookFiring)
      .where(eq(schema.hookFiring.id, id));

    return row?.state;
  };

  beforeAll(async () => {
    app = await openApp();
    firings = app.get<HookFiringRepository>(HOOK_FIRINGS);
    history = app.get<HookFiringHistoryPort>(HOOK_FIRING_HISTORY);
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
    await expect(firings.add(firing('occurrence_1'))).resolves.toBe(true);
    await expect(firings.add(firing('occurrence_1'))).resolves.toBe(false);
  });

  it('lets only the worker with the lease on a firing write to it', async () => {
    await firings.add(firing('occurrence_2'));
    const first = await claimed();
    const later = at(11 * 60);
    const second = await claimed(later);

    expect(first.id).toBe(second.id);

    await expect(firings.save(first.worked(later))).rejects.toBeInstanceOf(
      HookFiringVersionConflictError,
    );
    await expect(stateOf(first.id)).resolves.toBe('working');

    await firings.save(second.worked(later));

    await expect(stateOf(first.id)).resolves.toBe('done');
    await expect(firings.withId(first.id)).resolves.toMatchObject({
      attempts: 1,
      progress: { kind: 'done', at: later },
    });
  });

  it('purges finished firings once they are old, and nothing still pending', async () => {
    await firings.add(firing('occurrence_3'));
    await firings.add(firing('occurrence_4'));
    const finished = await claimed();

    await firings.save(finished.worked(NOW));

    const old = (await firings.finishedBefore(at(1), 1_000)).filter(
      (each) => each.hookId === hookId,
    );

    expect(old.map((each) => each.id)).toEqual([finished.id]);

    for (const each of old) {
      await firings.save(each.purge(at(31 * 86_400)));
    }

    const left = await db
      .select()
      .from(schema.hookFiring)
      .where(eq(schema.hookFiring.hookId, hookId));

    expect(left.map((each) => each.state)).toEqual(['pending']);
  });

  it('stores the chain of causes a firing came from, and hands it on with the firing itself', async () => {
    const fired = firing('occurrence_5');
    await firings.add(fired);

    const next = await claimed();

    expect(next.cause.description).toBe(OPENED.description);
    expect(next.link.key).toBe(`hook:${hookId}:${OPENED.key}`);
    await expect(
      history
        .chainOf('workspace_1', fired.id)
        .then((chain) => chain?.description),
    ).resolves.toBe(`${OPENED.description} → the hook opened`);
    await expect(history.chainOf('workspace_2', fired.id)).resolves.toBeNull();
  });

  it('counts the earlier firings of a hook for the same change in the last ten minutes, never later ones', async () => {
    await firings.add(firing('occurrence_6a', at(-11 * 60)));
    await firings.add(firing('occurrence_6', at(-30)));
    await firings.add(firing('occurrence_7', at(-20)));
    await firings.add(firing('occurrence_8', at(-10)));
    await firings.add(firing('occurrence_8b', at(0)));
    const oldest = await claimed();
    const first = await claimed();
    const second = await claimed();
    const third = await claimed();

    expect(oldest.occurrence).toBe('occurrence_6a');
    expect(second.occurrence).toBe('occurrence_7');
    await expect(history.recentRepeats(third)).resolves.toBe(2);
    await expect(history.recentRepeats(first)).resolves.toBe(0);
  });

  it('stores what kind of failure ended a firing, and a superseded one apart from a failed one', async () => {
    await firings.add(firing('occurrence_9'));
    await firings.add(firing('occurrence_10'));
    const first = await claimed();
    const second = await claimed();

    await firings.save(
      first.failedWith(
        HookFailure.of('rejected', 'was answered 404'),
        NOW,
        false,
      ),
    );
    await firings.save(
      second.failedWith(
        HookFailure.of('rejected', 'was answered 404'),
        NOW,
        true,
      ),
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

  it('keeps a firing waiting until it is due again', async () => {
    await firings.add(firing('occurrence_11'));
    const working = await claimed();

    await firings.save(working.waitUntil(at(2)));

    await expect(firings.claimNext(at(1))).resolves.toBeNull();
    await expect(claimed(at(2))).resolves.toMatchObject({ id: working.id });
  });
});
