import type {
  WorkspaceDetailDto,
  WorkspaceDto,
  WorkspaceListingDto,
} from '@application/dto/workspace.dto';
import type {
  WorkspaceDetail,
  WorkspaceListing,
} from '@application/ports/workspace-reader.port';
import type { Team } from '@domain/aggregates/team.aggregate';
import type { Workspace } from '@domain/aggregates/workspace.aggregate';

export const WorkspaceMapper = {
  /** Its teams are their own aggregates, so whoever has them passes them. */
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

  detailToDto(detail: WorkspaceDetail): WorkspaceDetailDto {
    return {
      id: detail.id,
      name: detail.name,
      slug: detail.slug,
      teams: detail.teams.map((team) => ({ id: team.id, name: team.name })),
      role: detail.role,
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
