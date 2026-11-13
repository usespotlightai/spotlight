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
import {
  teamAvatarUrl,
  workspaceAvatarUrl,
} from '@identity/presentation/http/mappers/avatar-url';

const teamsOf = (dto: WorkspaceDto): TeamResponseDto[] =>
  dto.teams.map((team) => new TeamResponseDto(team.id, team.name, null));

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
      dto.avatarDigest && workspaceAvatarUrl(dto.slug, dto.avatarDigest),
      dto.teams.map(
        (team) =>
          new TeamResponseDto(
            team.id,
            team.name,
            team.avatarDigest && teamAvatarUrl(team.id, team.avatarDigest),
          ),
      ),
      dto.role,
      dto.setupStatus,
    );
  },

  listingToResponse(dto: WorkspaceListingDto): WorkspaceListingResponseDto {
    return new WorkspaceListingResponseDto(
      dto.id,
      dto.name,
      dto.slug,
      dto.avatarDigest && workspaceAvatarUrl(dto.slug, dto.avatarDigest),
      dto.role,
    );
  },
};
