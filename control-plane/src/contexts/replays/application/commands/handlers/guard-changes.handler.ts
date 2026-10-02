import type { GuardChangesCommand } from '@replays/application/commands/guard-changes.command';
import type { SetChanged } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class GuardChangesHandler
  implements CommandHandlerPort<GuardChangesCommand, SetChanged>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: GuardChangesCommand): Promise<SetChanged> {
    try {
      const clearance = await this.access.clearance(
        command.teamId,
        command.actor.principal,
      );
      const seen = await this.access.setOn(clearance, command.setId);

      if (!clearance.mayPlan) {
        return forbiddenTo('plan');
      }

      await this.transaction.run(async () => {
        const set = await this.sets.locked(seen.id);

        if (!set) {
          throw new UnknownReplaySetError(command.setId);
        }

        const by = Attribution.of(command.actor, set.workspaceId);

        const changed = command.guards
          ? set.guardingChanges(
              await this.sets.atStation(set.station.stationId),
              by,
            )
          : set.notGuardingChanges(by);

        if (changed !== set) {
          await this.sets.save(changed);
        }
      });

      return { outcome: 'changed' };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
