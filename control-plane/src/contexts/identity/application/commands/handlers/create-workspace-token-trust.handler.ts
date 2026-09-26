import type { CreateWorkspaceTokenTrustCommand } from '@identity/application/commands/workspace-token-trust.commands';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { WorkspaceTokenTrust } from '@identity/domain/aggregates/workspace-token-trust.aggregate';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import { TokenTrustAlreadyDefinedError } from '@identity/domain/exceptions/token-trust-already-defined.error';
import { TokenTrustBeyondGrantorError } from '@identity/domain/exceptions/token-trust-beyond-grantor.error';
import type { WorkspaceTokenTrustRepository } from '@identity/domain/repositories/workspace-token-trust.repository';
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
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(command.workspaceId),
        principal,
      );

      if (!cleared) {
        return null;
      }

      if (!cleared.managesTokenTrusts) {
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
        return await this.transaction.run(() =>
          createdOnce(this.creates, create, async () => {
            const defined = WorkspaceTokenTrust.define({
              ...compiled.terms,
              id: WorkspaceTokenTrustId.of(this.ids.generate()),
              workspaceId: cleared.workspaceId,
              definedBy: principal.userId,
              grantor: principal.kind === 'token' ? principal.scopes : null,
              by: Attribution.of(command.actor, cleared.workspaceId),
            });

            await this.trusts.add(defined);

            return defined.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof TokenTrustBeyondGrantorError) {
          return forbiddenTo('manage-token-trusts');
        }

        if (error instanceof TokenTrustAlreadyDefinedError) {
          return { outcome: 'taken', address: compiled.terms.key.value };
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
