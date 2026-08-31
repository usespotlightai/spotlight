import { Team } from '@domain/entities/team.entity';
import { TeamCreated } from '@domain/events/team-created.event';
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
    readonly happened: readonly TeamCreated[],
  ) {}

  static create(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    owner: UserId;
    newId: () => string;
  }): Workspace {
    const firstTeam = Team.create({
      name: TeamName.of(input.name.value),
      owner: input.owner,
      newId: input.newId,
    });

    return new Workspace(
      input.id,
      input.name,
      input.slug,
      [{ userId: input.owner, role: 'owner' }],
      [firstTeam],
      [new TeamCreated(input.id, firstTeam.id)],
    );
  }

  equals(other: Workspace): boolean {
    return this.id.equals(other.id);
  }
}
