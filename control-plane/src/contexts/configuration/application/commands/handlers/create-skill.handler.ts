import type { CreateSkillCommand } from '@configuration/application/commands/create-skill.command';
import type { SkillCompilerPort } from '@configuration/application/ports/skill-compiler.port';
import { SkillDefinition } from '@configuration/domain/aggregates/skill-definition.aggregate';
import { SkillAlreadyDefinedError } from '@configuration/domain/exceptions/skill-already-defined.error';
import type { SkillDefinitionRepository } from '@configuration/domain/repositories/skill-definition.repository';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import {
  FORBIDDEN,
  type ResourceCreated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { createdOnce } from '@shared-kernel/application/services/created-once';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';

export class CreateSkillHandler
  implements CommandHandlerPort<CreateSkillCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: SkillCompilerPort,
    private readonly definitions: SkillDefinitionRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: CreateSkillCommand): Promise<ResourceCreated | null> {
    try {
      const cleared = await this.access.clearanceOnTeam(
        command.teamId,
        command.actor.principal,
      );
      if (!cleared) {
        return null;
      }

      if (!cleared.configures) {
        return FORBIDDEN;
      }

      const team = await this.teams.find(cleared.teamId);

      if (!team) {
        return null;
      }

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          skill: 'create',
          teamId: command.teamId,
          definition: command.definition,
        },
      };

      try {
        return await this.transaction.run(() =>
          createdOnce(this.creates, create, async () => {
            const defined = SkillDefinition.define({
              ...compiled,
              id: SkillDefinitionId.of(this.ids.generate()),
              teamId: team.id,
              by: Attribution.of(command.actor, team.workspaceId),
            });

            await this.definitions.save(defined);

            return defined.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof SkillAlreadyDefinedError) {
          return {
            outcome: 'taken',
            address: TeamAddress.of(
              team.key,
              compiled.skill.key.value,
            ).toString(),
          };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
