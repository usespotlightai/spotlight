import type { SetLineReactionsCommand } from '@application/commands/set-line-reactions.command';
import type { AssemblyLineDto } from '@application/dto/assembly-line.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { AssemblyLineMapper } from '@application/mappers/assembly-line.mapper';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { WebhookSources } from '@application/services/webhook-sources.service';
import { UnknownAssemblyLineError } from '@domain/exceptions/unknown-assembly-line.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { Reaction } from '@domain/value-objects/reaction.vo';
import { StationId } from '@domain/value-objects/station-id.vo';

export class SetLineReactionsHandler
  implements CommandHandlerPort<SetLineReactionsCommand, AssemblyLineDto>
{
  constructor(
    private readonly lines: AssemblyLineRepository,
    private readonly sources: WebhookSources,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: SetLineReactionsCommand): Promise<AssemblyLineDto> {
    try {
      return await this.transaction.run(async () => {
        const found = await this.lines.find(AssemblyLineId.of(command.lineId));

        if (!found) {
          throw new UnknownAssemblyLineError(command.lineId);
        }

        // The line refuses a reaction to a word none of its sources raise.
        const line = found.reactsWith(
          command.reactions.map((each) => this.reaction(each)),
          this.sources.happenings.map((each) => each.happening),
        );

        await this.lines.save(line);

        return AssemblyLineMapper.lineToDto(line);
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private reaction(change: {
    happening: string;
    from: string | null;
    to: string;
  }): Reaction {
    return Reaction.of({
      happening: Happening.of(change.happening),
      from: change.from ? StationId.of(change.from) : null,
      to: StationId.of(change.to),
    });
  }
}
