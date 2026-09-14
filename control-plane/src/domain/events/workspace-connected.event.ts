import type { DomainEvent } from '@domain/events/domain-event';
import type { Connection } from '@domain/value-objects/connection.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class WorkspaceConnected implements DomainEvent {
  readonly kind = 'workspace.connected';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly connection: Connection,
  ) {}
}
