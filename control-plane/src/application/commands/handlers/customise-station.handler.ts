import type { CustomiseStationCommand } from '@application/commands/customise-station.command';
import type { StationDto } from '@application/dto/assembly-line.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { AssemblyLineMapper } from '@application/mappers/assembly-line.mapper';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { StationChanges } from '@domain/entities/station.entity';
import { UnknownAssemblyLineError } from '@domain/exceptions/unknown-assembly-line.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { RunnerPool } from '@domain/value-objects/runner-pool.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';

/** Absent leaves the field alone, null clears it, anything else sets it. */
const given = <T>(
  raw: string | null | undefined,
  make: (value: string) => T,
): T | null | undefined =>
  raw === undefined || raw === null ? raw : make(raw);

export class CustomiseStationHandler
  implements CommandHandlerPort<CustomiseStationCommand, StationDto>
{
  constructor(
    private readonly lines: AssemblyLineRepository,
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
    const changes = this.read(command);

    return await this.transaction.run(async () => {
      const line = await this.lines.find(AssemblyLineId.of(command.lineId));

      if (!line) {
        throw new UnknownAssemblyLineError(command.lineId);
      }

      const customised = line.customiseStation(stationId, changes);

      await this.lines.save(customised);

      return AssemblyLineMapper.stationToDto(customised.stationAt(stationId));
    });
  }

  private read(command: CustomiseStationCommand): StationChanges {
    const { name, description, pool, agentPrompt } = command.changes;

    return {
      ...(name === undefined ? {} : { name: StationName.of(name) }),
      description: given(description, StationDescription.of),
      pool: given(pool, RunnerPool.of),
      agentPrompt: given(agentPrompt, AgentPrompt.of),
    };
  }
}
