import type { CreateWorkspaceWithTeamCommand } from '@identity/application/commands/create-workspace-with-team.command';
import type { WorkspaceDto } from '@identity/application/dto/workspace.dto';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceRegistration } from '@identity/domain/services/workspace-registration';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CreateWorkspaceWithTeamHandler
  implements CommandHandlerPort<CreateWorkspaceWithTeamCommand, WorkspaceDto>
{
  private readonly registration: WorkspaceRegistration;

  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly ids: IdGeneratorPort,
  ) {
    this.registration = new WorkspaceRegistration(workspaces);
  }

  async execute(
    command: CreateWorkspaceWithTeamCommand,
  ): Promise<WorkspaceDto> {
    try {
      const id = WorkspaceId.of(this.ids.generate());
      const firstTeam = {
        id: TeamId.of(this.ids.generate()),
        name: TeamName.of(command.teamName),
      };
      const workspace = await this.registration.register({
        id,
        name: WorkspaceName.of(command.name),
        slug: WorkspaceSlug.of(command.slug),
        firstTeam,
        owner: command.actor.principal.userId,
        by: Attribution.of(command.actor, id),
      });

      await this.workspaces.add(workspace);

      return {
        id: workspace.id.value,
        name: workspace.name.value,
        slug: workspace.slug.value,
        teams: [{ id: firstTeam.id.value, name: firstTeam.name.value }],
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
