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
import {
  IDEMPOTENT_LOOKUPS,
  type IdempotentLookupsPort,
} from '@shared-kernel/application/ports/idempotent-lookups.port';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { openApp } from './support/app';
import * as schema from './support/schema';

const stateWithin = <T>(work: Promise<T>, within: number) =>
  Promise.race([
    work.then(() => 'answered' as const),
    new Promise<'waiting'>((resolve) =>
      setTimeout(() => resolve('waiting'), within),
    ),
  ]);

describe('idempotent creates, claimed in the caller’s transaction (e2e)', () => {
  let app: INestApplication;
  let creates: IdempotentCreatesPort;
  let lookups: IdempotentLookupsPort;
  let context: DrizzleContext;
  let db: DrizzleDatabase;
  const by = `creates-${randomUUID()}`;

  const create = (request: unknown = { name: 'Linear' }): IdempotentCreate => ({
    by,
    key: IdempotencyKey.of(randomUUID()),
    request,
  });

  const blocking = (
    made: IdempotentCreate,
    outcome: 'commit' | 'roll back',
  ) => {
    let release = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let claimed = () => {};
    const hasClaimed = new Promise<void>((resolve) => {
      claimed = resolve;
    });
    const done = context
      .inTransaction(async () => {
        await creates.reserve(made);
        await creates.recordCreated(made, 'created_first');
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
    lookups = app.get(IDEMPOTENT_LOOKUPS);
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

  it('blocks a second claim of a key until the first create commits, then replays it', async () => {
    const made = create();
    const first = blocking(made, 'commit');

    await first.hasClaimed;

    const second = context.inTransaction(() => creates.reserve(made));

    expect(await stateWithin(second, 300)).toBe('waiting');

    first.release();
    await first.done;

    expect(await second).toEqual({
      kind: 'already-created',
      createdId: 'created_first',
    });
  });

  it('frees the key when the first create rolls back', async () => {
    const made = create();
    const first = blocking(made, 'roll back');

    await first.hasClaimed;

    const second = context.inTransaction(() => creates.reserve(made));

    first.release();
    await first.done;

    expect(await second).toEqual({ kind: 'new' });
  });

  it('rejects the key for a different request', async () => {
    const made = create();

    await context.inTransaction(async () => {
      await creates.reserve(made);
      await creates.recordCreated(made, 'created_first');
    });

    expect(
      await creates.reserve({ ...made, request: { name: 'Slack' } }),
    ).toEqual({ kind: 'key-reused' });
  });

  it('purges a key a day after it was used', async () => {
    const made = create();

    await context.inTransaction(async () => {
      await creates.reserve(made);
      await creates.recordCreated(made, 'created_first');
    });
    await db
      .update(schema.idempotentCreate)
      .set({ createdAt: sql`now() - interval '25 hours'` })
      .where(eq(schema.idempotentCreate.scope, by));

    expect(await creates.reserve(made)).toEqual({ kind: 'new' });
  });

  it('looks up what a key created without reserving it', async () => {
    const made = create();

    expect(await lookups.lookup(made)).toEqual({ kind: 'new' });

    await context.inTransaction(async () => {
      await creates.reserve(made);
      await creates.recordCreated(made, 'created_first');
    });

    expect(await lookups.lookup(made)).toEqual({
      kind: 'already-created',
      createdId: 'created_first',
    });
    expect(
      await lookups.lookup({ ...made, request: { name: 'Slack' } }),
    ).toEqual({ kind: 'key-reused' });
  });

  it('finds nothing for a key still being created, or one a day old', async () => {
    const made = create();
    const first = blocking(made, 'commit');

    await first.hasClaimed;

    expect(await lookups.lookup(made)).toEqual({ kind: 'new' });

    first.release();
    await first.done;
    await db
      .update(schema.idempotentCreate)
      .set({ createdAt: sql`now() - interval '25 hours'` })
      .where(eq(schema.idempotentCreate.scope, by));

    expect(await lookups.lookup(made)).toEqual({ kind: 'new' });
  });
});
