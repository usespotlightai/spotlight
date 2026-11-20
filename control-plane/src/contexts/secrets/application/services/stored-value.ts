import type { SecretStorePort } from '@secrets/application/ports/secret-store.port';
import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';

export const storedValueOf = async (
  store: SecretStorePort,
  secret: Secret,
): Promise<SecretValue> => {
  secret.assertHoldsValue();

  return store.read(secret);
};
