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
  #raised: TeamCreated[] = [];

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
    newId: () => string;
  }): Workspace {
    const firstTeam = Team.create({
      name: TeamName.of(input.name.value),
      owner: input.owner,
      newId: input.newId,
    });

    const workspace = new Workspace(
      input.id,
      input.name,
      input.slug,
      [{ userId: input.owner, role: 'owner' }],
      [firstTeam],
    );

    workspace.#raised.push(new TeamCreated(input.id, firstTeam.id));

    return workspace;
  }

  pullEvents(): readonly TeamCreated[] {
    const raised = this.#raised;
    this.#raised = [];
    return raised;
  }

  equals(other: Workspace): boolean {
    return this.id.equals(other.id);
  }
}
