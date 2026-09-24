import type { DeleteTeamCommand } from '@identity/application/commands/delete-team.command';
import type { TeamHoldingsPort } from '@identity/application/ports/team-holdings.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { TeamInUseError } from '@identity/domain/exceptions/team-in-use.error';
import { TeamMovedOnError } from '@identity/domain/exceptions/team-moved-on.error';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import { Holdings } from '@identity/domain/value-objects/holdings.vo';
import {
  FORBIDDEN,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

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
      const membership = standing
        ? await this.access.inWorkspaceWithId(
            standing.workspaceId,
            UserId.of(command.requesterId),
          )
        : null;

      if (!standing || !membership) {
        return null;
      }

      if (!membership.administers) {
        return FORBIDDEN;
      }

      standing.expecting(command.expectedVersion);

      const held = Holdings.of(await this.holdings.of(id));

      await this.transaction.run(() =>
        this.teams.save(standing.disbanded(held)),
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
