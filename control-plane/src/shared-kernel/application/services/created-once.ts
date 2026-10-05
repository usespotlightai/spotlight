import type { ResourceCreated } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { IdempotentRecallsPort } from '@shared-kernel/application/ports/idempotent-recalls.port';

export const createdEarlier = async (
  recalls: IdempotentRecallsPort,
  create: IdempotentCreate,
): Promise<ResourceCreated | null> => {
  const recalled = await recalls.recall(create);

  if (recalled.kind === 'unseen') {
    return null;
  }

  return recalled.kind === 'replay'
    ? { outcome: 'created', id: recalled.createdId, replayed: true }
    : { outcome: 'key-reused' };
};

export const createdOnce = async (
  creates: IdempotentCreatesPort,
  create: IdempotentCreate,
  make: () => Promise<string>,
): Promise<ResourceCreated> => {
  const claim = await creates.claim(create);

  if (claim.kind !== 'fresh') {
    return claim.kind === 'replay'
      ? { outcome: 'created', id: claim.createdId, replayed: true }
      : { outcome: 'key-reused' };
  }

  const id = await make();

  await creates.created(create, id);

  return { outcome: 'created', id, replayed: false };
};
