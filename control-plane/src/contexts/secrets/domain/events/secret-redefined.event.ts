import type { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SecretRedefined implements DomainEvent {
  readonly kind = 'secret.redefined';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly secretId: SecretId,
    readonly secretName: SecretName,
    readonly by: UserId,
    readonly hosts: readonly string[],
  ) {}
}
