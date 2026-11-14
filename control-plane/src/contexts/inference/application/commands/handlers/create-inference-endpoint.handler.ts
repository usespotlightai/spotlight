import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { CreateInferenceEndpointCommand } from '@inference/application/commands/inference-endpoint.commands';
import type { InferenceEndpointDefinitionsPort } from '@inference/application/ports/inference-endpoint-definitions.port';
import type { InferenceResolutionPort } from '@inference/application/ports/inference-resolution.port';
import type { InferenceTransportPort } from '@inference/application/ports/inference-transport.port';
import {
  INFERENCE_KEY_SECRET,
  InferenceProblems,
} from '@inference/application/rendering/inference-problems';
import { definitionOf } from '@inference/application/services/inference-endpoint-key';
import { InferenceEndpoint } from '@inference/domain/aggregates/inference-endpoint.aggregate';
import { InferenceEndpointAlreadyExistsError } from '@inference/domain/exceptions/inference-endpoint-already-exists.error';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import { InferenceEndpointId } from '@inference/domain/value-objects/inference-endpoint-id.vo';
import type { WorkspaceSecretsPort } from '@secrets/application/ports/workspace-secrets.port';
import {
  forbiddenTo,
  type ResourceCreated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type {
  IdempotentCreate,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { createIdempotently } from '@shared-kernel/application/services/create-idempotently';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const withoutKey = (definition: unknown): unknown => {
  if (!definition || typeof definition !== 'object') {
    return definition;
  }

  const { apiKeyWo: _apiKeyWo, ...rest } = definition as Record<
    string,
    unknown
  >;

  return rest;
};

export class CreateInferenceEndpointHandler implements CommandHandlerPort<
  CreateInferenceEndpointCommand,
  ResourceCreated | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly definitions: InferenceEndpointDefinitionsPort,
    private readonly endpoints: InferenceEndpointRepository,
    private readonly secrets: WorkspaceSecretsPort,
    private readonly transport: InferenceTransportPort,
    private readonly resolution: InferenceResolutionPort,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: CreateInferenceEndpointCommand,
  ): Promise<ResourceCreated | null> {
    try {
      const permissions = await this.access.permissionsIn(
        WorkspaceId.of(command.workspaceId),
        command.actor.principal,
      );

      if (!permissions) {
        return null;
      }

      if (!permissions.scopes.has('secrets')) {
        return forbiddenTo('secrets');
      }

      const compiled = this.definitions.endpoint(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const refusal = await this.transport.refusalOf(
        command.workspaceId,
        compiled.baseUrl.value,
      );

      if (refusal) {
        return {
          outcome: 'invalid',
          problems: [InferenceProblems.refused(refusal)],
        };
      }

      const created = InferenceEndpoint.create({
        id: InferenceEndpointId.of(this.ids.generate()),
        workspaceId: permissions.workspaceId,
        definition: definitionOf(compiled, null),
      });
      const create: IdempotentCreate = {
        by: command.actor.principal.toString(),
        key: IdempotencyKey.of(command.idempotencyKey),
        request: {
          inferenceEndpoint: 'create',
          workspaceId: command.workspaceId,
          definition: withoutKey(command.definition),
        },
      };

      try {
        const outcome = await this.transaction.inTransaction(() =>
          createIdempotently(this.creates, create, async () => {
            await this.endpoints.add(created);

            if (compiled.apiKey) {
              await this.secrets.store({
                workspaceId: command.workspaceId,
                name: INFERENCE_KEY_SECRET,
                value: compiled.apiKey,
              });
            }

            return created.id.value;
          }),
        );

        this.resolution.forget(command.workspaceId);

        return outcome;
      } catch (error) {
        if (error instanceof InferenceEndpointAlreadyExistsError) {
          return { outcome: 'already-exists', address: permissions.slug };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
