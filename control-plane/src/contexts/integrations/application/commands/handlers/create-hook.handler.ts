import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateHookCommand } from '@integrations/application/commands/create-hook.command';
import type { HookCompilerPort } from '@integrations/application/ports/hook-compiler.port';
import { HookProblems } from '@integrations/application/rendering/hook-problems';
import type { HookAllowancesService } from '@integrations/application/services/hook-allowances.service';
import { signingSecretChange } from '@integrations/application/services/signing-secrets';
import { HookDefinition } from '@integrations/domain/aggregates/hook-definition.aggregate';
import { HookAlreadyExistsError } from '@integrations/domain/exceptions/hook-already-exists.error';
import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { HookAddress } from '@integrations/domain/value-objects/hook-address.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import {
  forbiddenTo,
  type ResourceCreated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { createIdempotently } from '@shared-kernel/application/services/create-idempotently';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
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
      const permissions = await this.access.permissionsOnTeam(
        command.teamId,
        command.actor.principal,
      );
      if (!permissions) {
        return null;
      }

      if (!permissions.configures) {
        return forbiddenTo('configure');
      }

      const team = await this.teams.find(permissions.teamId);

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
        return await this.transaction.inTransaction(() =>
          createIdempotently(this.creates, create, async () => {
            const created = HookDefinition.create({
              ...compiled,
              id: HookDefinitionId.of(this.ids.generate()),
              workspaceId: permissions.workspaceId,
              teamId: permissions.teamId,
              secret: signingSecretChange(compiled.secret),
              allowances: await this.allowances.onTeam(
                permissions.teamId,
                permissions.workspaceId,
              ),
              by: ChangeActor.of(command.actor, permissions.workspaceId),
            });

            await this.definitions.save(created);

            return created.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof HookAlreadyExistsError) {
          return { outcome: 'already-exists', address: address.toString() };
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
      rethrowAsApplicationError(error);
    }
  }
}
