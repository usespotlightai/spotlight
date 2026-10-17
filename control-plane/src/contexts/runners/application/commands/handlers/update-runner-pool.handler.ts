import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateRunnerPoolCommand } from '@runners/application/commands/runner-resource.commands';
import type { PlatformEgressSettings } from '@runners/application/ports/platform-egress-settings.port';
import type { ProvisionSecretsPort } from '@runners/application/ports/provision-secrets.port';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import { assertKnownEgress } from '@runners/application/services/assert-known-egress';
import { givePoolToken } from '@runners/application/services/give-pool-token';
import { givenAccess } from '@runners/application/services/pool-access-given';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import { PoolTokenSpentError } from '@runners/domain/exceptions/pool-token-spent.error';
import { PoolTokenTakenError } from '@runners/domain/exceptions/pool-token-taken.error';
import { RunnerPoolFixedError } from '@runners/domain/exceptions/runner-pool-fixed.error';
import { RunnerPoolVersionConflictError } from '@runners/domain/exceptions/runner-pool-version-conflict.error';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { GivenPoolTokensRepository } from '@runners/domain/repositories/given-pool-tokens.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import {
  forbiddenTo,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class UpdateRunnerPoolHandler
  implements CommandHandlerPort<UpdateRunnerPoolCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly pools: RunnerPoolRepository,
    private readonly given: GivenPoolTokensRepository,
    private readonly secrets: ProvisionSecretsPort,
    private readonly egresses: EgressRepository,
    private readonly platform: PlatformEgressSettings | null,
    private readonly tokens: TokenMintPort,
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

      const redefined = existing.redefinedAs(
        compiled,
        await givenAccess(compiled.access, existing, this.tokens, this.secrets),
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

        await this.pools.save(redefined);
        await givePoolToken(this.given, this.pools, redefined, existing);
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
        error instanceof RunnerPoolFixedError ||
        error instanceof PoolTokenTakenError ||
        error instanceof PoolTokenSpentError ||
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
