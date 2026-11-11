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
      avatarDigest: detail.avatarDigest,
      teams: detail.teams.map((team) => ({
        id: team.id,
        name: team.name,
        avatarDigest: team.avatarDigest,
      })),
      role: detail.role,
      setupStatus: detail.setupStatus,
    };
  },

  listingToDto(listing: WorkspaceListing): WorkspaceListingDto {
    return {
      id: listing.id,
      name: listing.name,
      slug: listing.slug,
      avatarDigest: listing.avatarDigest,
      role: listing.role,
    };
  },
};
