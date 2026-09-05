import type { DomainEvent } from '@domain/events/domain-event';
import type { Connection } from '@domain/value-objects/connection.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/**
 * A workspace now reaches a host it did not before.
 *
 * Worth saying out loud rather than doing quietly: connecting is what makes
 * a workspace able to be read from and written to, and what should follow
 * from it is not the connecting's business.
 */
export class WorkspaceConnected implements DomainEvent {
  readonly kind = 'workspace.connected';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly connection: Connection,
  ) {}
}
