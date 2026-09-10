import type { Happened } from '@application/ports/webhook-source.port';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/**
 * What a trigger hands the board: the words it read, for the board to make of
 * them what its lines say. The seam a trigger reaches the board through, so a
 * poll living in infrastructure need not know how a word becomes a task.
 */
export interface HappeningReactionsPort {
  react(
    workspaceId: WorkspaceId,
    teamId: string,
    happenings: readonly Happened[],
  ): Promise<void>;
}
