import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';

export const HAPPENING_REACTIONS = Symbol('HAPPENING_REACTIONS');

export interface HappeningReactionsPort {
  react(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happenings: readonly Happened[],
    receivedAs: string | null,
  ): Promise<void>;
}
