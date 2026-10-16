import type { DeleteSkillCommand } from '@configuration/application/commands/delete-skill.command';
import type { StationGifts } from '@configuration/application/services/station-gifts.service';
import { SkillDefinitionVersionConflictError } from '@configuration/domain/exceptions/skill-definition-version-conflict.error';
import { SkillInUseError } from '@configuration/domain/exceptions/skill-in-use.error';
import type { SkillDefinitionRepository } from '@configuration/domain/repositories/skill-definition.repository';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  forbiddenTo,
  type ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class DeleteSkillHandler
  implements CommandHandlerPort<DeleteSkillCommand, ResourceDeleted | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: SkillDefinitionRepository,
    private readonly given: StationGifts,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: DeleteSkillCommand): Promise<ResourceDeleted | null> {
    const id = SkillDefinitionId.of(command.skillId);

    try {
      const standing = await this.definitions.withId(id);
      const cleared = standing
        ? await this.access.clearanceOnTeam(
            standing.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.configures) {
        return forbiddenTo('configure');
      }

      standing.assertVersion(command.expectedVersion);

      const given = await this.given.onTeam(standing.teamId, 'skill');

      await this.transaction.run(() =>
        this.definitions.save(
          standing.retired(
            given,
            Attribution.of(command.actor, cleared.workspaceId),
          ),
        ),
      );

      return { outcome: 'deleted' };
    } catch (error) {
      if (error instanceof SkillDefinitionVersionConflictError) {
        const current = await this.definitions.withId(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (error instanceof SkillInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsFault(error);
    }
  }
}
