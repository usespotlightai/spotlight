import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class HookDeletionDue implements DomainEvent {
  readonly kind = 'integrations.hook-deletion-due';

  constructor(
    readonly id: HookDefinitionId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
