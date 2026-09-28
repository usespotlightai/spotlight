import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class HookAbandonmentDue implements DomainEvent {
  readonly kind = 'integrations.hook-abandonment-due';

  constructor(
    readonly id: HookDefinitionId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
