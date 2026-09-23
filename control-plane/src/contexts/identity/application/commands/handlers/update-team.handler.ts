import type { UpdateTeamCommand } from '@identity/application/commands/update-team.command';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { IdentityProblems } from '@identity/application/rendering/identity-problems';
import { TeamKeyFixedError } from '@identity/domain/exceptions/team-key-fixed.error';
import { TeamMovedOnError } from '@identity/domain/exceptions/team-moved-on.error';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { ResourceUpdated } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class UpdateTeamHandler
  implements CommandHandlerPort<UpdateTeamCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: IdentityDefinitionsPort,
    private readonly teams: TeamRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: UpdateTeamCommand): Promise<ResourceUpdated | null> {
    const id = TeamId.of(command.teamId);

    try {
      const standing = await this.teams.find(id);
      const membership = standing
        ? await this.access.inWorkspaceWithId(
            standing.workspaceId,
            UserId.of(command.requesterId),
          )
        : null;

      if (!standing || !membership?.administers) {
        return null;
      }

      standing.expecting(command.expectedVersion);

      const compiled = this.definitions.team(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      await this.transaction.run(() =>
        this.teams.save(standing.redefinedAs(compiled)),
      );

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof TeamMovedOnError) {
        const current = await this.teams.find(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof TeamKeyFixedError) {
        return {
          outcome: 'invalid',
          problems: [IdentityProblems.keyFixed(error)],
        };
      }

      rethrowAsFault(error);
    }
  }
}
