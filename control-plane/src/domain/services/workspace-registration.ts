import { Team } from '@domain/aggregates/team.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { WorkspaceSlugTakenError } from '@domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceSlugRegistry } from '@domain/repositories/workspace.repository';
import type { TeamName } from '@domain/value-objects/team-name.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export class WorkspaceRegistration {
  constructor(private readonly slugs: WorkspaceSlugRegistry) {}

  /**
   * A workspace and the team it opens with, made together because neither is
   * worth having without the other: a workspace with no team has nowhere to
   * put work, and a team with no workspace belongs to nobody.
   */
  async register(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    teamName: TeamName;
    owner: UserId;
    newId: () => string;
  }): Promise<{ workspace: Workspace; firstTeam: Team }> {
    if (await this.slugs.isTaken(input.slug)) {
      throw new WorkspaceSlugTakenError(input.slug.value);
    }

    const firstTeam = Team.open({
      workspaceId: input.id,
      name: input.teamName,
      owner: input.owner,
      newId: input.newId,
    });

    return {
      workspace: Workspace.create({ ...input, firstTeam: firstTeam.id }),
      firstTeam,
    };
  }
}
