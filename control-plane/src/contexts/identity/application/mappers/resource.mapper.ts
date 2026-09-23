import type { TeamResourceDto } from '@identity/application/dto/team-resource.dto';
import type { WorkspaceResourceDto } from '@identity/application/dto/workspace-resource.dto';
import type {
  KeptTeam,
  KeptWorkspace,
} from '@identity/application/ports/identity-resources.port';

export const ResourceMapper = {
  workspace(workspace: KeptWorkspace): WorkspaceResourceDto {
    return {
      id: workspace.id.value,
      version: workspace.version,
      address: workspace.slug,
      name: workspace.name,
      slug: workspace.slug,
      warnings: [],
    };
  },

  team(team: KeptTeam): TeamResourceDto {
    return {
      id: team.id.value,
      version: team.version,
      address: team.key,
      workspaceId: team.workspaceId.value,
      key: team.key,
      name: team.name,
      warnings: [],
    };
  },
};
