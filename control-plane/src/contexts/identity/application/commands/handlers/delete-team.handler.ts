import type { DeleteTeamCommand } from '@identity/application/commands/delete-team.command';
import type { TeamHoldingsPort } from '@identity/application/ports/team-holdings.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { TeamInUseError } from '@identity/domain/exceptions/team-in-use.error';
import { TeamMovedOnError } from '@identity/domain/exceptions/team-moved-on.error';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import { Holdings } from '@identity/domain/value-objects/holdings.vo';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteTeamHandler
  implements CommandHandlerPort<DeleteTeamCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamRepository,
    private readonly holdings: TeamHoldingsPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: DeleteTeamCommand): Promise<ResourceDeleted | null> {
    const id = TeamId.of(command.teamId);

    try {
      const standing = await this.teams.find(id);
      const cleared = standing
        ? await this.access.clearanceIn(
            standing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.configures) {
        return forbiddenTo('configure');
      }

      standing.expecting(command.expectedVersion);

      const held = Holdings.of(await this.holdings.of(id));

      await this.transaction.run(() =>
        this.teams.save(
          standing.disbanded(
            held,
            Attribution.of(command.actor, standing.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof TeamMovedOnError) {
        const current = await this.teams.find(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof TeamInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsFault(error);
    }
  }
}
