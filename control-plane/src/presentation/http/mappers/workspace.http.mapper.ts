import type {
  WorkspaceDto,
  WorkspaceListingDto,
} from '@application/dto/workspace.dto';
import {
  TeamResponseDto,
  WorkspaceListingResponseDto,
  WorkspaceResponseDto,
} from '@presentation/http/dto/workspace.response.dto';

export const WorkspaceHttpMapper = {
  toResponse(dto: WorkspaceDto): WorkspaceResponseDto {
    return new WorkspaceResponseDto(
      dto.id,
      dto.name,
      dto.slug,
      dto.teams.map((team) => new TeamResponseDto(team.id, team.name)),
    );
  },

  listingToResponse(dto: WorkspaceListingDto): WorkspaceListingResponseDto {
    return new WorkspaceListingResponseDto(
      dto.id,
      dto.name,
      dto.slug,
      dto.role,
    );
  },
};
