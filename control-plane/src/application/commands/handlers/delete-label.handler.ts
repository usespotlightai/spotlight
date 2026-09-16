import type { DeleteLabelCommand } from '@application/commands/delete-label.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import { UnknownLabelError } from '@domain/exceptions/unknown-label.error';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { LabelRepository } from '@domain/repositories/label.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { LabelId } from '@domain/value-objects/label-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class DeleteLabelHandler
  implements CommandHandlerPort<DeleteLabelCommand, void>
{
  constructor(
    private readonly labels: LabelRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(command: DeleteLabelCommand): Promise<void> {
    try {
      const team = await this.teams.find(TeamId.of(command.teamId));

      if (!team?.holds(UserId.of(command.viewerId))) {
        throw new UnknownTaskError(command.teamId);
      }

      const label = await this.labels.find(LabelId.of(command.labelId));

      if (!label?.teamId.equals(TeamId.of(command.teamId))) {
        throw new UnknownLabelError(command.labelId);
      }

      await this.labels.remove(LabelId.of(command.labelId));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
