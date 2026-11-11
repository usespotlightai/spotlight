import type {
  WorkspaceDetailDto,
  WorkspaceListingDto,
} from '@identity/application/dto/workspace.dto';
import type {
  WorkspaceDetail,
  WorkspaceListing,
} from '@identity/application/ports/workspace-reader.port';

export const WorkspaceMapper = {
  detailToDto(detail: WorkspaceDetail): WorkspaceDetailDto {
    return {
      id: detail.id,
      name: detail.name,
      slug: detail.slug,
      teams: detail.teams.map((team) => ({ id: team.id, name: team.name })),
      role: detail.role,
      setupStatus: detail.setupStatus,
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
