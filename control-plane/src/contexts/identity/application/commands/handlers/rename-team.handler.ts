import type { RenameTeamCommand } from '@identity/application/commands/rename-team.command';
import type { TeamAdministration } from '@identity/application/services/team-administration.service';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class RenameTeamHandler
  implements CommandHandlerPort<RenameTeamCommand, boolean>
{
  constructor(
    private readonly authorization: TeamAdministration,
    private readonly teams: TeamRepository,
  ) {}

  async execute(command: RenameTeamCommand): Promise<boolean> {
    try {
      const administered = await this.authorization.administeredBy(
        command.teamId,
        command.viewerId,
      );

      if (!administered) {
        return false;
      }

      await this.teams.save(
        administered.team.renamedTo(TeamName.of(command.name)),
      );

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
