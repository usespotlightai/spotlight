import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { WorkspaceSlugTakenError } from '@domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceSlugRegistry } from '@domain/repositories/workspace.repository';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export class WorkspaceRegistration {
  constructor(private readonly slugs: WorkspaceSlugRegistry) {}

  async register(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    owner: UserId;
    firstTeamId: TeamId;
  }): Promise<Workspace> {
    if (await this.slugs.isTaken(input.slug)) {
      throw new WorkspaceSlugTakenError(input.slug.value);
    }

    return Workspace.create(input);
  }
}
