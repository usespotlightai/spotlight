import type { StopSearchCommand } from '@replays/application/commands/stop-search.command';
import type { SearchStoppedOutcome } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { UnknownSearchError } from '@replays/domain/exceptions/unknown-search.error';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

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
      const access = await this.access.forTeam(
        command.teamId,
        command.actor.principal,
      );
      const seen = await this.access.searchOn(access, command.searchId);

      if (!access.mayPlan) {
        return forbiddenTo('plan');
      }

      await this.transaction.inTransaction(async () => {
        const search = await this.searches.locked(seen.id);

        if (!search) {
          throw new UnknownSearchError(command.searchId);
        }

        await this.searches.save(
          search.stop(
            this.clock.now(),
            ChangeActor.of(command.actor, search.workspaceId),
          ),
        );
      });

      return { outcome: 'stopped' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
