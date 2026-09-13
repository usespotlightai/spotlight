import type { Happened } from '@application/ports/webhook-source.port';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export interface HappeningReactionsPort {
  react(
    workspaceId: WorkspaceId,
    teamId: string,
    happenings: readonly Happened[],
  ): Promise<void>;
}
