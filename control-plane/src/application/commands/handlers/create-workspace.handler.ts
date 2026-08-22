import type { CreateWorkspaceCommand } from '@application/commands/create-workspace.command';
import type { WorkspaceDto } from '@application/dto/workspace.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { WorkspaceMapper } from '@application/mappers/workspace.mapper';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { WorkspaceRegistration } from '@domain/services/workspace-registration';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export class CreateWorkspaceHandler
  implements CommandHandlerPort<CreateWorkspaceCommand, WorkspaceDto>
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(command: CreateWorkspaceCommand): Promise<WorkspaceDto> {
    try {
      return await this.createWorkspace(command);
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async createWorkspace(
    command: CreateWorkspaceCommand,
  ): Promise<WorkspaceDto> {
    const workspace = await WorkspaceRegistration.register(
      {
        id: WorkspaceId.of(this.ids.generate()),
        name: WorkspaceName.of(command.name),
        slug: WorkspaceSlug.of(command.slug),
        owner: UserId.of(command.ownerId),
        firstTeamId: TeamId.of(this.ids.generate()),
      },
      this.workspaces,
    );

    await this.workspaces.add(workspace);

    return WorkspaceMapper.toDto(workspace);
  }
}
