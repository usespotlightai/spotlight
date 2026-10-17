import type { CreateWorkspaceTokenTrustCommand } from '@identity/application/commands/workspace-token-trust.commands';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import { TokenTrustAlreadyExistsError } from '@identity/domain/exceptions/token-trust-already-exists.error';
import { TokenTrustBeyondGrantorError } from '@identity/domain/exceptions/token-trust-beyond-grantor.error';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
import { Grantor } from '@identity/domain/value-objects/grantor.vo';
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
import { createdOnce } from '@shared-kernel/application/services/created-once';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export class CreateWorkspaceTokenTrustHandler
  implements
    CommandHandlerPort<CreateWorkspaceTokenTrustCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: IdentityDefinitionsPort,
    private readonly trusts: WorkspaceTokenTrustRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateWorkspaceTokenTrustCommand,
  ): Promise<ResourceCreated | null> {
    try {
      const { principal } = command.actor;
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(command.workspaceId),
        principal,
      );

      if (!permissions) {
        return null;
      }

      if (!permissions.managesTokenTrusts) {
        return forbiddenTo('manage-token-trusts');
      }

      const compiled = this.definitions.workspaceTokenTrust(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const create: IdempotentCreate = {
        by: principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          workspaceTokenTrust: 'create',
          workspaceId: command.workspaceId,
          definition: command.definition,
        },
      };

      try {
        return await this.transaction.inTransaction(() =>
          createdOnce(this.creates, create, async () => {
            const created = WorkspaceTokenTrust.create({
              ...compiled.terms,
              id: WorkspaceTokenTrustId.of(this.ids.generate()),
              workspaceId: permissions.workspaceId,
              createdBy: principal.userId,
              grantor: Grantor.of(principal),
              by: Attribution.of(command.actor, permissions.workspaceId),
            });

            await this.trusts.add(created);

            return created.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof TokenTrustBeyondGrantorError) {
          return forbiddenTo('manage-token-trusts');
        }

        if (error instanceof TokenTrustAlreadyExistsError) {
          return { outcome: 'taken', address: compiled.terms.key.value };
        }

        if (error instanceof NoSuchWorkspaceError) {
          return null;
        }

        throw error;
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
