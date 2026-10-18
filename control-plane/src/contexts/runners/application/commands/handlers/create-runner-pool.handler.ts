import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateRunnerPoolCommand } from '@runners/application/commands/runner-resource.commands';
import type { RunnerPoolCreatedDto } from '@runners/application/dto/runner-resource.dto';
import type { PlatformEgressSettings } from '@runners/application/ports/platform-egress-settings.port';
import type { ProvisionSecretsPort } from '@runners/application/ports/provision-secrets.port';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import { assertKnownEgress } from '@runners/application/services/assert-known-egress';
import {
  issuedTo,
  poolAccessInput,
} from '@runners/application/services/pool-access-input';
import { recordPoolTokenUse } from '@runners/application/services/record-pool-token-use';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import { PoolTokenAlreadyUsedError } from '@runners/domain/exceptions/pool-token-already-used.error';
import { PoolTokenInUseError } from '@runners/domain/exceptions/pool-token-in-use.error';
import { RunnerPoolAlreadyExistsError } from '@runners/domain/exceptions/runner-pool-already-exists.error';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { UsedPoolTokensRepository } from '@runners/domain/repositories/used-pool-tokens.repository';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { createIdempotently } from '@shared-kernel/application/services/create-idempotently';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CreateRunnerPoolHandler
  implements
    CommandHandlerPort<CreateRunnerPoolCommand, RunnerPoolCreatedDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly pools: RunnerPoolRepository,
    private readonly usedTokens: UsedPoolTokensRepository,
    private readonly secrets: ProvisionSecretsPort,
    private readonly egresses: EgressRepository,
    private readonly platform: PlatformEgressSettings | null,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly tokens: TokenIssuer,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateRunnerPoolCommand,
  ): Promise<RunnerPoolCreatedDto | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(command.workspaceId),
        command.actor.principal,
      );

      if (!permissions) {
        return null;
      }

      if (!permissions.managesRunners) {
        return { created: forbiddenTo('runners'), token: null };
      }

      const compiled = this.definitions.pool(command.definition);

      if (!compiled.ok) {
        return {
          created: { outcome: 'invalid', problems: compiled.problems },
          token: null,
        };
      }

      const supplied = compiled.access;
      const issued =
        supplied.mode === 'pull' && !supplied.token
          ? this.tokens.issue()
          : null;

      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          runnerPool: 'create',
          workspaceId: command.workspaceId,
          key: compiled.key.value,
          labels: compiled.labels.values,
          maxRuns: compiled.maxRuns?.value ?? null,
          token:
            supplied.mode === 'pull' && supplied.token
              ? this.tokens.hash(supplied.token.revealed())
              : null,
          tokenVersion: supplied.mode === 'pull' ? supplied.tokenVersion : null,
          provision:
            supplied.mode === 'push'
              ? {
                  url: supplied.url.value,
                  secret: supplied.secret
                    ? this.tokens.hash(supplied.secret.revealed())
                    : null,
                  secretVersion: supplied.secretVersion,
                  egress: supplied.egress?.value ?? null,
                  egressTraffic: supplied.egressTraffic.value,
                }
              : null,
        },
      };

      try {
        const created = await this.transaction.inTransaction(() =>
          createIdempotently(this.creates, create, async () => {
            if (supplied.mode === 'push') {
              await assertKnownEgress(
                supplied.egress,
                permissions.workspaceId,
                this.egresses,
                this.platform,
              );
            }

            const id = RunnerPoolId.of(this.ids.generate());
            const accessInput = await poolAccessInput(
              supplied,
              { id, workspaceId: permissions.workspaceId },
              this.tokens,
              this.secrets,
            );
            const pool = RunnerPool.create({
              id,
              workspaceId: permissions.workspaceId,
              by: ChangeActor.of(command.actor, permissions.workspaceId),
              key: compiled.key,
              labels: compiled.labels,
              maxRuns: compiled.maxRuns,
              access: issued ? issuedTo(accessInput, issued) : accessInput,
            });

            await this.pools.add(pool);
            await recordPoolTokenUse(this.usedTokens, this.pools, pool, null);

            return pool.id.value;
          }),
        );

        return {
          created,
          token:
            issued && created.outcome === 'created' && !created.replayed
              ? issued.token
              : null,
        };
      } catch (error) {
        if (error instanceof RunnerPoolAlreadyExistsError) {
          return {
            created: { outcome: 'already-exists', address: compiled.key.value },
            token: null,
          };
        }

        if (
          error instanceof PoolTokenInUseError ||
          error instanceof PoolTokenAlreadyUsedError ||
          error instanceof InvalidRunnerPoolError
        ) {
          return {
            created: {
              outcome: 'invalid',
              problems: [RunnerProblems.poolInvalid(error)],
            },
            token: null,
          };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
