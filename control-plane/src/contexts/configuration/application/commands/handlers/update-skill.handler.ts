import type { UpdateSkillCommand } from '@configuration/application/commands/update-skill.command';
import type { SkillCompilerPort } from '@configuration/application/ports/skill-compiler.port';
import { SkillProblems } from '@configuration/application/rendering/skill-problems';
import { SkillDefinitionMovedOnError } from '@configuration/domain/exceptions/skill-definition-moved-on.error';
import { SkillKeyFixedError } from '@configuration/domain/exceptions/skill-key-fixed.error';
import type { SkillDefinitionRepository } from '@configuration/domain/repositories/skill-definition.repository';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class UpdateSkillHandler
  implements CommandHandlerPort<UpdateSkillCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly compiler: SkillCompilerPort,
    private readonly definitions: SkillDefinitionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: UpdateSkillCommand): Promise<ResourceUpdated | null> {
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

      standing.expecting(command.expectedVersion);

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      await this.transaction.run(() =>
        this.definitions.save(
          standing.redefinedAs(
            compiled,
            Attribution.of(command.actor, cleared.workspaceId),
          ),
        ),
      );

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof SkillDefinitionMovedOnError) {
        const current = await this.definitions.withId(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof SkillKeyFixedError) {
        return {
          outcome: 'invalid',
          problems: [SkillProblems.keyFixed(error)],
        };
      }

      rethrowAsFault(error);
    }
  }
}
