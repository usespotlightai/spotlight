import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const FIRST_SEEN = Symbol('INSIGHTS_FIRST_SEEN');

export interface FirstSeenPort {
  onTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
    people: readonly string[],
  ): Promise<ReadonlyMap<string, Date>>;
}
