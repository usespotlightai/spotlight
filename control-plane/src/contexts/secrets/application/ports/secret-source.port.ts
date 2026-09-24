import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { SecretSource } from '@secrets/domain/value-objects/secret-source.vo';
import type { SecretValue } from '@secrets/domain/value-objects/secret-value.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SECRET_STORE = Symbol('SECRET_STORE');

export const AWS_SECRETS_MANAGER = Symbol('AWS_SECRETS_MANAGER');

export interface SecretReference {
  readonly workspaceId: WorkspaceId;
  readonly id: SecretId;
  readonly name: SecretName;
  readonly source: SecretSource;
}

export interface SecretSourcePort {
  read(secret: SecretReference): Promise<SecretValue>;
}
