import type { HeldSecretsPort } from '@configuration/application/ports/held-secrets.port';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export class NoHeldSecrets implements HeldSecretsPort {
  async held(): Promise<readonly SecretName[]> {
    return [];
  }
}
