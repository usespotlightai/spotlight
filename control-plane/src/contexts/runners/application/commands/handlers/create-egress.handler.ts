import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateEgressCommand } from '@runners/application/commands/runner-resource.commands';
import type { EgressCreatedDto } from '@runners/application/dto/runner-resource.dto';
import type { RunnerDefinitionsPort } from '@runners/application/ports/runner-definitions.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import { recordEgressTokenUse } from '@runners/application/services/record-egress-token-use';
import { Egress } from '@runners/domain/aggregates/egress.aggregate';
import { EgressAlreadyExistsError } from '@runners/domain/exceptions/egress-already-exists.error';
import { EgressTokenAlreadyUsedError } from '@runners/domain/exceptions/egress-token-already-used.error';
import { EgressTokenInUseError } from '@runners/domain/exceptions/egress-token-in-use.error';
import { InvalidEgressError } from '@runners/domain/exceptions/invalid-egress.error';
import type { EgressRepository } from '@runners/domain/repositories/egress.repository';
import type { UsedEgressTokensRepository } from '@runners/domain/repositories/used-egress-tokens.repository';
import { EgressId } from '@runners/domain/value-objects/egress-id.vo';
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
import { createdOnce } from '@shared-kernel/application/services/created-once';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CreateEgressHandler
  implements CommandHandlerPort<CreateEgressCommand, EgressCreatedDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: RunnerDefinitionsPort,
    private readonly egresses: EgressRepository,
    private readonly usedTokens: UsedEgressTokensRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly tokens: TokenIssuer,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateEgressCommand,
  ): Promise<EgressCreatedDto | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(command.workspaceId),
        command.actor.principal,
      );

      if (!permissions) {
        return null;
      }

      if (!permissions.managesRunners) {
        return { created: forbiddenTo('manage-runners'), token: null };
      }

      const compiled = this.definitions.egress(command.definition);

      if (!compiled.ok) {
        return {
          created: { outcome: 'invalid', problems: compiled.problems },
          token: null,
        };
      }

      const issued = compiled.token
        ? { token: null, hash: this.tokens.hash(compiled.token.revealed()) }
        : this.tokens.issue();

      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          egress: 'create',
          workspaceId: command.workspaceId,
          key: compiled.key.value,
          url: compiled.url.value,
          token: compiled.token ? issued.hash : null,
          tokenVersion: compiled.tokenVersion,
        },
      };

      try {
        const created = await this.transaction.inTransaction(() =>
          createdOnce(this.creates, create, async () => {
            const egress = Egress.create({
              id: EgressId.of(this.ids.generate()),
              workspaceId: permissions.workspaceId,
              by: Attribution.of(command.actor, permissions.workspaceId),
              key: compiled.key,
              url: compiled.url,
              token: {
                tokenHash: TokenHash.of(issued.hash),
                tokenVersion: compiled.tokenVersion,
              },
            });

            await this.egresses.add(egress);
            await recordEgressTokenUse(
              this.usedTokens,
              this.egresses,
              egress,
              null,
            );

            return egress.id.value;
          }),
        );

        return {
          created,
          token:
            issued.token && created.outcome === 'created' && !created.replayed
              ? issued.token
              : null,
        };
      } catch (error) {
        if (error instanceof EgressAlreadyExistsError) {
          return {
            created: { outcome: 'taken', address: compiled.key.value },
            token: null,
          };
        }

        if (
          error instanceof EgressTokenInUseError ||
          error instanceof EgressTokenAlreadyUsedError ||
          error instanceof InvalidEgressError
        ) {
          return {
            created: {
              outcome: 'invalid',
              problems: [RunnerProblems.egressInvalid(error)],
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
