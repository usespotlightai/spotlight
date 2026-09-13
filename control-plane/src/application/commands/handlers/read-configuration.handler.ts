import type { ReadConfigurationCommand } from '@application/commands/read-configuration.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type {
  Read,
  ReadConfiguration,
} from '@application/services/read-configuration.service';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export class ReadConfigurationHandler
  implements CommandHandlerPort<ReadConfigurationCommand, Read | null>
{
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: WorkspaceReaderPort,
    private readonly teams: TeamRepository,
    private readonly reading: ReadConfiguration,
  ) {}

  async execute(command: ReadConfigurationCommand): Promise<Read | null> {
    try {
      const team = await this.members.findTeamForMember(
        command.teamId,
        UserId.of(command.viewerId),
      );

      if (!team) {
        return null;
      }

      const workspace = await this.workspaces.findBySlug(
        WorkspaceSlug.of(team.slug),
      );

      const held = await this.teams.find(TeamId.of(command.teamId));

      return workspace && held
        ? await this.reading.read(workspace, held)
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
