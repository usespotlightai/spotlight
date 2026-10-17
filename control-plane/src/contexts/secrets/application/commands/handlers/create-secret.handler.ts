import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateSecretCommand } from '@secrets/application/commands/create-secret.command';
import type { SecretDefinitionsPort } from '@secrets/application/ports/secret-definitions.port';
import { SecretProblems } from '@secrets/application/rendering/secret-problems';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { InvalidSecretError } from '@secrets/domain/exceptions/invalid-secret.error';
import { SecretAlreadyDefinedError } from '@secrets/domain/exceptions/secret-already-defined.error';
import type { SecretRepository } from '@secrets/domain/repositories/secret.repository';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
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
import { createdOnce } from '@shared-kernel/application/services/created-once';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const withoutValue = (definition: unknown): unknown => {
  if (!definition || typeof definition !== 'object') {
    return definition;
  }

  const { valueWo: _withheld, ...rest } = definition as Record<string, unknown>;

  return rest;
};

export class CreateSecretHandler
  implements CommandHandlerPort<CreateSecretCommand, ResourceCreated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: SecretDefinitionsPort,
    private readonly secrets: SecretRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: CreateSecretCommand): Promise<ResourceCreated | null> {
    try {
      const { principal } = command.actor;
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(command.workspaceId),
        principal,
      );

      if (!permissions) {
        return null;
      }

      if (!permissions.managesSecrets) {
        return forbiddenTo('manage-secrets');
      }

      const compiled = this.definitions.secret(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const secret = Secret.set(compiled, {
        id: SecretId.of(this.ids.generate()),
        workspaceId: permissions.workspaceId,
        by: Attribution.of(command.actor, permissions.workspaceId),
        at: this.clock.now(),
      });
      const create: IdempotentCreate = {
        by: principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          secret: 'create',
          workspaceId: command.workspaceId,
          definition: withoutValue(command.definition),
        },
      };

      try {
        return await this.transaction.inTransaction(() =>
          createdOnce(this.creates, create, async () => {
            await this.secrets.save(secret);

            return secret.id.value;
          }),
        );
      } catch (error) {
        if (error instanceof SecretAlreadyDefinedError) {
          return { outcome: 'taken', address: secret.name.value };
        }

        throw error;
      }
    } catch (error) {
      if (error instanceof InvalidSecretError) {
        return {
          outcome: 'invalid',
          problems: [SecretProblems.invalid(error)],
        };
      }

      rethrowAsApplicationError(error);
    }
  }
}
