import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateRunnerPoolCommand } from '@runners/application/commands/runner-resource.commands';
import type { PlatformEgressSettings } from '@runners/application/ports/platform-egress-settings.port';
import type { ProvisionSecretsPort } from '@runners/application/ports/provision-secrets.port';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import { assertKnownEgress } from '@runners/application/services/assert-known-egress';
import { poolAccessInput } from '@runners/application/services/pool-access-input';
import { recordPoolTokenUse } from '@runners/application/services/record-pool-token-use';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import { PoolTokenAlreadyUsedError } from '@runners/domain/exceptions/pool-token-already-used.error';
import { PoolTokenInUseError } from '@runners/domain/exceptions/pool-token-in-use.error';
import { RunnerPoolVersionConflictError } from '@runners/domain/exceptions/runner-pool-version-conflict.error';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { UsedPoolTokensRepository } from '@runners/domain/repositories/used-pool-tokens.repository';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class UpdateRunnerPoolHandler
  implements CommandHandlerPort<UpdateRunnerPoolCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly pools: RunnerPoolRepository,
    private readonly usedTokens: UsedPoolTokensRepository,
    private readonly secrets: ProvisionSecretsPort,
    private readonly egresses: EgressRepository,
    private readonly platform: PlatformEgressSettings | null,
    private readonly tokens: TokenIssuer,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: UpdateRunnerPoolCommand,
  ): Promise<ResourceUpdated | null> {
    const id = RunnerPoolId.of(command.poolId);

    try {
      const existing = await this.pools.find(id);
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
        return forbiddenTo('manage-runners');
      }

      existing.assertVersion(command.expectedVersion);

      const compiled = this.definitions.pool(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const updated = existing.update(
        compiled,
        await poolAccessInput(
          compiled.access,
          existing,
          this.tokens,
          this.secrets,
        ),
        Attribution.of(command.actor, permissions.workspaceId),
      );

      await this.transaction.inTransaction(async () => {
        if (compiled.access.mode === 'push') {
          await assertKnownEgress(
            compiled.access.egress,
            existing.workspaceId,
            this.egresses,
            this.platform,
          );
        }

        await this.pools.save(updated);
        await recordPoolTokenUse(
          this.usedTokens,
          this.pools,
          updated,
          existing,
        );
      });

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof RunnerPoolVersionConflictError) {
        const current = await this.pools.find(id);

        return current
          ? { outcome: 'version-conflict', currentVersion: current.version }
          : null;
      }

      if (
        error instanceof ImmutableFieldError ||
        error instanceof PoolTokenInUseError ||
        error instanceof PoolTokenAlreadyUsedError ||
        error instanceof InvalidRunnerPoolError
      ) {
        return {
          outcome: 'invalid',
          problems: [RunnerProblems.poolInvalid(error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }
}
