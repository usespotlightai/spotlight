import type { EncryptedProvisionSecret } from '@runners/domain/value-objects/encrypted-provision-secret.vo';
import type { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PROVISION_SECRETS = Symbol('PROVISION_SECRETS');

export interface SecretHolder {
  readonly id: RunnerPoolId;
  readonly workspaceId: WorkspaceId;
}

export interface ProvisionSecretsPort {
  encrypt(
    holder: SecretHolder,
    secret: ProvisionSecret,
  ): Promise<EncryptedProvisionSecret>;

  // Throws ProvisionSecretDecryptionFailedError when the keys of this deployment cannot decrypt it.
  decrypt(
    holder: SecretHolder,
    ciphertext: EncryptedProvisionSecret,
  ): Promise<ProvisionSecret>;
}
