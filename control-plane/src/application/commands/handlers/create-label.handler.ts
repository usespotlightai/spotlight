import type { CreateLabelCommand } from '@application/commands/create-label.command';
import type { LabelDto } from '@application/dto/label.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { LabelMapper } from '@application/mappers/label.mapper';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import { Label } from '@domain/aggregates/label.aggregate';
import type { LabelRepository } from '@domain/repositories/label.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { UnknownTaskError } from '@domain/exceptions/unknown-task.error';
import { LabelColour } from '@domain/value-objects/label-colour.vo';
import { LabelId } from '@domain/value-objects/label-id.vo';
import { LabelName } from '@domain/value-objects/label-name.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class CreateLabelHandler
  implements CommandHandlerPort<CreateLabelCommand, LabelDto>
{
  constructor(
    private readonly labels: LabelRepository,
    private readonly teams: TeamRepository,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(command: CreateLabelCommand): Promise<LabelDto> {
    try {
      const team = await this.teams.find(TeamId.of(command.teamId));

      if (!team?.holds(UserId.of(command.viewerId))) {
        throw new UnknownTaskError(command.teamId);
      }

      const label = Label.add({
        id: LabelId.of(this.ids.generate()),
        teamId: TeamId.of(command.teamId),
        name: LabelName.of(command.name),
        colour: LabelColour.of(command.colour),
      });

      await this.labels.add(label);

      return LabelMapper.toDto(label);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
