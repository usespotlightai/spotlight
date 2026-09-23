import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  IDEMPOTENT_CREATES,
  type IdempotentCreate,
  type IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { openApp } from './support/app';
import * as schema from './support/schema';

const settled = <T>(work: Promise<T>, within: number) =>
  Promise.race([
    work.then(() => 'answered' as const),
    new Promise<'waiting'>((resolve) =>
      setTimeout(() => resolve('waiting'), within),
    ),
  ]);

describe('idempotent creates, claimed in the caller’s transaction (e2e)', () => {
  let app: INestApplication;
  let creates: IdempotentCreatesPort;
  let context: DrizzleContext;
  let db: DrizzleDatabase;
  const by = `creates-${randomUUID()}`;

  const create = (request: unknown = { name: 'Linear' }): IdempotentCreate => ({
    by,
    key: IdempotencyKey.of(randomUUID()),
    request,
  });

  const holding = (made: IdempotentCreate, outcome: 'commit' | 'roll back') => {
    let release = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let claimed = () => {};
    const hasClaimed = new Promise<void>((resolve) => {
      claimed = resolve;
    });
    const done = context
      .run(async () => {
        await creates.claim(made);
        await creates.created(made, 'created_first');
        claimed();
        await released;

        if (outcome === 'roll back') {
          throw new Error('the create failed');
        }
      })
      .catch(() => {});

    return { hasClaimed, release, done };
  };

  beforeAll(async () => {
    app = await openApp();
    creates = app.get(IDEMPOTENT_CREATES);
    context = app.get(DrizzleContext);
    db = app.get(DRIZZLE);
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(eq(schema.idempotentCreate.scope, by));
  });

  afterAll(async () => {
    await app.close();
  });

  it('holds a second claim of a key until the first create commits, then replays it', async () => {
    const made = create();
    const first = holding(made, 'commit');

    await first.hasClaimed;

    const second = context.run(() => creates.claim(made));

    expect(await settled(second, 300)).toBe('waiting');

    first.release();
    await first.done;

    expect(await second).toEqual({
      kind: 'replay',
      createdId: 'created_first',
    });
  });

  it('frees the key when the first create rolls back', async () => {
    const made = create();
    const first = holding(made, 'roll back');

    await first.hasClaimed;

    const second = context.run(() => creates.claim(made));

    first.release();
    await first.done;

    expect(await second).toEqual({ kind: 'fresh' });
  });

  it('refuses the key for a different request', async () => {
    const made = create();

    await context.run(async () => {
      await creates.claim(made);
      await creates.created(made, 'created_first');
    });

    expect(
      await creates.claim({ ...made, request: { name: 'Slack' } }),
    ).toEqual({ kind: 'reused' });
  });

  it('forgets a key a day after it was used', async () => {
    const made = create();

    await context.run(async () => {
      await creates.claim(made);
      await creates.created(made, 'created_first');
    });
    await db
      .update(schema.idempotentCreate)
      .set({ createdAt: sql`now() - interval '25 hours'` })
      .where(eq(schema.idempotentCreate.scope, by));

    expect(await creates.claim(made)).toEqual({ kind: 'fresh' });
  });
});
