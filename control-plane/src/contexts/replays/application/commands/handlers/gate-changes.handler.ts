import type { GateChangesCommand } from '@replays/application/commands/gate-changes.command';
import type { SetChanged } from '@replays/application/dto/replay-outcomes.dto';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { UnknownReplaySetError } from '@replays/domain/exceptions/unknown-replay-set.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class GateChangesHandler
  implements CommandHandlerPort<GateChangesCommand, SetChanged>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: GateChangesCommand): Promise<SetChanged> {
    try {
      const access = await this.access.forTeam(
        command.teamId,
        command.actor.principal,
      );
      const seen = await this.access.setOn(access, command.setId);

      if (!access.mayPlan) {
        return forbiddenTo('plan');
      }

      await this.transaction.inTransaction(async () => {
        const set = await this.sets.locked(seen.id);

        if (!set) {
          throw new UnknownReplaySetError(command.setId);
        }

        const by = Attribution.of(command.actor, set.workspaceId);

        const changed = command.gates
          ? set.gatingChanges(
              await this.sets.atStation(set.station.stationId),
              by,
            )
          : set.notGatingChanges(by);

        if (changed !== set) {
          await this.sets.save(changed);
        }
      });

      return { outcome: 'changed' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
