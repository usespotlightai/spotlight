import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SECRET_STORE = Symbol('SECRET_STORE');

export interface SecretReference {
  readonly workspaceId: WorkspaceId;
  readonly id: SecretId;
  readonly name: SecretName;
}

export interface SecretStorePort {
  read(secret: SecretReference): Promise<SecretValue>;
}
