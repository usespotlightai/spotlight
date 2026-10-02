import type { StopSearchCommand } from '@replays/application/commands/stop-search.command';
import type { SearchStoppedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { UnknownSearchError } from '@replays/domain/exceptions/unknown-search.error';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class StopSearchHandler
  implements CommandHandlerPort<StopSearchCommand, SearchStoppedOutcome>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly searches: SearchRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: StopSearchCommand): Promise<SearchStoppedOutcome> {
    try {
      const clearance = await this.access.clearance(
        command.teamId,
        command.actor.principal,
      );
      const seen = await this.access.searchOn(clearance, command.searchId);

      if (!clearance.mayPlan) {
        return forbiddenTo('plan');
      }

      await this.transaction.run(async () => {
        const search = await this.searches.locked(seen.id);

        if (!search) {
          throw new UnknownSearchError(command.searchId);
        }

        await this.searches.save(
          search.stopped(
            this.clock.now(),
            Attribution.of(command.actor, search.workspaceId),
          ),
        );
      });

      return { outcome: 'stopped' };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
