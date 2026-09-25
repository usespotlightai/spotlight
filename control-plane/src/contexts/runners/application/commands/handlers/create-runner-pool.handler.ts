import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateRunnerPoolCommand } from '@runners/application/commands/runner-resource.commands';
import type { RunnerPoolCreatedDto } from '@runners/application/dto/runner-resource.dto';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import {
  givenAccess,
  issuedTo,
} from '@runners/application/services/pool-access-given';
import { refuseRegivenToken } from '@runners/application/services/refuse-regiven-token';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import { PoolTokenSpentError } from '@runners/domain/exceptions/pool-token-spent.error';
import { PoolTokenTakenError } from '@runners/domain/exceptions/pool-token-taken.error';
import { RunnerPoolAlreadyDefinedError } from '@runners/domain/exceptions/runner-pool-already-defined.error';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CreateRunnerPoolHandler
  implements
    CommandHandlerPort<CreateRunnerPoolCommand, RunnerPoolCreatedDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly pools: RunnerPoolRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly tokens: TokenMintPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateRunnerPoolCommand,
  ): Promise<RunnerPoolCreatedDto | null> {
    try {
      const cleared = await this.access.clearanceIn(
        WorkspaceId.of(command.workspaceId),
        command.actor.principal,
      );

      if (!cleared) {
        return null;
      }

      if (!cleared.managesRunners) {
        return { created: forbiddenTo('manage-runners'), token: null };
      }

      const compiled = this.definitions.pool(command.definition);

      if (!compiled.ok) {
        return {
          created: { outcome: 'invalid', problems: compiled.problems },
          token: null,
        };
      }

      const supplied = givenAccess(compiled.access, this.tokens);
      const minted =
        supplied.mode === 'pull' && !supplied.tokenHash
          ? this.tokens.mint()
          : null;
      const given = minted ? issuedTo(supplied, minted) : supplied;

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
            supplied.mode === 'pull'
              ? (supplied.tokenHash?.value ?? null)
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
                }
              : null,
        },
      };

      try {
        const created = await this.transaction.run(() =>
          createdOnce(this.creates, create, async () => {
            const defined = RunnerPool.define({
              id: RunnerPoolId.of(this.ids.generate()),
              workspaceId: cleared.workspaceId,
              by: Attribution.of(command.actor, cleared.workspaceId),
              key: compiled.key,
              labels: compiled.labels,
              maxRuns: compiled.maxRuns,
              access: given,
            });

            await refuseRegivenToken(this.pools, defined);
            await this.pools.add(defined);

            return defined.id.value;
          }),
        );

        return {
          created,
          token:
            minted && created.outcome === 'created' && !created.replayed
              ? minted.token
              : null,
        };
      } catch (error) {
        if (error instanceof RunnerPoolAlreadyDefinedError) {
          return {
            created: { outcome: 'taken', address: compiled.key.value },
            token: null,
          };
        }

        if (
          error instanceof PoolTokenTakenError ||
          error instanceof PoolTokenSpentError ||
          error instanceof InvalidRunnerPoolError
        ) {
          return {
            created: {
              outcome: 'invalid',
              problems: [RunnerProblems.poolRefused(error)],
            },
            token: null,
          };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
