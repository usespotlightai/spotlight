import type { CreateTeamCommand } from '@identity/application/commands/create-team.command';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import { TeamAlreadyDefinedError } from '@identity/domain/exceptions/team-already-defined.error';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
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
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CreateTeamHandler
  implements CommandHandlerPort<CreateTeamCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: IdentityDefinitionsPort,
    private readonly teams: TeamRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: CreateTeamCommand): Promise<ResourceCreated | null> {
    try {
      const { principal } = command.actor;
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(command.workspaceId),
        principal,
      );

      if (!cleared) {
        return null;
      }

      if (!cleared.configures) {
        return forbiddenTo('configure');
      }

      const compiled = this.definitions.team(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const create: IdempotentCreate = {
        by: principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          team: 'create',
          workspaceId: command.workspaceId,
          definition: command.definition,
        },
      };

      try {
        return await this.transaction.run(() =>
          createdOnce(this.creates, create, async () => {
            const defined = Team.define({
              id: TeamId.of(this.ids.generate()),
              workspaceId: cleared.workspaceId,
              key: compiled.key,
              name: compiled.name,
              openedBy: principal.userId,
              by: Attribution.of(command.actor, cleared.workspaceId),
            });

            await this.teams.add(defined);

            return defined.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof TeamAlreadyDefinedError) {
          return { outcome: 'taken', address: compiled.key.value };
        }

        if (error instanceof NoSuchWorkspaceError) {
          return null;
        }

        throw error;
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
