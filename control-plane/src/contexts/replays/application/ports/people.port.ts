import type { Membership } from '@replays/domain/services/team-access';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const PEOPLE = Symbol('REPLAYS_PEOPLE');

export interface PeoplePort {
  membershipOn(
    teamId: string,
    principal: Principal,
  ): Promise<Membership | null>;

  teamKey(teamId: TeamId): Promise<string | null>;

  workspaceSlug(workspaceId: WorkspaceId): Promise<string | null>;

  readableTeams(
    workspaceId: string,
    principal: Principal,
  ): Promise<readonly ReadableTeam[] | null>;
}

export interface ReadableTeam {
  readonly teamId: TeamId;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
}
