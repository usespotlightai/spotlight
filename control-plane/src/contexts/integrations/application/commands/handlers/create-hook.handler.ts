import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateHookCommand } from '@integrations/application/commands/create-hook.command';
import type { HookCompilerPort } from '@integrations/application/ports/hook-compiler.port';
import { HookProblems } from '@integrations/application/rendering/hook-problems';
import type { HookAllowancesService } from '@integrations/application/services/hook-allowances.service';
import { secretGiven } from '@integrations/application/services/signing-secrets';
import { HookDefinition } from '@integrations/domain/aggregates/hook-definition.aggregate';
import { HookAlreadyDefinedError } from '@integrations/domain/exceptions/hook-already-defined.error';
import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { HookAddress } from '@integrations/domain/value-objects/hook-address.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import {
  forbiddenTo,
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

export class CreateHookHandler
  implements CommandHandlerPort<CreateHookCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly compiler: HookCompilerPort,
    private readonly allowances: HookAllowancesService,
    private readonly definitions: HookDefinitionRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: CreateHookCommand): Promise<ResourceCreated | null> {
    try {
      const cleared = await this.access.clearanceOnTeam(
        command.teamId,
        command.actor.principal,
      );
      if (!cleared) {
        return null;
      }

      if (!cleared.configures) {
        return forbiddenTo('configure');
      }

      const team = await this.teams.find(cleared.teamId);

      if (!team) {
        return null;
      }

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const key = compiled.hook.key.value;
      const address = HookAddress.of(team.key, compiled.hook.key);
      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          hook: 'create',
          teamId: command.teamId,
          definition: compiled.document.fields,
        },
      };

      try {
        return await this.transaction.run(() =>
          createdOnce(this.creates, create, async () => {
            const defined = HookDefinition.define({
              ...compiled,
              id: HookDefinitionId.of(this.ids.generate()),
              workspaceId: cleared.workspaceId,
              teamId: cleared.teamId,
              secret: secretGiven(compiled.secret),
              allowances: await this.allowances.onTeam(cleared.teamId),
              by: Attribution.of(command.actor, cleared.workspaceId),
            });

            await this.definitions.save(defined);

            return defined.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof HookAlreadyDefinedError) {
          return { outcome: 'taken', address: address.toString() };
        }

        if (error instanceof InvalidHookError) {
          return {
            outcome: 'invalid',
            problems: [HookProblems.invalid(key, error)],
          };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
