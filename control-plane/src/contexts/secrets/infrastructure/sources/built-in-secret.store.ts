import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  SecretReference,
  SecretSourcePort,
} from '@secrets/application/ports/secret-source.port';
import { UnreadableSecretError } from '@secrets/domain/exceptions/unreadable-secret.error';
import { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import {
  DecryptionFailedError,
  decrypt,
  encrypt,
} from '@secrets/infrastructure/crypto/envelope';
import type { WorkspaceKeys } from '@secrets/infrastructure/crypto/workspace-keys';
import { secretValue } from '@secrets/infrastructure/persistence/drizzle/schemas/secret.schema';
import { eq } from 'drizzle-orm';

const aadFor = (secret: SecretReference): string =>
  ['spotlight:secret:v1', secret.workspaceId.value, secret.name.value].join(
    '\u0000',
  );

export class BuiltInSecretStore implements SecretSourcePort {
  constructor(
    private readonly context: DrizzleContext,
    private readonly keys: WorkspaceKeys,
  ) {}

  async store(secret: SecretReference, value: SecretValue): Promise<void> {
    const key = await this.keys.of(secret.workspaceId);
    const ciphertext = encrypt(
      key,
      Buffer.from(value.revealed(), 'utf8'),
      aadFor(secret),
    );

    await this.context.db
      .insert(secretValue)
      .values({ secretId: secret.id.value, ciphertext })
      .onConflictDoUpdate({
        target: secretValue.secretId,
        set: { ciphertext, storedAt: new Date() },
      });
  }

  async read(secret: SecretReference): Promise<SecretValue> {
    const [stored] = await this.context.db
      .select({ ciphertext: secretValue.ciphertext })
      .from(secretValue)
      .where(eq(secretValue.secretId, secret.id.value))
      .limit(1);

    if (!stored) {
      throw new UnreadableSecretError(
        secret.name.value,
        'No value is stored for it.',
      );
    }

    try {
      const key = await this.keys.of(secret.workspaceId);

      return SecretValue.of(
        decrypt(key, stored.ciphertext, aadFor(secret)).toString('utf8'),
      );
    } catch (error) {
      if (error instanceof DecryptionFailedError) {
        throw new UnreadableSecretError(secret.name.value, error.message);
      }

      throw error;
    }
  }

  async delete(secret: SecretReference): Promise<void> {
    await this.context.db
      .delete(secretValue)
      .where(eq(secretValue.secretId, secret.id.value));
  }
}
