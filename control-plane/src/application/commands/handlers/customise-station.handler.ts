import type { CustomiseStationCommand } from '@application/commands/customise-station.command';
import type { StationDto } from '@application/dto/assembly-line.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { AssemblyLineMapper } from '@application/mappers/assembly-line.mapper';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { StandingWork } from '@application/services/standing-work';
import { UnknownAssemblyLineError } from '@domain/exceptions/unknown-assembly-line.error';
import { UnknownStationError } from '@domain/exceptions/unknown-station.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';

const told = <T>(raw: string | null, make: (value: string) => T): T | null =>
  raw === null ? null : make(raw);

export class CustomiseStationHandler
  implements CommandHandlerPort<CustomiseStationCommand, StationDto>
{
  constructor(
    private readonly lines: AssemblyLineRepository,
    private readonly work: StandingWork,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: CustomiseStationCommand): Promise<StationDto> {
    try {
      return await this.customise(command);
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async customise(
    command: CustomiseStationCommand,
  ): Promise<StationDto> {
    const stationId = StationId.of(command.stationId);
    const { name, color, description, harness, agentPrompt } = command.changes;

    return await this.transaction.run(async () => {
      const found = await this.lines.find(AssemblyLineId.of(command.lineId));

      if (!found) {
        throw new UnknownAssemblyLineError(command.lineId);
      }

      let line = found;

      if (name !== undefined) {
        line = line.renameStation(stationId, StationName.of(name));
      }
      if (color !== undefined) {
        line = line.repaintStation(stationId, StationColor.of(color));
      }
      if (description !== undefined) {
        line = line.describeStation(
          stationId,
          told(description, StationDescription.of),
        );
      }
      if (harness !== undefined) {
        line = line.runStationOn(stationId, told(harness, HarnessId.of));
      }
      if (agentPrompt !== undefined) {
        line = line.instructStation(
          stationId,
          told(agentPrompt, AgentPrompt.of),
        );
      }

      await this.lines.save(line);

      const station = line.stationAt(stationId);

      if (!station) {
        throw new UnknownStationError(command.stationId);
      }

      await this.work.takeUp({ line, stationId: station.id });

      return AssemblyLineMapper.stationToDto(station);
    });
  }
}
