import type { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class IntegrationDeletionDue implements DomainEvent {
  readonly kind = 'integrations.integration-deletion-due';

  constructor(
    readonly id: IntegrationDefinitionId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
