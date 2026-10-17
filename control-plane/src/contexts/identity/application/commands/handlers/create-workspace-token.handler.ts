import type { CreateWorkspaceTokenCommand } from '@identity/application/commands/workspace-token.commands';
import type { WorkspaceTokenCreatedDto } from '@identity/application/dto/workspace-token-resource.dto';
import type { IdentityDefinitionsPort } from '@identity/application/ports/identity-definitions.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { IdentityProblems } from '@identity/application/rendering/identity-problems';
import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';
import { NoSuchWorkspaceError } from '@identity/domain/exceptions/no-such-workspace.error';
import { WorkspaceTokenAlreadyIssuedError } from '@identity/domain/exceptions/workspace-token-already-issued.error';
import type { WorkspaceTokenRepository } from '@identity/domain/repositories/workspace-token.repository';
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
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { createdOnce } from '@shared-kernel/application/services/created-once';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';

const refused = (created: ResourceCreated): WorkspaceTokenCreatedDto => ({
  created,
  token: null,
});

export class CreateWorkspaceTokenHandler
  implements
    CommandHandlerPort<
      CreateWorkspaceTokenCommand,
      WorkspaceTokenCreatedDto | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: IdentityDefinitionsPort,
    private readonly tokens: WorkspaceTokenRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly mint: TokenMintPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateWorkspaceTokenCommand,
  ): Promise<WorkspaceTokenCreatedDto | null> {
    try {
      const { principal } = command.actor;
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(command.workspaceId),
        principal,
      );

      if (!permissions) {
        return null;
      }

      if (!permissions.administers) {
        return refused(forbiddenTo('administer'));
      }

      const compiled = this.definitions.workspaceToken(command.definition);

      if (!compiled.ok) {
        return refused({ outcome: 'invalid', problems: compiled.problems });
      }

      const minted = this.mint.mint();
      const create: IdempotentCreate = {
        by: principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          workspaceToken: 'create',
          workspaceId: command.workspaceId,
          definition: command.definition,
        },
      };

      try {
        const created = await this.transaction.inTransaction(() =>
          createdOnce(this.creates, create, async () => {
            const issued = WorkspaceToken.issue({
              ...compiled.terms,
              id: WorkspaceTokenId.of(this.ids.generate()),
              workspaceId: permissions.workspaceId,
              hash: TokenHash.of(minted.hash),
              issuedBy: principal.userId,
              now: this.clock.now(),
              by: Attribution.of(command.actor, permissions.workspaceId),
            });

            await this.tokens.add(issued);

            return issued.id.value;
          }),
        );

        return {
          created,
          token:
            created.outcome === 'created' && !created.replayed
              ? minted.token
              : null,
        };
      } catch (error) {
        if (error instanceof WorkspaceTokenAlreadyIssuedError) {
          return refused({ outcome: 'taken', address: error.tokenName });
        }

        if (error instanceof InvalidWorkspaceTokenError) {
          return refused({
            outcome: 'invalid',
            problems: [IdentityProblems.tokenRefused(error)],
          });
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
