import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { idempotentCreate } from '@platform/persistence/drizzle/schemas/idempotency.schema';
import type {
  IdempotentClaim,
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import { and, eq, sql } from 'drizzle-orm';

const KEPT_FOR = '24 hours';

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
export class DrizzleIdempotentCreates implements IdempotentCreatesPort {
  constructor(private readonly context: DrizzleContext) {}

  async claim(create: IdempotentCreate): Promise<IdempotentClaim> {
    const fingerprint = fingerprintOf(create);
    const [claimed] = await this.context.db
      .insert(idempotentCreate)
      .values({ scope: create.by, key: create.key.value, fingerprint })
      .onConflictDoUpdate({
        target: [idempotentCreate.scope, idempotentCreate.key],
        set: { fingerprint, createdId: null, createdAt: sql`now()` },
        setWhere: sql`${idempotentCreate.createdAt} < now() - ${KEPT_FOR}::interval`,
      })
      .returning({ key: idempotentCreate.key });

    if (claimed) {
      return { kind: 'fresh' };
    }

    const [held] = await this.context.db
      .select({
        fingerprint: idempotentCreate.fingerprint,
        createdId: idempotentCreate.createdId,
      })
      .from(idempotentCreate)
      .where(matching(create));

    return held?.fingerprint === fingerprint && held.createdId
      ? { kind: 'replay', createdId: held.createdId }
      : { kind: 'reused' };
  }

  async created(create: IdempotentCreate, id: string): Promise<void> {
    await this.context.db
      .update(idempotentCreate)
      .set({ createdId: id })
      .where(matching(create));
  }
}
