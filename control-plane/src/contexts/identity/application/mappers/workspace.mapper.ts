import type {
  WorkspaceDetailDto,
  WorkspaceDto,
  WorkspaceListingDto,
} from '@identity/application/dto/workspace.dto';
import type { Provisioning } from '@identity/application/ports/workspace-provisioning.port';
import type {
  WorkspaceDetail,
  WorkspaceListing,
} from '@identity/application/ports/workspace-reader.port';
import type { Team } from '@identity/domain/aggregates/team.aggregate';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';

export const WorkspaceMapper = {
  toDto(workspace: Workspace, teams: readonly Team[]): WorkspaceDto {
    return {
      id: workspace.id.value,
      name: workspace.name.value,
      slug: workspace.slug.value,
      teams: teams.map((team) => ({
        id: team.id.value,
        name: team.name.value,
      })),
    };
  },

  detailToDto(
    detail: WorkspaceDetail,
    provisioning: Provisioning,
  ): WorkspaceDetailDto {
    return {
      id: detail.id,
      name: detail.name,
      slug: detail.slug,
      teams: detail.teams.map((team) => ({ id: team.id, name: team.name })),
      role: detail.role,
      provisioning,
    };
  },

  listingToDto(listing: WorkspaceListing): WorkspaceListingDto {
    return {
      id: listing.id,
      name: listing.name,
      slug: listing.slug,
      role: listing.role,
    };
  },
};
