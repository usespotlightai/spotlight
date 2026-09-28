import type { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import type { SealedProvisionSecret } from '@runners/domain/value-objects/sealed-provision-secret.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PROVISION_SECRETS = Symbol('PROVISION_SECRETS');

export interface SecretHolder {
  readonly id: RunnerPoolId;
  readonly workspaceId: WorkspaceId;
}

export interface ProvisionSecretsPort {
  sealed(
    holder: SecretHolder,
    secret: ProvisionSecret,
  ): Promise<SealedProvisionSecret>;

  // Throws ProvisionSecretUnopenableError when this deployment's keys cannot open it.
  opened(
    holder: SecretHolder,
    sealed: SealedProvisionSecret,
  ): Promise<ProvisionSecret>;
}
