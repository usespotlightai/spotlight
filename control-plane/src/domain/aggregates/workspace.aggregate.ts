import { Team } from '@domain/entities/team.entity';
import type { FactoryId } from '@domain/value-objects/factory-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import type { WorkspaceRole } from '@domain/value-objects/workspace-role';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export interface WorkspaceMember {
  readonly userId: UserId;
  readonly role: WorkspaceRole;
}

export class Workspace {
  private constructor(
    readonly id: WorkspaceId,
    readonly name: WorkspaceName,
    readonly slug: WorkspaceSlug,
    readonly members: readonly WorkspaceMember[],
    readonly teams: readonly Team[],
  ) {}

  static create(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    owner: UserId;
    firstTeamId: TeamId;
    firstFactoryId: FactoryId;
  }): Workspace {
    const firstTeam = Team.create({
      id: input.firstTeamId,
      name: TeamName.of(input.name.value),
      owner: input.owner,
      factoryId: input.firstFactoryId,
    });

    return new Workspace(
      input.id,
      input.name,
      input.slug,
      [{ userId: input.owner, role: 'owner' }],
      [firstTeam],
    );
  }

  equals(other: Workspace): boolean {
    return this.id.equals(other.id);
  }
}
