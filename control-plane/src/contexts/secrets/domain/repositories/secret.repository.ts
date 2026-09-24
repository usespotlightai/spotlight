import type { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SECRETS = Symbol('SECRETS');

export interface SecretRepository {
  withId(id: SecretId): Promise<Secret | null>;

  named(workspaceId: WorkspaceId, name: SecretName): Promise<Secret | null>;

  inWorkspace(workspaceId: WorkspaceId): Promise<readonly Secret[]>;

  save(secret: Secret): Promise<void>;
}
