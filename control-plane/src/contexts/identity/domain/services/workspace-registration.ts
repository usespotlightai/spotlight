import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceSlugTakenError } from '@identity/domain/exceptions/workspace-slug-taken.error';
import type { WorkspaceSlugRegistry } from '@identity/domain/repositories/workspace.repository';
import type { TeamName } from '@identity/domain/value-objects/team-name.vo';
import type { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import type { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceRegistration {
  constructor(private readonly slugs: WorkspaceSlugRegistry) {}

  async register(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    firstTeam?: { id: TeamId; name: TeamName };
    owner: UserId;
    by: Attribution;
  }): Promise<Workspace> {
    if (await this.slugs.isTaken(input.slug)) {
      throw new WorkspaceSlugTakenError(input.slug.value);
    }

    return Workspace.create(input);
  }
}
