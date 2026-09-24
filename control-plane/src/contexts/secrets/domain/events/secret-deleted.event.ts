import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SecretDeleted implements DomainEvent {
  readonly kind = 'secret.deleted';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly secretId: SecretId,
    readonly secretName: SecretName,
    readonly by: UserId,
  ) {}
}
