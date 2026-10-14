import type { AddTeamMemberCommand } from '@identity/application/commands/add-team-member.command';
import type { TeamAdministration } from '@identity/application/services/team-administration.service';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class AddTeamMemberHandler
  implements CommandHandlerPort<AddTeamMemberCommand, boolean>
{
  constructor(
    private readonly administration: TeamAdministration,
    private readonly teams: TeamRepository,
  ) {}

  async execute(command: AddTeamMemberCommand): Promise<boolean> {
    try {
      const administered = await this.administration.administeredBy(
        command.teamId,
        command.viewerId,
      );

      if (!administered) {
        return false;
      }

      const { team, workspace } = administered;

      await this.teams.save(
        team.memberAdded(UserId.of(command.userId), workspace),
      );

      return true;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
