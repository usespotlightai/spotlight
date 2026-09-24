import type {
  SecretReference,
  SecretSourcePort,
} from '@secrets/application/ports/secret-source.port';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';

export class SecretSources {
  constructor(
    private readonly store: SecretSourcePort,
    private readonly awsSecretsManager: SecretSourcePort,
  ) {}

  read(secret: SecretReference): Promise<SecretValue> {
    const source = secret.source.isBuiltIn
      ? this.store
      : this.awsSecretsManager;

    return source.read(secret);
  }
}
