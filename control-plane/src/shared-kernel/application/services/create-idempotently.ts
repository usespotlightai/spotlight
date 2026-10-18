import type { ResourceCreated } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { IdempotentLookupsPort } from '@shared-kernel/application/ports/idempotent-lookups.port';

export const lookupIdempotentCreate = async (
  lookups: IdempotentLookupsPort,
  create: IdempotentCreate,
): Promise<ResourceCreated | null> => {
  const lookup = await lookups.lookup(create);

  if (lookup.kind === 'new') {
    return null;
  }

  return lookup.kind === 'already-created'
    ? { outcome: 'created', id: lookup.createdId, replayed: true }
    : { outcome: 'idempotency-key-reused' };
};

export const createIdempotently = async (
  creates: IdempotentCreatesPort,
  create: IdempotentCreate,
  make: () => Promise<string>,
): Promise<ResourceCreated> => {
  const reservation = await creates.reserve(create);

  if (reservation.kind !== 'new') {
    return reservation.kind === 'already-created'
      ? { outcome: 'created', id: reservation.createdId, replayed: true }
      : { outcome: 'idempotency-key-reused' };
  }

  const id = await make();

  await creates.recordCreated(create, id);

  return { outcome: 'created', id, replayed: false };
};
