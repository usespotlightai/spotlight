import type { CreateOidcTrustCommand } from '@identity/application/commands/oidc-trust.commands';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { OidcTrust } from '@identity/domain/aggregates/oidc-trust.aggregate';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import { OidcTrustAlreadyExistsError } from '@identity/domain/exceptions/oidc-trust-already-exists.error';
import { ScopesExceedCallerError } from '@identity/domain/exceptions/scopes-exceed-caller.error';
import type { OidcTrustRepository } from '@identity/domain/repositories/oidc-trust.repository';
import { ScopeCeiling } from '@identity/domain/value-objects/scope-ceiling.vo';
import {
  forbiddenTo,
  type ResourceCreated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
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
import { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CreateOidcTrustHandler
  implements CommandHandlerPort<CreateOidcTrustCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: IdentityDefinitionsPort,
    private readonly trusts: OidcTrustRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateOidcTrustCommand,
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

      if (!permissions.managesOidcTrusts) {
        return forbiddenTo('trusts');
      }

      const compiled = this.definitions.oidcTrust(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const create: IdempotentCreate = {
        by: principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          oidcTrust: 'create',
          workspaceId: command.workspaceId,
          definition: command.definition,
        },
      };

      try {
        return await this.transaction.inTransaction(() =>
          createIdempotently(this.creates, create, async () => {
            const created = OidcTrust.create({
              ...compiled.spec,
              id: OidcTrustId.of(this.ids.generate()),
              workspaceId: permissions.workspaceId,
              createdBy: principal.userId,
              scopeCeiling: ScopeCeiling.of(principal),
              by: ChangeActor.of(command.actor, permissions.workspaceId),
              now: this.clock.now(),
            });

            await this.trusts.add(created);

            return created.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof ScopesExceedCallerError) {
          return forbiddenTo('trusts');
        }

        if (error instanceof OidcTrustAlreadyExistsError) {
          return {
            outcome: 'already-exists',
            address: compiled.spec.key.value,
          };
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
