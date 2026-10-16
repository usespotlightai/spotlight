import type {
  WorkspaceDetailDto,
  WorkspaceDto,
  WorkspaceListingDto,
} from '@identity/application/dto/workspace.dto';
import {
  CreatedWorkspaceResponseDto,
  TeamResponseDto,
  WorkspaceListingResponseDto,
  WorkspaceResponseDto,
} from '@identity/presentation/http/dto/workspace.response.dto';

const teamsOf = (dto: WorkspaceDto): TeamResponseDto[] =>
  dto.teams.map((team) => new TeamResponseDto(team.id, team.name));

export const WorkspaceHttpMapper = {
  createdToResponse(dto: WorkspaceDto): CreatedWorkspaceResponseDto {
    return new CreatedWorkspaceResponseDto(
      dto.id,
      dto.name,
      dto.slug,
      teamsOf(dto),
    );
  },

  toResponse(dto: WorkspaceDetailDto): WorkspaceResponseDto {
    return new WorkspaceResponseDto(
      dto.id,
      dto.name,
      dto.slug,
      teamsOf(dto),
      dto.role,
      dto.provisioning,
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
