import type { ReorderStationsCommand } from '@application/commands/reorder-stations.command';
import type { AssemblyLineDto } from '@application/dto/assembly-line.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { AssemblyLineMapper } from '@application/mappers/assembly-line.mapper';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { UnknownAssemblyLineError } from '@domain/exceptions/unknown-assembly-line.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';

export class ReorderStationsHandler
  implements CommandHandlerPort<ReorderStationsCommand, AssemblyLineDto>
{
  constructor(
    private readonly lines: AssemblyLineRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: ReorderStationsCommand): Promise<AssemblyLineDto> {
    try {
      return await this.reorder(command);
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async reorder(
    command: ReorderStationsCommand,
  ): Promise<AssemblyLineDto> {
    return await this.transaction.run(async () => {
      const line = await this.lines.find(AssemblyLineId.of(command.lineId));

      if (!line) {
        throw new UnknownAssemblyLineError(command.lineId);
      }

      const reordered = line.reorderStations(
        command.stationIds.map((each) => StationId.of(each)),
      );

      await this.lines.save(reordered);

      return AssemblyLineMapper.lineToDto(reordered);
    });
  }
}
