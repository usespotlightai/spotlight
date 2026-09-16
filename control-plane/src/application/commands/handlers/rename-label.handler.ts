import type { RenameLabelCommand } from '@application/commands/rename-label.command';
import type { LabelDto } from '@application/dto/label.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { LabelMapper } from '@application/mappers/label.mapper';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import { UnknownLabelError } from '@domain/exceptions/unknown-label.error';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import type { LabelRepository } from '@domain/repositories/label.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { LabelId } from '@domain/value-objects/label-id.vo';
import { LabelName } from '@domain/value-objects/label-name.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class RenameLabelHandler
  implements CommandHandlerPort<RenameLabelCommand, LabelDto>
{
  constructor(
    private readonly labels: LabelRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(command: RenameLabelCommand): Promise<LabelDto> {
    try {
      const team = await this.teams.find(TeamId.of(command.teamId));

      if (!team?.holds(UserId.of(command.viewerId))) {
        throw new UnknownTaskError(command.teamId);
      }

      const label = await this.labels.find(LabelId.of(command.labelId));

      if (!label?.teamId.equals(TeamId.of(command.teamId))) {
        throw new UnknownLabelError(command.labelId);
      }

      const renamed = label.renamed(LabelName.of(command.name));
      await this.labels.save(renamed);

      return LabelMapper.toDto(renamed);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
