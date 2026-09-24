import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateRunnerCommand } from '@runners/application/commands/runner-resource.commands';
import type { RunnerCreatedDto } from '@runners/application/dto/runner-resource.dto';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerNameTakenError } from '@runners/domain/exceptions/runner-name-taken.error';
import { RunnerTokenTakenError } from '@runners/domain/exceptions/runner-token-taken.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
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
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CreateRunnerHandler
  implements CommandHandlerPort<CreateRunnerCommand, RunnerCreatedDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly runners: RunnerRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly tokens: TokenMintPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateRunnerCommand,
  ): Promise<RunnerCreatedDto | null> {
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

      const compiled = this.definitions.runner(command.definition);

      if (!compiled.ok) {
        return {
          created: { outcome: 'invalid', problems: compiled.problems },
          token: null,
        };
      }

      const given = compiled.token
        ? { token: null, hash: this.tokens.hash(compiled.token) }
        : this.tokens.mint();

      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          runner: 'create',
          workspaceId: command.workspaceId,
          name: compiled.name.value,
          labels: compiled.labels.values,
          token: compiled.token ? given.hash : null,
        },
      };

      try {
        const created = await this.transaction.run(() =>
          createdOnce(this.creates, create, async () => {
            const enrolled = Runner.enrol({
              id: RunnerId.of(this.ids.generate()),
              workspaceId: cleared.workspaceId,
              by: Attribution.of(command.actor, cleared.workspaceId),
              name: compiled.name,
              labels: compiled.labels,
              tokenHash: TokenHash.of(given.hash),
            });

            await this.runners.add(enrolled);

            return enrolled.id.value;
          }),
        );

        return {
          created,
          token:
            created.outcome === 'created' && !created.replayed
              ? given.token
              : null,
        };
      } catch (error) {
        if (error instanceof RunnerNameTakenError) {
          return {
            created: { outcome: 'taken', address: compiled.name.value },
            token: null,
          };
        }

        if (error instanceof RunnerTokenTakenError) {
          return {
            created: {
              outcome: 'invalid',
              problems: [RunnerProblems.tokenTaken(error)],
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
