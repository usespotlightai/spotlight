import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateEgressCommand } from '@runners/application/commands/runner-resource.commands';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import { recordEgressTokenUse } from '@runners/application/services/record-egress-token-use';
import { EgressTokenAlreadyUsedError } from '@runners/domain/exceptions/egress-token-already-used.error';
import { EgressTokenInUseError } from '@runners/domain/exceptions/egress-token-in-use.error';
import { EgressVersionConflictError } from '@runners/domain/exceptions/egress-version-conflict.error';
import { InvalidEgressError } from '@runners/domain/exceptions/invalid-egress.error';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { UsedEgressTokensRepository } from '@runners/domain/repositories/used-egress-tokens.repository';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class UpdateEgressHandler
  implements CommandHandlerPort<UpdateEgressCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly egresses: EgressRepository,
    private readonly usedTokens: UsedEgressTokensRepository,
    private readonly tokens: TokenIssuer,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: UpdateEgressCommand): Promise<ResourceUpdated | null> {
    const id = EgressId.of(command.egressId);

    try {
      const existing = await this.egresses.find(id);
      const permissions = existing
        ? await this.access.permissionsIn(
            existing.workspaceId,
            command.actor.principal,
          )
        : null;

      if (!existing || !permissions) {
        return null;
      }

      if (!permissions.managesRunners) {
        return forbiddenTo('runners');
      }

      existing.assertVersion(command.expectedVersion);

      const compiled = this.definitions.egress(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const updated = existing.update(
        compiled,
        {
          tokenHash: compiled.token
            ? TokenHash.of(this.tokens.hash(compiled.token.revealed()))
            : null,
          tokenVersion: compiled.tokenVersion,
        },
        ChangeActor.of(command.actor, permissions.workspaceId),
      );

      await this.transaction.inTransaction(async () => {
        await this.egresses.save(updated);
        await recordEgressTokenUse(
          this.usedTokens,
          this.egresses,
          updated,
          existing,
        );
      });

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof EgressVersionConflictError) {
        const current = await this.egresses.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (
        error instanceof ImmutableFieldError ||
        error instanceof EgressTokenInUseError ||
        error instanceof EgressTokenAlreadyUsedError ||
        error instanceof InvalidEgressError
      ) {
        return {
          outcome: 'invalid',
          problems: [RunnerProblems.egressInvalid(error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }
}
