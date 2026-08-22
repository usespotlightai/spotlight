import type {
  WorkspaceDto,
  WorkspaceListingDto,
} from '@application/dto/workspace.dto';
import type {
  WorkspaceDetail,
  WorkspaceListing,
} from '@application/ports/workspace-reader.port';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';

export const WorkspaceMapper = {
  toDto(workspace: Workspace): WorkspaceDto {
    return {
      id: workspace.id.value,
      name: workspace.name.value,
      slug: workspace.slug.value,
      teams: workspace.teams.map((team) => ({
        id: team.id.value,
        name: team.name.value,
      })),
    };
  },

  detailToDto(detail: WorkspaceDetail): WorkspaceDto {
    return {
      id: detail.id,
      name: detail.name,
      slug: detail.slug,
      teams: detail.teams.map((team) => ({ id: team.id, name: team.name })),
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
