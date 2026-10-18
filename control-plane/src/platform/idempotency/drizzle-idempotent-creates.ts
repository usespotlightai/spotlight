import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { idempotentCreate } from '@platform/persistence/drizzle/schemas/idempotency.schema';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
  IdempotentReservation,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type {
  IdempotentLookup,
  IdempotentLookupsPort,
} from '@shared-kernel/application/ports/idempotent-lookups.port';
import { and, eq, type SQL, sql } from 'drizzle-orm';

const RETENTION = '24 hours';

const sortedKeys = (_key: string, value: unknown): unknown =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      )
    : value;

const fingerprintOf = (create: IdempotentCreate): string =>
  createHash('sha256')
    .update(JSON.stringify(create.request ?? null, sortedKeys))
    .digest('hex');

const matching = (create: IdempotentCreate) =>
  and(
    eq(idempotentCreate.scope, create.by),
    eq(idempotentCreate.key, create.key.value),
  );

@Injectable()
export class DrizzleIdempotentCreates
  implements IdempotentCreatesPort, IdempotentLookupsPort
{
  constructor(private readonly context: DrizzleContext) {}

  async lookup(create: IdempotentCreate): Promise<IdempotentLookup> {
    const existing = await this.find(
      and(
        matching(create),
        sql`${idempotentCreate.createdAt} >= now() - ${RETENTION}::interval`,
      ),
    );

    if (!existing) {
      return { kind: 'new' };
    }

    if (existing.fingerprint !== fingerprintOf(create)) {
      return { kind: 'key-reused' };
    }

    return existing.createdId
      ? { kind: 'already-created', createdId: existing.createdId }
      : { kind: 'new' };
  }

  async reserve(create: IdempotentCreate): Promise<IdempotentReservation> {
    const fingerprint = fingerprintOf(create);
    const [reserved] = await this.context.db
      .insert(idempotentCreate)
      .values({ scope: create.by, key: create.key.value, fingerprint })
      .onConflictDoUpdate({
        target: [idempotentCreate.scope, idempotentCreate.key],
        set: { fingerprint, createdId: null, createdAt: sql`now()` },
        setWhere: sql`${idempotentCreate.createdAt} < now() - ${RETENTION}::interval`,
      })
      .returning({ key: idempotentCreate.key });

    if (reserved) {
      return { kind: 'new' };
    }

    const existing = await this.find(matching(create));

    return existing?.fingerprint === fingerprint && existing.createdId
      ? { kind: 'already-created', createdId: existing.createdId }
      : { kind: 'key-reused' };
  }

  async recordCreated(create: IdempotentCreate, id: string): Promise<void> {
    await this.context.db
      .update(idempotentCreate)
      .set({ createdId: id })
      .where(matching(create));
  }

  private async find(where: SQL | undefined) {
    const [row] = await this.context.db
      .select({
        fingerprint: idempotentCreate.fingerprint,
        createdId: idempotentCreate.createdId,
      })
      .from(idempotentCreate)
      .where(where);

    return row;
  }
}
