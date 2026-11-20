import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SECRETS_AWAITING_VALUE = Symbol('SECRETS_AWAITING_VALUE');

export interface SecretsAwaitingValuePort {
  awaitingValueIn(
    workspaceId: WorkspaceId,
    names: readonly SecretName[],
  ): Promise<readonly SecretName[]>;
}
